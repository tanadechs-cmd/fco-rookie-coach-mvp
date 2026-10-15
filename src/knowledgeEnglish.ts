/**
 * English drafts of the existing Thai knowledge defaults, not new game guidance.
 * source* snapshots let the caller detect Thai edits before reusing a translation.
 * Empty steps are deliberate: a video summary is not a verified transcript.
 */
export type EnglishKnowledgeEntry = {
  title: string;
  text: string;
  keywords: string[];
  keyboardSteps: string[];
  xboxSteps: string[];
  playstationSteps: string[];
  sourceText: string;
  sourceKeyboardSteps: string[];
  sourceXboxSteps: string[];
  sourcePlaystationSteps: string[];
};

type StepTranslations = Pick<EnglishKnowledgeEntry,
  "keyboardSteps" | "xboxSteps" | "playstationSteps" |
  "sourceKeyboardSteps" | "sourceXboxSteps" | "sourcePlaystationSteps"
>;

function entry(
  title: string,
  text: string,
  keywords: string[],
  sourceText: string,
  steps?: StepTranslations,
): EnglishKnowledgeEntry {
  return {
    title, text, keywords, sourceText,
    keyboardSteps: [], xboxSteps: [], playstationSteps: [],
    sourceKeyboardSteps: [], sourceXboxSteps: [], sourcePlaystationSteps: [],
    ...steps,
  };
}

function sharedSteps(english: string[], thai: string[]): StepTranslations {
  return {
    keyboardSteps: [...english], xboxSteps: [...english], playstationSteps: [...english],
    sourceKeyboardSteps: [...thai], sourceXboxSteps: [...thai], sourcePlaystationSteps: [...thai],
  };
}

