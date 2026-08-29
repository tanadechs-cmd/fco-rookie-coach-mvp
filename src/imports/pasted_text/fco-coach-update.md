Update the existing FCO Rookie Coach prototype in src/App.tsx. Preserve the current warm off-white visual system, restrained FC red, mascot, typography, login flow, responsive behavior, all 48 KnowledgeItem records, keyword matching, source metadata, time-sensitive warnings, and existing CDN thumbnails. Do not publish.

GOAL
Unify the player Today experience and Chat into one proactive coach conversation, then add an operations-friendly Admin experience for configuring daily onboarding recommendations and response branches.

PLAYER EXPERIENCE — ONE SECTION ONLY
1. Remove the separate Today and Chat navigation/items. After demo login, show one primary section called “โค้ช” (mobile and desktop). Keep copy minimal.
2. At the top of the conversation show a compact context row: “Onboarding • Day 2” and a subtle progress indicator “วันที่ 2 จาก 3”. For prototype testing add a small Day 1 / Day 2 / Day 3 selector, but visually de-emphasize it.
3. Recommendations must appear inside the chat timeline as proactive bot messages, not as a dashboard card outside chat. Use a date separator such as “วันนี้ • Day 2”.
4. Initial bot sequence for Day 2:
   - short greeting: “วันนี้มีเรื่องสั้น ๆ ที่ช่วยให้เล่นง่ายขึ้น”
   - one relevant existing KnowledgeCard from the 48-topic local collection
   - ask “เรื่องนี้คุณรู้แล้วหรือยัง?”
5. Add three compact reply chips: “รู้แล้ว”, “ยังไม่รู้”, “ดูเรื่องอื่น”.
   - รู้แล้ว: append the user reply, then bot says “โอเคครับ เดี๋ยวผมหาเรื่องใหม่ให้” and offers the next relevant topic.
   - ยังไม่รู้: append the user reply, then bot gives a concise explanation using the matched KnowledgeItem shortSummary, shows its lesson card, then asks “ตรงนี้ช่วยได้ไหม?” with “ช่วยได้” / “ยังงงอยู่”.
   - ดูเรื่องอื่น: append the user reply, then bot asks “อยากดูเรื่องไหน?” and shows category chips “เล่นให้คล่อง”, “จัดทีม”, “ระบบเกม”, “โหมดแข่งขัน”. Selecting a category sends one relevant topic.
6. Keep the Gemini-like composer visually prominent at the bottom. Free-text questions must continue to route through the existing deterministic matchKnowledge logic across all 48 topics. No file upload.
7. Recommendations and replies stay in the same conversation history. The bot should feel proactive, but avoid popup/modal overload.
8. Responsive QA target: player view must work at desktop and mobile widths.

ADMIN EXPERIENCE — SAME PROTOTYPE, SEPARATE ROLE/ROUTE
1. Keep the existing login screen. Add a quiet secondary action “ดูหน้า Admin” below “ทดลองใช้งาน”. Demo player login opens the player coach; Admin opens the back-office.
2. Admin uses the same visual language but a more utilitarian desktop layout. Left navigation:
   - แผนรายวัน
   - Content Library
   - Response Rules
   - Preview
   Add a visible “กลับหน้า Player” control.
3. Default “แผนรายวัน” screen:
   - heading “Onboarding Daily Plan”
   - Day 1 / Day 2 / Day 3 tabs
   - fields for Segment (default Onboarding), Send time, Opening message, Recommended content, and Status (Draft / Active)
   - recommended content picker must use existing KnowledgeItem topicId + title, e.g. “FCO-EDU-043 • ส่งบอลพื้นฐาน”
   - show three response options: รู้แล้ว, ยังไม่รู้, ดูเรื่องอื่น
   - primary button “บันทึกแบบร่าง”; secondary “เปิดใช้งาน”
   - use local in-memory state; buttons and edits must work in the prototype.
4. “Content Library” screen:
   - searchable compact list/table of all 48 topics
   - columns: Topic ID, Title, Category, Source status
   - selecting a topic opens a right-side detail panel with shortSummary, YouTube link, optional thumbnail, timeSensitive warning, sourceUpdatedAt, and source reference.
   - never expose qaStatus in the player UI; it may appear internally in Admin only.
5. “Response Rules” screen:
   - use a simple editable rule table, not a complex node diagram.
   - columns: User response, Action, Target content / next step.
   - rows for know, dont_know, other, free_text.
   - actions: reply, send_topic, ask_category, keyword_match.
   - selecting a target content uses an existing topicId.
6. “Preview” screen:
   - split layout: selected Day config on the left and a live player conversation preview on the right.
   - edits made in Daily Plan should update the preview.
7. Source mapping should be available from a “ดู Source mapping” disclosure/detail panel, not clutter the default form. Show these code-friendly fields:
   - planId
   - segment
   - day
   - recommendationTopicId
   - ruleId
   - action
   - targetTopicId
   - sourceSheet URL
   - sourceUpdatedAt
   Explain in one short note: “Prototype ใช้ local mock; production เชื่อม DailyPlan + BranchRule + KnowledgeItem ผ่าน topicId”
8. Add local TypeScript interfaces and mock state:
   interface DailyPlan { id:string; day:1|2|3; segment:"onboarding"; sendAt:string; openingMessage:string; recommendationTopicId:string; responseOptions:string[]; status:"draft"|"active"; }
   interface BranchRule { id:string; planId:string; when:"know"|"dont_know"|"other"|"free_text"; action:"send_topic"|"ask_category"|"reply"|"keyword_match"; targetTopicId?:string; replyText?:string; nextDay?:1|2|3; }
9. Data architecture must be segment + day + user state, not day alone, so later revive/non-acquire segments can be added without redesign.
10. Use real icons from the project’s existing icon library; do not use emoji as UI icons. Keep the interface clean, low-density, and operationally understandable.

FUNCTIONAL VERIFICATION
- Compile clean.
- Verify demo player login, Admin entry, Day tabs, all three player response branches, free-text matching, Admin navigation, editing Daily Plan, selecting a topic, saving/activating status, rule editing, preview updates, and source mapping.
- Preserve all 48 topics and existing routing rules.
- Stop after verification. Do not publish.