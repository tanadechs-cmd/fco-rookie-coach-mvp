create extension if not exists pgcrypto;

create table if not exists public.fco_app_config (
  id text primary key,
  revision bigint not null default 0,
  faq_config jsonb not null default '[]'::jsonb,
  chat_answers jsonb not null default '[]'::jsonb,
  delivery_plans jsonb not null default '[]'::jsonb,
  published_sections jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text not null default 'system',
  constraint fco_app_config_singleton check (id = 'production'),
  constraint fco_app_config_arrays check (
    jsonb_typeof(faq_config) = 'array'
    and jsonb_typeof(chat_answers) = 'array'
    and jsonb_typeof(delivery_plans) = 'array'
    and jsonb_typeof(published_sections) = 'array'
  )
);

create table if not exists public.fco_config_versions (
  id uuid primary key default gen_random_uuid(),
  config_id text not null references public.fco_app_config(id) on delete cascade,
  revision bigint not null,
  changed_section text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  created_by text not null default 'admin',
  unique (config_id, revision)
);

alter table public.fco_app_config enable row level security;
alter table public.fco_config_versions enable row level security;
revoke all on public.fco_app_config from public, anon, authenticated;
revoke all on public.fco_config_versions from public, anon, authenticated;
grant usage on schema public to service_role;
grant select on public.fco_app_config to service_role;
grant select, insert on public.fco_config_versions to service_role;

insert into public.fco_app_config (id)
values ('production')
on conflict (id) do nothing;

insert into public.fco_config_versions (
  config_id,
  revision,
  changed_section,
  snapshot,
  created_by
)
select
  id,
  revision,
  'initial',
  jsonb_build_object(
    'faqConfigs', faq_config,
    'answerConfigs', chat_answers,
    'deliveryPlans', delivery_plans,
    'publishedSections', published_sections,
    'updatedAt', updated_at
  ),
  'system'
from public.fco_app_config
where id = 'production'
on conflict (config_id, revision) do nothing;

create or replace function public.save_fco_config_section(
  p_section text,
  p_payload jsonb,
  p_expected_revision bigint,
  p_updated_by text default 'admin'
)
returns setof public.fco_app_config
language plpgsql
security definer
set search_path = public
as $$
declare
  current_config public.fco_app_config%rowtype;
  next_config public.fco_app_config%rowtype;
begin
  select * into current_config
  from public.fco_app_config
  where id = 'production'
  for update;

  if not found then
    raise exception 'production configuration is missing';
  end if;

  if current_config.revision <> p_expected_revision then
    raise exception 'revision conflict: expected %, actual %', p_expected_revision, current_config.revision
      using errcode = '40001';
  end if;

  if p_section = 'faq_content' then
    if jsonb_typeof(p_payload->'faqConfigs') is distinct from 'array'
       or jsonb_typeof(p_payload->'answerConfigs') is distinct from 'array' then
      raise exception 'invalid faq_content payload';
    end if;
    update public.fco_app_config
    set faq_config = p_payload->'faqConfigs',
        chat_answers = p_payload->'answerConfigs',
        published_sections = case
          when published_sections @> jsonb_build_array('faq_content') then published_sections
          else published_sections || jsonb_build_array('faq_content')
        end,
        revision = revision + 1,
        updated_at = now(),
        updated_by = p_updated_by
    where id = 'production'
    returning * into next_config;
  elsif p_section = 'proactive_messages' then
    if jsonb_typeof(p_payload->'deliveryPlans') is distinct from 'array' then
      raise exception 'invalid proactive_messages payload';
    end if;
    update public.fco_app_config
    set delivery_plans = p_payload->'deliveryPlans',
        published_sections = case
          when published_sections @> jsonb_build_array('proactive_messages') then published_sections
          else published_sections || jsonb_build_array('proactive_messages')
        end,
        revision = revision + 1,
        updated_at = now(),
        updated_by = p_updated_by
    where id = 'production'
    returning * into next_config;
  else
    raise exception 'invalid configuration section: %', p_section;
  end if;

  insert into public.fco_config_versions (
    config_id,
    revision,
    changed_section,
    snapshot,
    created_by
  ) values (
    next_config.id,
    next_config.revision,
    p_section,
    jsonb_build_object(
      'faqConfigs', next_config.faq_config,
      'answerConfigs', next_config.chat_answers,
      'deliveryPlans', next_config.delivery_plans,
      'publishedSections', next_config.published_sections,
      'updatedAt', next_config.updated_at
    ),
    p_updated_by
  );

  return next next_config;
  return;
end;
$$;

revoke all on function public.save_fco_config_section(text, jsonb, bigint, text) from public, anon, authenticated;
grant execute on function public.save_fco_config_section(text, jsonb, bigint, text) to service_role;

