Re-sync only the local knowledge layer in the current prototype. Preserve all current Version 5 UI, Day 1–3 FAQs, chat layout, cards, navigation, login, and styling. Do not add a backend, live API, file upload, new screen, or publish.

SOURCE OF TRUTH
Google Sheet: [FCO] Educational hub knowledge
Spreadsheet ID: 1tEPi1p5VZ5qkm2I6FKthm2TJ4i-uAFPDNpW5fzLb5YA
Latest sync log: RUN-20260828-01 at 2026-08-28T10:50:26.777Z
Source has 48 published topics. This chatbot is onboarding-first, so sync an explicit 18-topic onboarding allowlist only. Do not include FCO-EDU-046 to 048 because they are time-sensitive update content outside the first-three-day scope. Do not use raw transcript/key_content fields.

Update KnowledgeItem to include:
topicId, title, category, audience, durationSec, shortSummary, keywords, youtubeUrl, thumbnailUrl?: string, qaStatus, sourceUpdatedAt.
Keep source='FC Online Education Hub'. Add exported/source metadata constants:
KNOWLEDGE_SOURCE_TITLE='[FCO] Educational hub knowledge'
KNOWLEDGE_SOURCE_URL='https://docs.google.com/spreadsheets/d/1tEPi1p5VZ5qkm2I6FKthm2TJ4i-uAFPDNpW5fzLb5YA/edit?gid=0#gid=0'
KNOWLEDGE_SYNC_RUN='RUN-20260828-01'
KNOWLEDGE_SYNCED_AT='2026-08-28T10:50:26.777Z'
KNOWLEDGE_SOURCE_TOPIC_COUNT=48
KNOWLEDGE_ONBOARDING_TOPIC_COUNT=18

