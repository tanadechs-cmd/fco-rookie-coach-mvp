import { useId } from "react";
import { conversationCopy } from './knowledgeConversation';
import {
  englishStatus,
  sourceSignature,
  type BilingualAnswerConfig,
} from "./knowledgeRouting";

type EnglishAnswer = NonNullable<BilingualAnswerConfig["en"]>;

type BilingualAnswerEditorProps = {
  answer: BilingualAnswerConfig;
  onChange: (patch: Partial<BilingualAnswerConfig>) => void;
};

const EMPTY_ENGLISH: EnglishAnswer = {
  title: "",
  text: "",
  keywords: [],
  keyboardSteps: [],
  xboxSteps: [],
  playstationSteps: [],
};

const STATUS_COPY = {
  current: {
    label: "ตรงกับต้นฉบับไทย",
    description: "คำแปลอ้างอิงต้นฉบับไทยเวอร์ชันนี้แล้ว",
  },
  stale: {
    label: "คำแปลต้องอัปเดต / ยืนยัน",
    description: "ตรวจคำแปลให้ตรงกับต้นฉบับไทย แล้วกดยืนยันด้านล่าง",
  },
  missing: {
    label: "ยังไม่มีคำแปลอังกฤษ",
    description: "เพิ่มชื่อหัวข้อและคำตอบภาษาอังกฤษก่อนยืนยัน",
  },
};

const fieldStyle = {
  borderColor: "var(--border)",
  backgroundColor: "var(--background)",
  color: "var(--foreground)",
};

const fieldClass =
  "w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2";