create or replace function public.restore_fco_config_version(
  p_revision bigint,
  p_expected_revision bigint,
  p_updated_by text default 'admin'
)
returns setof public.fco_app_config
language plpgsql
security definer
set search_path = public
as $$
declare
  current_config public.fco_app_config%rowtype;
  next_config public.fco_app_config%rowtype;
  target_snapshot jsonb;
begin
  select * into current_config
  from public.fco_app_config
  where id = 'production'
  for update;

  if not found then
    raise exception 'production configuration is missing';
  end if;

  if current_config.revision <> p_expected_revision then
    raise exception 'revision conflict: expected %, actual %', p_expected_revision, current_config.revision
      using errcode = '40001';
  end if;

  select snapshot into target_snapshot
  from public.fco_config_versions
  where config_id = 'production' and revision = p_revision;

  if not found then
    raise exception 'configuration version % was not found', p_revision;
  end if;

  if jsonb_typeof(target_snapshot->'faqConfigs') is distinct from 'array'
     or jsonb_typeof(target_snapshot->'answerConfigs') is distinct from 'array'
     or jsonb_typeof(target_snapshot->'deliveryPlans') is distinct from 'array'
     or jsonb_typeof(target_snapshot->'publishedSections') is distinct from 'array' then
    raise exception 'configuration version % is invalid', p_revision;
  end if;

  update public.fco_app_config
  set faq_config = target_snapshot->'faqConfigs',
      chat_answers = target_snapshot->'answerConfigs',
      delivery_plans = target_snapshot->'deliveryPlans',
      published_sections = target_snapshot->'publishedSections',
      revision = revision + 1,
      updated_at = now(),
      updated_by = p_updated_by
  where id = 'production'
  returning * into next_config;

  insert into public.fco_config_versions (
    config_id,
    revision,
    changed_section,
    snapshot,
    created_by
  ) values (
    next_config.id,
    next_config.revision,
    'rollback:' || p_revision::text,
    jsonb_build_object(
      'faqConfigs', next_config.faq_config,
      'answerConfigs', next_config.chat_answers,
      'deliveryPlans', next_config.delivery_plans,
      'publishedSections', next_config.published_sections,
      'updatedAt', next_config.updated_at
    ),
    p_updated_by
  );

  return next next_config;
  return;
end;
$$;

revoke all on function public.restore_fco_config_version(bigint, bigint, text) from public, anon, authenticated;
grant execute on function public.restore_fco_config_version(bigint, bigint, text) to service_role;

create table if not exists public.fco_unanswered_questions (
  id uuid primary key default gen_random_uuid(),
  normalized_question text not null unique,
  question text not null,
  onboarding_day smallint not null default 1 check (onboarding_day between 1 and 3),
  related_topic_id text,
  count integer not null default 1 check (count >= 1),
  first_seen date not null default current_date,
  last_seen date not null default current_date,
  status text not null default 'new' check (status in ('new', 'reviewing', 'content-added', 'ignored')),
  recent_context text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.fco_unanswered_questions enable row level security;
revoke all on public.fco_unanswered_questions from public, anon, authenticated;
grant select, insert, update on public.fco_unanswered_questions to service_role;

create or replace function public.report_fco_unanswered_question(
  p_question text,
  p_onboarding_day smallint default 1,
  p_recent_context text default ''
)
returns setof public.fco_unanswered_questions
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text;
  cleaned_question text;
  saved_question public.fco_unanswered_questions%rowtype;
begin
  cleaned_question := trim(regexp_replace(coalesce(p_question, ''), '\s+', ' ', 'g'));
  normalized := lower(cleaned_question);

  if char_length(cleaned_question) < 2 or char_length(cleaned_question) > 500 then
    raise exception 'question must contain 2 to 500 characters';
  end if;
  if p_onboarding_day not between 1 and 3 then
    raise exception 'onboarding day must be between 1 and 3';
  end if;

  insert into public.fco_unanswered_questions (
    normalized_question,
    question,
    onboarding_day,
    recent_context
  ) values (
    normalized,
    cleaned_question,
    p_onboarding_day,
    left(coalesce(p_recent_context, ''), 1000)
  )
  on conflict (normalized_question) do update
  set count = public.fco_unanswered_questions.count + 1,
      last_seen = current_date,
      recent_context = excluded.recent_context,
      updated_at = now()
  returning * into saved_question;

  return next saved_question;
  return;
end;
$$;

revoke all on function public.report_fco_unanswered_question(text, smallint, text) from public, anon, authenticated;
grant execute on function public.report_fco_unanswered_question(text, smallint, text) to service_role;