REPLACE/MERGE THE LOCAL COLLECTION WITH THESE 18 SHEET ROWS
1. FCO-EDU-001 | วิธียิงคม | แนะนำผู้เล่นใหม่ | beginner | 29 | สอนแนวทางจบสกอร์ให้คมขึ้น ทั้งการยิงปกติและการยิงปั่นตามสถานการณ์ | keywords ยิง, ยิงคม, จบสกอร์, shooting | https://youtu.be/k1Xk7uOGu7M | thumbnail keep existing shooting CDN | needs_review | 2026-07-08T03:00:24.071Z
2. FCO-EDU-002 | วิธีการส่ง | แนะนำผู้เล่นใหม่ | beginner | 37 | อธิบายหลักการจ่ายบอลให้ปลอดภัย ลดการส่งเสีย และเลือกพื้นที่จ่ายที่เหมาะสม | keywords ส่ง, ส่งบอล, จ่ายบอล, passing | https://youtu.be/Shsd0jh_VRQ | no thumbnail | needs_review | 2026-07-07T11:48:24.000Z
3. FCO-EDU-003 | วิธีการเลี้ยง | แนะนำผู้เล่นใหม่ | beginner | 26 | แนะนำการควบคุมและเลี้ยงบอลเพื่อเปลี่ยนทิศทางได้ลื่นไหลขึ้น | keywords เลี้ยง, เลี้ยงบอล, dribble | https://youtu.be/gtJzPt0jIlE | no thumbnail | needs_review | 2026-07-03T04:02:20.000Z
4. FCO-EDU-004 | 3 ขั้นตอนเกมรุก | แนะนำผู้เล่นใหม่ | beginner | 20 | สรุปแนวคิดเกมรุก 3 ขั้นตอนสำหรับสร้างโอกาสทำประตู | keywords เกมรุก, สร้างโอกาส, attack | https://youtu.be/2DWufwK3Lzs | no thumbnail | needs_review | 2026-07-05T12:27:17.871Z
5. FCO-EDU-005 | วิธีเล่นเกมรับ | แนะนำผู้เล่นใหม่ | beginner | 54 | แนะนำทริคเกมรับพื้นฐานเพื่อชะลอเกม ตัดบอล และลดการเสียประตู | keywords เกมรับ, ป้องกัน, ตัดบอล, defend | https://youtu.be/6S441RBaYF4 | no thumbnail | needs_review | 2026-07-05T11:37:13.118Z
6. FCO-EDU-006 | ขยับบังโกล | แนะนำผู้เล่นใหม่ | beginner | 34 | อธิบายการขยับผู้รักษาประตูเพื่อปิดมุมยิงในจังหวะสำคัญ | keywords โกล, ผู้รักษาประตู, ขยับโกล, goalkeeper | https://youtu.be/SsSsCjoPF44 | no thumbnail | needs_review | 2026-07-05T11:35:43.612Z
7. FCO-EDU-007 | Welcome To FCO Pass | แนะนำผู้เล่นใหม่ | beginner | 25 | แนะนำ Welcome Pass และรางวัลสำหรับผู้เล่นใหม่ | keywords welcome pass, pass, รางวัล, 1 BP | https://youtu.be/Af0rdn_1aQk | thumbnail keep existing Welcome Pass CDN | needs_review | 2026-07-05T11:27:32.464Z
8. FCO-EDU-008 | 3 กองหน้าราคาถูก | แนะนำผู้เล่นใหม่ | beginner | 36 | แนะนำกองหน้าราคาประหยัด 3 ตัวสำหรับเริ่มจัดทีม | keywords กองหน้า, นักเตะราคาถูก, จัดทีม | https://youtu.be/QYnj7Y3aB3k | no thumbnail | needs_review | 2026-07-05T11:39:56.549Z
9. FCO-EDU-009 | Untrade คืออะไร | แนะนำผู้เล่นใหม่ | beginner | 19 | อธิบายความหมายของนักเตะหรือไอเทม Untrade และข้อจำกัดในการซื้อขาย | keywords untrade, ขายไม่ได้, ไอเทม | https://youtu.be/z63PZoSi9DE | no thumbnail | needs_review | 2026-07-05T12:04:55.152Z
10. FCO-EDU-010 | Transfer Market | แนะนำผู้เล่นใหม่ | beginner | 45 | แนะนำการใช้งาน Transfer Market เพื่อค้นหา ซื้อ และขายนักเตะ | keywords transfer market, ตลาดนักเตะ, ซื้อ, ขาย | https://youtu.be/i9dTl9JIcVw | no thumbnail | needs_review | 2026-07-05T12:22:24.919Z
11. FCO-EDU-016 | Ranking 1v1 | ข้อมูลพิ้นฐาน | general | 27 | แนะนำโหมด Ranking 1v1 และภาพรวมการไต่ระดับ | keywords ranking, rank, 1v1, จัดอันดับ | https://youtu.be/VTaEY9nbqM8 | no thumbnail | transcript_pending | 2026-07-05T11:38:38.434Z
12. FCO-EDU-018 | Mission Hub | ข้อมูลพิ้นฐาน | general | 22 | แนะนำ Mission Hub สำหรับตรวจภารกิจและรับรางวัล | keywords mission hub, ภารกิจ, รับรางวัล | https://youtu.be/vEae-Lg2XEg | no thumbnail | transcript_pending | 2026-07-05T11:38:15.298Z
13. FCO-EDU-029 | มุมกล้องทั้งหมดใน FC Online | ข้อมูลพิ้นฐาน | general | 40 | อธิบายตัวเลือกมุมกล้องใน FC Online เพื่อเลือกมุมที่เหมาะกับการเล่น | keywords กล้อง, มุมกล้อง, camera | https://youtu.be/L8Eyy8dbooM | no thumbnail | transcript_pending | 2026-07-05T12:04:50.111Z
14. FCO-EDU-030 | เชื่อมจอยเล่นบนคอม | ข้อมูลพิ้นฐาน | general | 17 | แนะนำวิธีเชื่อมต่อจอยเพื่อเล่น FC Online บนคอมพิวเตอร์ | keywords จอย, controller, เชื่อมจอย, ตั้งค่าจอย | https://youtu.be/nDZtAeDBdMw | thumbnail keep existing controller CDN | transcript_pending | 2026-07-05T11:36:16.706Z
15. FCO-EDU-041 | ทีมฟรีจาก QSS | เล่นด่วน | general | 34 | แนะนำการจัดทีมฟรีจาก QSS สำหรับผู้เล่นที่เพิ่งเริ่มต้น | keywords QSS, ทีมฟรี, ทีมเริ่มต้น | https://youtu.be/umx4PwXwAkI | thumbnail keep existing QSS CDN | needs_review | 2026-07-16T12:07:02.431Z
16. FCO-EDU-043 | ส่งบอลมีกี่วิธี | ข้อมูลพิ้นฐาน | general | 75 | สรุปวิธีจ่ายบอลพื้นฐาน 3 รูปแบบและสถานการณ์ใช้งาน | keywords ส่งบอล, จ่ายบอล, แทง, เปิดบอล, passing | https://youtu.be/MfXuFcwWMW0 | thumbnail keep existing passing CDN | needs_review | 2026-07-15T11:36:21.000Z
17. FCO-EDU-044 | เกมรับ สไลด์/จ๊อกกี้/เข้าสกัด | ข้อมูลพิ้นฐาน | general | 56 | สรุปพื้นฐานเกมรับ ได้แก่ สไลด์ จ๊อกกี้ และการเข้าสกัด | keywords เกมรับ, สไลด์, จ๊อกกี้, เข้าสกัด, defending | https://youtu.be/uJV8WoUvDCo | thumbnail keep existing defending CDN | needs_review | 2026-07-16T12:04:18.643Z
18. FCO-EDU-045 | วิธีเลี้ยงบอล | ข้อมูลพิ้นฐาน | general | 35 | สอนพื้นฐานการเลี้ยงบอลและการควบคุมทิศทาง | keywords เลี้ยงบอล, ควบคุมทิศทาง, dribbling | https://youtu.be/pSGV7mzMCWs | thumbnail keep existing dribbling CDN | needs_review | 2026-07-16T04:34:16.000Z

SYNC / ROUTING RULES
- Deduplicate overlapping concepts by matching the most specific keyword first. Prefer 043 over 002 for “ส่งบอลพื้นฐาน”, 045 over 003 for “เลี้ยงบอลพื้นฐาน”, and 044 over 005 for “สไลด์/จ๊อกกี้/เข้าสกัด”.
- Keep Day 1–3 FAQ behavior exactly as now.
- Chat can match all 18 items.
- For an item without thumbnail, show a compact text-only source card with title, duration, source, and “ดูวิดีโอ”; do not use a placeholder image.
- Do not expose qaStatus to players. Treat qaStatus as an internal guard: summaries and metadata may be used, but do not generate detailed control instructions from transcript_pending items beyond the curated shortSummary.
- Add a tiny non-intrusive source note in Chat empty state: “ฐานความรู้ 18 หัวข้อ • ซิงก์ 28 ส.ค. 2026”. No new settings panel.
- Make sure the existing seven CDN URLs remain unchanged.
- Verify TypeScript compile, Day 1–3 FAQs, keyword matches for Untrade, Mission Hub, camera, Ranking, and QSS, text-only cards, image cards, and mobile layout. Do not publish.