export function BilingualAnswerEditor({
  answer,
  onChange,
}: BilingualAnswerEditorProps) {
  const instanceId = useId();
  const idPrefix = `answer-${answer.id}-en-${instanceId}`;
  const english = answer.en ?? EMPTY_ENGLISH;
  const status = englishStatus(answer);
  const statusCopy = STATUS_COPY[status];
  const canConfirm = Boolean(english.title.trim() && english.text.trim());

  function patchEnglish(patch: Partial<EnglishAnswer>) {
    // Editing a translation requires an explicit new source confirmation.
    onChange({ en: { ...english, ...patch, sourceSignature: undefined } });
  }

  const stepFields = [
    ["keyboardSteps", "Keyboard"],
    ["xboxSteps", "Xbox · ABXY"],
    ["playstationSteps", "PlayStation · □ △ ○ ✕"],
  ] as const;

  return (
    <>
    <fieldset className="mt-4 rounded-xl border p-4" style={{ borderColor: 'var(--border)' }}>
      <legend className="px-2 text-sm font-semibold">ข้อความชวนคุย · TH / EN</legend>
      <p className="text-xs mb-3">แสดงก่อนคำตอบ และก่อนคลิปตามลำดับ ลบข้อความให้ว่างเพื่อไม่แสดง ไม่เรียก AI เพิ่ม</p>
      {(['th', 'en'] as const).map(lang => (['opening', 'clipIntro'] as const).map(field => {
        const fields = lang === 'th' ? answer : english;
        const starter = conversationCopy(undefined, lang, answer.id);
        return <label key={`${lang}-${field}`} className="grid gap-1 mb-3 text-xs">
          {field === 'opening' ? 'ข้อความชวนคุย' : 'ข้อความก่อนคลิป'} · {lang.toUpperCase()}
          <textarea aria-label={`${lang} ${field} — ${answer.id}`} rows={2} className={fieldClass} style={fieldStyle}
            value={fields[field] ?? starter[field]}
            onChange={event => lang === 'th' ? onChange({ [field]: event.target.value }) : patchEnglish({ [field]: event.target.value })} />
        </label>;
      }))}
    </fieldset>
    <fieldset
      className="mt-4 min-w-0 rounded-xl border p-4"
      style={{ borderColor: "var(--border)" }}
      aria-describedby={`${idPrefix}-help`}
    >
      <legend className="px-2 text-sm font-semibold">คำตอบภาษาอังกฤษ · EN</legend>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <p
          id={`${idPrefix}-help`}
          className="max-w-lg text-xs leading-relaxed"
          style={{ color: "var(--muted-foreground)" }}
        >
          ใช้คลิปและแหล่งข้อมูลเดียวกับภาษาไทย แก้ข้อความอังกฤษได้โดยไม่ต้องเรียก AI
        </p>
        <span
          className="rounded-full px-2 py-1 text-xs font-medium"
          style={{
            backgroundColor: status === "current" ? "rgba(43,108,58,0.1)" : "var(--muted)",
            color: status === "current" ? "var(--accent)" : "var(--muted-foreground)",
          }}
          role="status"
        >
          {statusCopy.label}
        </span>
      </div>

      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <label htmlFor={`${idPrefix}-title`} className="text-xs font-medium">ชื่อหัวข้อ · English title</label>
          <input
            id={`${idPrefix}-title`}
            aria-label={`English title — ${answer.id}`}
            lang="en"
            value={english.title}
            onChange={(event) => patchEnglish({ title: event.target.value })}
            placeholder="e.g. How to earn BP"
            className={fieldClass}
            style={fieldStyle}
          />
        </div>

        <div className="grid gap-1.5">
          <label htmlFor={`${idPrefix}-keywords`} className="text-xs font-medium">คำค้นอังกฤษ · คั่นด้วย comma</label>
          <input
            id={`${idPrefix}-keywords`}
            aria-label={`English keywords — ${answer.id}`}
            lang="en"
            value={english.keywords.join(", ")}
            onChange={(event) => patchEnglish({ keywords: event.target.value.split(",").map((keyword) => keyword.trim()) })}
            placeholder="earn BP, make money, get rewards"
            className={fieldClass}
            style={fieldStyle}
          />
        </div>

        <div className="grid gap-1.5">
          <label htmlFor={`${idPrefix}-text`} className="text-xs font-medium">คำตอบ · English answer</label>
          <textarea
            id={`${idPrefix}-text`}
            aria-label={`English answer — ${answer.id}`}
            lang="en"
            value={english.text}
            onChange={(event) => patchEnglish({ text: event.target.value })}
            rows={3}
            className={`${fieldClass} resize-y`}
            style={fieldStyle}
          />
        </div>

        <div className="grid gap-3 xl:grid-cols-3">
          {stepFields.map(([field, label]) => (
            <div key={field} className="grid content-start gap-1.5">
              <label htmlFor={`${idPrefix}-${field}`} className="text-xs font-medium">ขั้นตอน {label}</label>
              <textarea
                id={`${idPrefix}-${field}`}
                aria-label={`English ${label} steps — ${answer.id}`}
                aria-describedby={`${idPrefix}-steps-help`}
                lang="en"
                value={english[field].join("\n")}
                onChange={(event) => patchEnglish({ [field]: event.target.value.split("\n") })}
                rows={3}
                className={`${fieldClass} resize-y`}
                style={fieldStyle}
              />
            </div>
          ))}
        </div>
        <p id={`${idPrefix}-steps-help`} className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          หนึ่งขั้นตอนต่อบรรทัด เว้นว่างได้เมื่อไม่ต้องมีขั้นตอนเฉพาะอุปกรณ์
        </p>
      </div>

      <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--border)" }}>
        <p className="mb-2 text-xs" style={{ color: "var(--muted-foreground)" }}>{statusCopy.description}</p>
        <button
          type="button"
          onClick={() => onChange({ en: { ...english, sourceSignature: sourceSignature(answer) } })}
          disabled={!canConfirm || status === "current"}
          className="rounded-lg border px-3 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2"
          style={fieldStyle}
        >
          ยืนยันคำแปลตรงกับภาษาไทย
        </button>
        <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
          คำแปลตั้งต้นเป็นข้อความสำหรับ prototype สถานะนี้ตรวจเวอร์ชันต้นฉบับ ไม่แทนการอนุมัติของทีม
          <br />
          กด Save changes ของหมวดนี้เพื่อบันทึกการแก้ไข
        </p>
      </div>
    </fieldset>
    </>
  );
}

export default BilingualAnswerEditor;