export const ENGLISH_KNOWLEDGE: Record<string, EnglishKnowledgeEntry> = {
  passing: entry(
    "Three ways to pass",
    "There are three main types of pass. Choose one to suit the situation.",
    ["pass", "passing", "pass the ball", "how to pass", "short pass", "through ball", "cross the ball", "crossing"],
    "มี 3 วิธีส่งบอลหลัก ใช้ให้ถูกสถานการณ์",
    {
      keyboardSteps: ["Press S for a short pass", "Press A to cross", "Press W for a through ball"],
      xboxSteps: ["Press A for a short pass", "Press X to cross", "Press Y for a through ball"],
      playstationSteps: ["Press ✕ for a short pass", "Press □ to cross", "Press △ for a through ball"],
      sourceKeyboardSteps: ["กด S ส่งบอลสั้น", "กด A เปิดบอล", "กด W แทงทะลุช่อง"],
      sourceXboxSteps: ["กด A ส่งบอลสั้น", "กด X เปิดบอล", "กด Y แทงทะลุช่อง"],
      sourcePlaystationSteps: ["กด ✕ ส่งบอลสั้น", "กด □ เปิดบอล", "กด △ แทงทะลุช่อง"],
    },
  ),
  defending: entry(
    "Defending: slide, jockey and tackle",
    "Defend more effectively with jockeying and well-timed tackles.",
    ["defend", "defending", "defense", "defence", "how to defend", "play defense", "play defence", "tackle", "jockey", "slide tackle"],
    "รับให้แน่นด้วย Jockey และเวลาสกัดที่ถูกต้อง",
    {
      keyboardSteps: ["Hold C to jockey", "Press D to tackle", "Press A to slide tackle"],
      xboxSteps: ["Hold LT to jockey", "Press B to tackle", "Press X to slide tackle"],
      playstationSteps: ["Hold L2 to jockey", "Press ○ to tackle", "Press □ to slide tackle"],
      sourceKeyboardSteps: ["กด C ค้างเพื่อ Jockey", "กด D เพื่อเข้าสกัด", "กด A เพื่อ Slide Tackle"],
      sourceXboxSteps: ["กด LT ค้างเพื่อ Jockey", "กด B เพื่อเข้าสกัด", "กด X เพื่อ Slide Tackle"],
      sourcePlaystationSteps: ["กด L2 ค้างเพื่อ Jockey", "กด ○ เพื่อเข้าสกัด", "กด □ เพื่อ Slide Tackle"],
    },
  ),
  dribbling: entry(
    "How to dribble",
    "Start with basic dribbling to get past opponents.",
    ["dribble", "dribbling", "how to dribble", "dribble the ball", "ball control", "sprint"],
    "เลี้ยงบอลพื้นฐานให้หลุดคู่แข่งตั้งแต่แรก",
    {
      keyboardSteps: ["Use the direction keys to dribble", "Press C to shield the ball", "Hold E to sprint"],
      xboxSteps: ["Use the left stick to dribble", "Press LT to shield the ball", "Hold RT to sprint"],
      playstationSteps: ["Use the left stick to dribble", "Press L2 to shield the ball", "Hold R2 to sprint"],
      sourceKeyboardSteps: ["ใช้ปุ่มทิศทางเพื่อเลี้ยงบอล", "กด C เพื่อบังบอล", "กด E ค้างเพื่อ Sprint"],
      sourceXboxSteps: ["ใช้อนาล็อกซ้ายเพื่อเลี้ยงบอล", "กด LT เพื่อบังบอล", "กด RT ค้างเพื่อ Sprint"],
      sourcePlaystationSteps: ["ใช้อนาล็อกซ้ายเพื่อเลี้ยงบอล", "กด L2 เพื่อบังบอล", "กด R2 ค้างเพื่อ Sprint"],
    },
  ),
  shooting: entry(
    "Improve your finishing",
    "Make finishing easier with timing and direction.",
    ["shoot", "shooting", "how to shoot", "shoot the ball", "score a goal", "finishing", "shoot accurately"],
    "จบสกอร์ง่ายขึ้นด้วยจังหวะและทิศทาง",
    {
      keyboardSteps: ["Press D to shoot", "Use the direction keys to aim", "Start with about 1–2 bars of shot power"],
      xboxSteps: ["Press B to shoot", "Aim with the left stick", "Start with about 1–2 bars of shot power"],
      playstationSteps: ["Press ○ to shoot", "Aim with the left stick", "Start with about 1–2 bars of shot power"],
      sourceKeyboardSteps: ["กด D เพื่อยิง", "กดปุ่มทิศทางเพื่อเล็ง", "เริ่มจากแรงยิงประมาณ 1–2 ขีด"],
      sourceXboxSteps: ["กด B เพื่อยิง", "เล็งด้วยอนาล็อกซ้าย", "เริ่มจากแรงยิงประมาณ 1–2 ขีด"],
      sourcePlaystationSteps: ["กด ○ เพื่อยิง", "เล็งด้วยอนาล็อกซ้าย", "เริ่มจากแรงยิงประมาณ 1–2 ขีด"],
    },
  ),
  "welcome-pass": entry(
    "Welcome to FCO Pass",
    "Use 1 BP to get a starter team and get going.",
    ["welcome pass", "welcome to fco pass", "starter rewards", "new player rewards", "earn bp", "make money", "earn money", "get rewards"],
    "ใช้ 1 BP รับทีมเริ่มต้นพร้อมเดินหน้าได้เลย",
    sharedSteps(
      ["Open Welcome Pass", "Pay 1 BP", "Claim your starter team and items"],
      ["เข้าเมนู Welcome Pass", "จ่าย 1 BP", "รับทีมและไอเทมเริ่มต้น"],
    ),
  ),
  controller: entry(
    "Connect a controller to your PC",
    "Set up your controls before playing to learn the buttons more easily.",
    ["controller", "connect a controller", "connect my controller", "controller setup", "gamepad", "keyboard setup"],
    "ตั้งค่าอุปกรณ์ควบคุมก่อนลงสนาม จะช่วยให้จำปุ่มได้เร็วขึ้น",
    {
      keyboardSteps: ["Open Settings > Control", "Select Keyboard and check your preferred keys", "Try them in the practice field before a match"],
      xboxSteps: ["Connect by USB or Bluetooth", "Open Settings > Control and select Xbox Controller", "Try the XYAB buttons in the practice field"],
      playstationSteps: ["Connect by USB or Bluetooth", "Open Settings > Control and select PlayStation Controller", "Try the □ △ ○ ✕ buttons in the practice field"],
      sourceKeyboardSteps: ["เข้า Settings > Control", "เลือก Keyboard และเช็กปุ่มที่ถนัด", "ทดลองในสนามฝึกก่อนลงแข่ง"],
      sourceXboxSteps: ["เสียบ USB หรือเชื่อม Bluetooth", "เข้า Settings > Control แล้วเลือก Xbox Controller", "ทดลองปุ่ม XYAB ในสนามฝึก"],
      sourcePlaystationSteps: ["เสียบ USB หรือเชื่อม Bluetooth", "เข้า Settings > Control แล้วเลือก PlayStation Controller", "ทดลองปุ่ม □ △ ○ ✕ ในสนามฝึก"],
    },
  ),
  qss: entry(
    "Free teams with QSS",
    "QSS provides ready-to-use teams for free, so you do not need to build one yourself.",
    ["qss", "quick squad select", "free team", "starter team", "ready made team"],
    "QSS คือทีมพร้อมใช้ฟรี ไม่ต้องสร้างเอง",
    sharedSteps(
      ["Open Quick Squad Select", "Choose a team you like", "Start playing right away"],
      ["เข้าเมนู Quick Squad Select", "เลือกทีมที่ชื่นชอบ", "ลงสนามได้ทันที"],
    ),
  ),
  "passing-basic": entry(
    "Passing basics",
    "A guide to safer passing, avoiding misplaced passes and choosing where to pass.",
    ["passing basics", "safe passing", "misplaced passes", "keep losing passes"],
    "อธิบายหลักการจ่ายบอลให้ปลอดภัย ลดการส่งเสีย และเลือกพื้นที่จ่ายที่เหมาะสม",
  ),
  "dribbling-basic": entry(
    "Dribbling basics",
    "A guide to controlling and dribbling the ball for smoother changes of direction.",
    ["dribbling basics", "change direction", "dribble smoothly"],
    "แนะนำการควบคุมและเลี้ยงบอลเพื่อเปลี่ยนทิศทางได้ลื่นไหลขึ้น",
  ),
  attack: entry(
    "Three steps for attacking",
    "An overview of three attacking steps for creating scoring chances.",
    ["attacking", "how to attack", "create chances", "attacking play"],
    "สรุปแนวคิดเกมรุก 3 ขั้นตอนสำหรับสร้างโอกาสทำประตู",
  ),
  "defending-basic": entry(
    "Defending basics",
    "Basic defensive tips for slowing attacks, intercepting passes and conceding fewer goals.",
    ["defending basics", "defensive tips", "intercept passes", "concede fewer goals"],
    "แนะนำทริคเกมรับพื้นฐานเพื่อชะลอเกม ตัดบอล และลดการเสียประตู",
  ),
  goalkeeper: entry(
    "Move your goalkeeper",
    "A guide to moving the goalkeeper to narrow shooting angles at important moments.",
    ["goalkeeper", "move the keeper", "move my goalkeeper", "goalkeeper movement", "close the angle"],
    "อธิบายการขยับผู้รักษาประตูเพื่อปิดมุมยิงในจังหวะสำคัญ",
  ),
  forwards: entry(
    "Three budget forwards",
    "An introduction to three budget forwards for starting your squad.",
    ["budget forwards", "cheap strikers", "budget strikers", "affordable forwards"],
    "แนะนำกองหน้าราคาประหยัด 3 ตัวสำหรับเริ่มจัดทีม",
  ),
  untrade: entry(
    "What does Untrade mean?",
    "An explanation of Untrade players or items and their trading restrictions.",
    ["untrade", "untradeable", "untradable", "cannot sell a player", "can't sell a player"],
    "อธิบายความหมายของนักเตะหรือไอเทม Untrade และข้อจำกัดในการซื้อขาย",
  ),
  "transfer-market": entry(
    "Transfer Market",
    "A guide to searching for, buying and selling players in the Transfer Market.",
    ["transfer market", "buy players", "sell players", "buy a player", "sell a player", "player market"],
    "แนะนำการใช้งาน Transfer Market เพื่อค้นหา ซื้อ และขายนักเตะ",
  ),
  ranking: entry(
    "Ranking 1v1",
    "Practise the basics before entering Ranking matches.",
    ["ranking", "ranked matches", "ranked mode", "1v1", "climb the ranks"],
    "แนะนำฝึกขั้นพื้นฐานให้ครบก่อน แล้วค่อยลง Ranking",
    sharedSteps(
      ["Practise until you can win some Kick-Off matches", "Learn how BP works", "Start Division Rivals when you are ready"],
      ["ฝึกจนชนะ Kick-Off ได้บ้าง", "ทำความเข้าใจระบบ BP", "เริ่ม Division Rivals เมื่อพร้อม"],
    ),
  ),
  "mission-hub": entry(
    "Mission Hub",
    "A guide to checking missions and claiming rewards in Mission Hub.",
    ["mission hub", "daily missions", "claim rewards", "mission rewards", "complete missions"],
    "แนะนำ Mission Hub สำหรับตรวจภารกิจและรับรางวัล",
  ),
  camera: entry(
    "FC Online camera angles",
    "An overview of FC Online camera options to help you choose a view that suits your play.",
    ["camera", "camera angle", "camera settings", "change the camera", "change view"],
    "อธิบายตัวเลือกมุมกล้องใน FC Online เพื่อเลือกมุมที่เหมาะกับการเล่น",
  ),
  "locker-room": entry(
    "Locker Room",
    "An explanation of the Locker Room menu for customising appearance and equipment.",
    ["locker room", "change kit", "change uniform", "customise appearance", "customize appearance"],
    "อธิบายเมนู Locker Room สำหรับปรับแต่งรูปลักษณ์และอุปกรณ์",
  ),
  "player-role": entry(
    "Player roles",
    "An explanation of player roles and their effect on behaviour on the pitch.",
    ["player role", "player roles", "on pitch behaviour", "on pitch behavior"],
    "อธิบายบทบาทนักเตะและผลต่อพฤติกรรมในสนาม",
  ),
  fp: entry(
    "What is FP?",
    "An explanation of FP, or Fantasy Point, and its uses in the game.",
    ["fp", "fantasy point", "fantasy points"],
    "อธิบาย FP หรือ Fantasy Point และการใช้งานภายในเกม",
  ),
  "protection-card": entry(
    "Enhancement protection cards",
    "An explanation of protection cards and how they help reduce enhancement risk.",
    ["protection card", "enhancement protection", "upgrade protection"],
    "อธิบายการ์ดกันแตกและการใช้เพื่อลดความเสี่ยงในการเสริมพลัง",
  ),
  "tax-coupon": entry(
    "Tax discount coupons",
    "An explanation of tax discount coupons and how they reduce selling fees.",
    ["tax coupon", "tax discount", "selling fees", "reduce tax", "market tax"],
    "อธิบายคูปองลดภาษีและการใช้เพื่อลดค่าธรรมเนียมจากการขาย",
  ),
  "trend-center": entry(
    "Trend Center",
    "An explanation of Trend Center for viewing player trends and information.",
    ["trend center", "player trends", "player information"],
    "อธิบาย Trend Center สำหรับดูแนวโน้มและข้อมูลนักเตะ",
  ),
  "lucky-wheel": entry(
    "Lucky Wheel",
    "An introduction to Lucky Wheel and how to take part in the wheel-spinning event.",
    ["lucky wheel", "spin the wheel", "wheel event"],
    "แนะนำ Lucky Wheel และขั้นตอนเข้าร่วมกิจกรรมหมุนวงล้อ",
  ),
  "acrobatic-finisher": entry(
    "Acrobatic Finisher trait",
    "An explanation of the Acrobatic Finisher trait and the situations where it has an effect.",
    ["acrobatic finisher", "acrobatic finisher trait"],
    "อธิบายคุณสมบัติ Acrobatic Finisher และสถานการณ์ที่มีผล",
  ),
  commander: entry(
    "Commander trait",
    "An explanation of the Commander trait and its role in the team.",
    ["commander", "commander trait"],
    "อธิบายคุณสมบัติ Commander และบทบาทที่เกี่ยวข้องในทีม",
  ),
  "plus8-trait": entry(
    "Special traits for +8 players",
    "An explanation of special traits for players at enhancement level +8.",
    ["+8", "plus eight", "plus 8", "enhancement traits"],
    "อธิบายคุณสมบัติพิเศษของนักเตะระดับเสริมพลัง +8",
  ),
  bp: entry(
    "BP",
    "An explanation of BP, the main currency for trading and other uses in the game.",
    ["bp", "what is bp", "bp currency", "in game currency"],
    "อธิบาย BP ซึ่งเป็นสกุลเงินหลักสำหรับซื้อขายและใช้งานในเกม",
  ),
  cp: entry(
    "CP",
    "An explanation of CP and where it can be used.",
    ["cp", "what is cp", "cp coins"],
    "อธิบาย CP และช่องทางใช้งานที่เกี่ยวข้อง",
  ),
  sc: entry(
    "SC",
    "An explanation of SC and where it can be used.",
    ["sc", "what is sc", "sc coins"],
    "อธิบาย SC และช่องทางใช้งานที่เกี่ยวข้อง",
  ),
  sp: entry(
    "SP",
    "An explanation of SP, or Star Point, and where it can be used.",
    ["sp", "star point", "star points"],
    "อธิบาย SP หรือ Star Point และช่องทางใช้งานที่เกี่ยวข้อง",
  ),
  tc: entry(
    "TC",
    "An explanation of TC and where it can be used.",
    ["tc", "what is tc", "tc coins"],
    "อธิบาย TC และช่องทางใช้งานที่เกี่ยวข้อง",
  ),
  shop: entry(
    "Shop",
    "An introduction to the Shop menu and choosing items to buy.",
    ["shop", "item shop", "buy items", "in game shop"],
    "แนะนำเมนู Shop และแนวทางเลือกซื้อไอเทม",
  ),
  "redeem-code": entry(
    "Redeem an FC Online code",
    "A guide to entering an FC Online redeem code.",
    ["redeem code", "redeem a code", "enter a code", "redemption code"],
    "แนะนำขั้นตอนกรอก Redeem Code ของ FC Online",
  ),
  "tactic-training": entry(
    "Tactic training",
    "An explanation of the tactic training system for adjusting how your team plays.",
    ["tactic training", "tactical training", "train tactics", "team tactics"],
    "อธิบายระบบฝึกแทคติกเพื่อปรับแนวทางการเล่นของทีม",
  ),
  "special-training": entry(
    "Special training",
    "An explanation of the special training system for developing player abilities.",
    ["special training", "develop players", "player abilities"],
    "อธิบายระบบฝึกพิเศษเพื่อพัฒนาความสามารถนักเตะ",
  ),
  "training-coach": entry(
    "Training coaches",
    "An explanation of training coaches and how to use them with your team.",
    ["training coach", "training coaches", "use coaches", "assign a coach"],
    "อธิบายโค้ชฝึกฝนและวิธีนำมาใช้กับทีม",
  ),
  "cheap-french-defenders": entry(
    "Three budget French defenders",
    "An introduction to three budget French defenders for building your squad.",
    ["french defenders", "cheap defenders", "budget defenders", "budget french defenders"],
    "แนะนำกองหลังฝรั่งเศสราคาประหยัด 3 ตัวสำหรับจัดทีม",
  ),
  "pro-turn": entry(
    "Turning past opponents with Attaclex",
    "A guide to using turns to beat opponents and create space in attack.",
    ["turning technique", "turn past defenders", "feint turn", "attaclex turn"],
    "สอนเทคนิคกลับตัวหลอกคู่แข่งเพื่อสร้างพื้นที่ในเกมรุก",
  ),
  "creative-run": entry(
    "Creative Run with Attaclex",
    "A guide to Creative Run for directing runs and creating more attacking options.",
    ["creative run", "direct runs", "trigger runs", "attacking runs"],
    "สอน Creative Run เพื่อสั่งการวิ่งและเพิ่มทางเลือกในเกมรุก",
  ),
  "ball-roll": entry(
    "Ball Roll with JubJub",
    "A guide to the Ball Roll skill for avoiding opponents and keeping possession.",
    ["ball roll", "ballroll", "jubjub"],
    "สอนทักษะ Ball Roll เพื่อหลบคู่แข่งและรักษาการครองบอล",
  ),
  "shield-ball": entry(
    "Shielding the ball",
    "A guide to shielding the ball to keep possession under pressure.",
    ["shield the ball", "shielding", "shield ball", "keep possession", "protect the ball"],
    "สอนเทคนิคบังบอลเพื่อรักษาการครองบอลเมื่อถูกกดดัน",
  ),
  "july-update": entry(
    "July update with Mr. John",
    "A July update summary by Mr. John, reflecting the patch at the time of publication.",
    ["july update", "july patch", "mr john", "mr. john", "patch 26.06"],
    "สรุปอัปเดตเดือนกรกฎาคมโดย Mr. John — ข้อมูลตามแพตช์ช่วงเวลาที่เผยแพร่",
  ),
  "two-button-dribble": entry(
    "Two-button dribbling with TD Keane",
    "A guide to two-button dribbling by TD Keane.",
    ["two button dribbling", "two-button dribbling", "2 button dribble", "td keane"],
    "สอนการเลี้ยงบอลแบบสองปุ่มโดย TD Keane",
  ),
  "august-update": entry(
    "August 2026 update",
    "An August 2026 update summary: FP increased to 310, Spartans, Ranking Master and the Transfer Market.",
    ["august update", "august 2026 update", "august patch", "fp 310", "spartans", "ranking master"],
    "สรุปอัปเดตเดือนสิงหาคม 2569 — FP เพิ่มเป็น 310, Spartans, Ranking Master, ตลาดนักเตะ",
  ),
  "weekly-update-10-aug": entry(
    "Weekly update: 10–16 August 2026",
    "FC Online events, news and updates for the week of 10–16 August 2026.",
    ["10 august update", "august 10 update", "10–16 august", "10-16 august", "august 10-16"],
    "รวมกิจกรรม ข่าวสาร และอัปเดต FC Online ประจำสัปดาห์ 10–16 สิงหาคม 2569",
  ),
  "september-update": entry(
    "September update: 24 August 2026 patch",
    "A summary of the 24 August 2026 patch: BP, Team Color, opponent kits, Challenger, Discord, QSS and Pro League Summer 2026.",
    ["september update", "september patch", "24 august patch", "august 24 patch", "pro league summer 2026"],
    "สรุปแพตช์ 24 สิงหาคม 2569 — BP, Team Color, เสื้อคู่แข่ง, Challenger, Discord, QSS, Pro League Summer 2026",
  ),
  // This pre-existing canned answer is outside the 48 Educational Hub records.
  "mode-start": entry(
    "Choose your first game mode",
    "For beginners, start with Kick-Off or Season Mode.",
    ["first game mode", "which mode", "kick-off", "season mode"],
    "มือใหม่แนะนำ Kick-Off หรือ Season Mode ก่อน",
    sharedSteps(
      ["Choose Kick-Off for a quick match", "Try Season Mode for ongoing play", "Avoid Rivals until you are more comfortable"],
      ["เลือก Kick-Off สำหรับเกมด่วน", "ลอง Season Mode เพื่อความต่อเนื่อง", "หลีกเลี่ยง Rivals จนกว่าจะชำนาญ"],
    ),
  ),
};

export const FAQ_ENGLISH_BY_QUESTION: Record<string, string> = {
  "หาเงินจากไหน": "How do I earn BP?",
  "ส่งบอลยังไง": "How do I pass?",
  "เล่นเกมรับยังไง": "How do I defend?",
  "ยิงยังไงให้คม": "How do I shoot accurately?",
  "เชื่อมจอยยังไง": "How do I connect a controller?",
  "หา BP และรางวัลยังไง": "How do I earn BP and rewards?",
};
