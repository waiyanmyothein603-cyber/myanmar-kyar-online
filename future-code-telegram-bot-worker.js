const MAIN_MENU = {
  keyboard: [
    ["🎓 AI Video သင်တန်း", "📱 Future Code App"],
    ["✨ AI Pro Account", "💰 သင်တန်းကြေး / ဝယ်ယူရန်"],
    ["🔥 သင်တန်းအသစ်များ", "❓ အမေးများသောမေးခွန်းများ"],
    ["🤖 AI Assistant", "👨‍💻 Admin နှင့်ဆက်သွယ်ရန်"],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

const CONTENT_LABELS = {
  welcome: "👋 ကြိုဆိုစာ",
  course_info: "🎓 သင်တန်းအကြောင်း",
  app_info: "📱 Future Code App",
  pro_info: "✨ AI Pro Account",
  pricing: "💰 သင်တန်းကြေး / ဝယ်ယူရန်",
  contact_info: "👨‍💻 ဆက်သွယ်ရန်",
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  telegram_id INTEGER PRIMARY KEY,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  language_code TEXT,
  is_blocked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bot_content (
  key TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS faqs (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  url TEXT,
  is_published INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  content TEXT,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_sessions (
  telegram_id INTEGER PRIMARY KEY,
  state TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS broadcast_jobs (
  id TEXT PRIMARY KEY,
  admin_chat_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  source_chat_id INTEGER,
  message_id INTEGER,
  text_payload TEXT,
  parse_mode TEXT,
  last_user_id INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);
`;

let schemaReady = null;

function nowIso() {
  return new Date().toISOString();
}

function adminIds(env) {
  return new Set(
    String(env.ADMIN_USER_IDS || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => Number(x))
      .filter(Number.isFinite)
  );
}

function isAdmin(env, id) {
  return adminIds(env).has(Number(id));
}

async function ensureDb(env) {
  if (!schemaReady) {
    schemaReady = (async () => {
      await env.DB.exec(SCHEMA);
      const defaults = [
        [
          "welcome",
          "👋 ကြိုဆိုစာ",
          "👋 မင်္ဂလာပါ။ Future Code AI Assistant မှ ကြိုဆိုပါတယ်။\n\nAI Video သင်တန်း၊ Future Code App၊ AI Pro Account နဲ့ AI အသုံးပြုနည်းတွေကို ဒီမှာ မေးမြန်းနိုင်ပါတယ်။",
        ],
        [
          "course_info",
          "🎓 သင်တန်းအကြောင်း",
          "🎓 Future Code AI Video Course\n\nAI Video ဖန်တီးခြင်း၊ Prompt ရေးနည်း၊ ChatGPT၊ Gemini၊ Google Flow နဲ့ AI tools တွေကို Beginner ကနေ လက်တွေ့အသုံးချနိုင်အောင် သင်ကြားပေးပါတယ်။",
        ],
        [
          "app_info",
          "📱 Future Code App",
          "📱 Future Code App ထဲမှာ AI Video သင်ခန်းစာများ၊ အသင့်သုံး Prompt များ၊ Prompt Builder၊ Design Tools နဲ့ AI အသုံးပြုနည်း Guide များကို အသုံးပြုနိုင်ပါတယ်။",
        ],
        [
          "pro_info",
          "✨ AI Pro Account",
          "✨ AI Pro Account အကြောင်း အသေးစိတ်အချက်အလက်ကို Admin က ဒီ Bot ထဲကနေ ပြင်ဆင်ထည့်သွင်းနိုင်ပါတယ်။",
        ],
        [
          "pricing",
          "💰 သင်တန်းကြေး / ဝယ်ယူရန်",
          "💰 လက်ရှိသင်တန်းကြေးနှင့် ဝယ်ယူနည်းကို Admin က ဒီနေရာမှာ အချိန်မရွေး ပြင်ဆင်နိုင်ပါတယ်။",
        ],
        [
          "contact_info",
          "👨‍💻 ဆက်သွယ်ရန်",
          "👨‍💻 အသေးစိတ်မေးမြန်းရန် Future Code Admin ကို ဆက်သွယ်နိုင်ပါတယ်။",
        ],
      ];
      const statements = defaults.map(([key, title, content]) =>
        env.DB.prepare(
          "INSERT OR IGNORE INTO bot_content (key,title,content,updated_at) VALUES (?,?,?,?)"
        ).bind(key, title, content, nowIso())
      );
      await env.DB.batch(statements);
    })();
  }
  return schemaReady;
}

async function tg(env, method, payload = {}) {
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const j = await r.json();
  if (!j.ok) {
    const err = new Error(`${method}: ${j.description || "Telegram API error"}`);
    err.telegram = j;
    throw err;
  }
  return j.result;
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function webhookSecret(env) {
  return (await sha256Hex(env.TELEGRAM_BOT_TOKEN)).slice(0, 48);
}

async function setupBot(env, origin) {
  const secret = await webhookSecret(env);
  await tg(env, "setWebhook", {
    url: `${origin}/webhook`,
    secret_token: secret,
    drop_pending_updates: true,
    allowed_updates: ["message", "callback_query"],
  });

  await tg(env, "setMyCommands", {
    commands: [{ command: "start", description: "Bot ကိုစတင်ရန်" }],
  });

  for (const id of adminIds(env)) {
    try {
      await tg(env, "setMyCommands", {
        scope: { type: "chat", chat_id: id },
        commands: [
          { command: "start", description: "Bot ကိုစတင်ရန်" },
          { command: "menu", description: "ပင်မ Menu" },
          { command: "myid", description: "Telegram ID ကြည့်ရန်" },
          { command: "admin", description: "Admin Panel" },
          { command: "cancel", description: "လုပ်ဆောင်ချက် ပယ်ဖျက်ရန်" },
        ],
      });
    } catch (_) {}
  }
  return true;
}

async function upsertUser(env, user) {
  if (!user?.id) return;
  const t = nowIso();
  await env.DB.prepare(`
    INSERT INTO users (telegram_id,username,first_name,last_name,language_code,is_blocked,created_at,last_seen_at)
    VALUES (?,?,?,?,?,0,?,?)
    ON CONFLICT(telegram_id) DO UPDATE SET
      username=excluded.username,
      first_name=excluded.first_name,
      last_name=excluded.last_name,
      language_code=excluded.language_code,
      last_seen_at=excluded.last_seen_at
  `).bind(
    user.id,
    user.username || null,
    user.first_name || null,
    user.last_name || null,
    user.language_code || null,
    t,
    t
  ).run();
}

async function getContent(env, key) {
  const row = await env.DB.prepare("SELECT content FROM bot_content WHERE key=?").bind(key).first();
  return row?.content || null;
}

async function setContent(env, key, content) {
  const title = CONTENT_LABELS[key] || key;
  await env.DB.prepare(`
    INSERT INTO bot_content (key,title,content,updated_at) VALUES (?,?,?,?)
    ON CONFLICT(key) DO UPDATE SET title=excluded.title,content=excluded.content,updated_at=excluded.updated_at
  `).bind(key, title, content, nowIso()).run();
}

async function getSession(env, uid) {
  const row = await env.DB.prepare("SELECT state,data FROM admin_sessions WHERE telegram_id=?").bind(uid).first();
  if (!row) return null;
  let data = {};
  try { data = JSON.parse(row.data || "{}"); } catch (_) {}
  return { state: row.state, data };
}

async function setSession(env, uid, state, data = {}) {
  await env.DB.prepare(`
    INSERT INTO admin_sessions (telegram_id,state,data,updated_at) VALUES (?,?,?,?)
    ON CONFLICT(telegram_id) DO UPDATE SET state=excluded.state,data=excluded.data,updated_at=excluded.updated_at
  `).bind(uid, state, JSON.stringify(data), nowIso()).run();
}

async function clearSession(env, uid) {
  await env.DB.prepare("DELETE FROM admin_sessions WHERE telegram_id=?").bind(uid).run();
}

function adminMenu() {
  return {
    inline_keyboard: [
      [
        { text: "➕ FAQ ထည့်မယ်", callback_data: "adm_faq_add" },
        { text: "📚 FAQ စီမံမယ်", callback_data: "adm_faq_list" },
      ],
      [
        { text: "➕ သင်တန်းထည့်မယ်", callback_data: "adm_course_add" },
        { text: "🎓 သင်တန်းစီမံမယ်", callback_data: "adm_course_list" },
      ],
      [{ text: "📝 Bot စာတွေပြင်မယ်", callback_data: "adm_content" }],
      [{ text: "📢 ကြော်ငြာပို့မယ်", callback_data: "adm_broadcast" }],
      [{ text: "👥 User အရေအတွက်", callback_data: "adm_users" }],
      [{ text: "🏠 User Menu", callback_data: "main" }],
    ],
  };
}

async function sendMessage(env, chatId, text, extra = {}) {
  return tg(env, "sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...extra,
  });
}

async function sendMain(env, chatId, text = "လိုချင်တဲ့အပိုင်းကို ရွေးပါ 👇") {
  return sendMessage(env, chatId, text, { reply_markup: MAIN_MENU });
}

async function showFaqs(env, chatId, adminView = false) {
  const { results = [] } = await env.DB.prepare(
    "SELECT id,question,answer FROM faqs WHERE is_active=1 ORDER BY created_at DESC LIMIT 60"
  ).all();
  if (!results.length) {
    await sendMessage(env, chatId, "FAQ မထည့်ရသေးပါ။", { reply_markup: adminView ? adminMenu() : MAIN_MENU });
    return;
  }
  const rows = results.map((x) => [{
    text: `${adminView ? "🛠" : "❓"} ${String(x.question).slice(0, 50)}`,
    callback_data: `${adminView ? "adm_faq" : "faq"}:${x.id}`,
  }]);
  rows.push([{ text: adminView ? "⬅️ Admin Menu" : "🏠 ပင်မစာမျက်နှာ", callback_data: adminView ? "adm_home" : "main" }]);
  await sendMessage(env, chatId, "❓ အမေးများသောမေးခွန်းများ", { reply_markup: { inline_keyboard: rows } });
}

async function showCourses(env, chatId, adminView = false) {
  const sql = adminView
    ? "SELECT * FROM courses ORDER BY sort_order ASC, created_at DESC LIMIT 40"
    : "SELECT * FROM courses WHERE is_published=1 ORDER BY sort_order ASC, created_at DESC LIMIT 40";
  const { results = [] } = await env.DB.prepare(sql).all();
  if (!results.length) {
    await sendMessage(env, chatId, "လက်ရှိ သင်တန်းစာရင်း မထည့်ရသေးပါ။", { reply_markup: adminView ? adminMenu() : MAIN_MENU });
    return;
  }
  const rows = results.map((x) => [{
    text: adminView ? `${x.is_published ? "✅" : "⏸"} ${String(x.title).slice(0, 50)}` : `🎓 ${String(x.title).slice(0, 50)}`,
    callback_data: `${adminView ? "adm_course" : "course"}:${x.id}`,
  }]);
  rows.push([{ text: adminView ? "⬅️ Admin Menu" : "🏠 ပင်မစာမျက်နှာ", callback_data: adminView ? "adm_home" : "main" }]);
  await sendMessage(env, chatId, "🎓 သင်တန်းစာရင်း", { reply_markup: { inline_keyboard: rows } });
}

async function faqFirst(env, text) {
  const q = String(text || "").trim().toLowerCase();
  if (!q) return null;
  const { results = [] } = await env.DB.prepare(
    "SELECT question,answer FROM faqs WHERE is_active=1 ORDER BY created_at DESC LIMIT 100"
  ).all();
  let best = null;
  let bestScore = 0;
  for (const item of results) {
    const x = String(item.question || "").trim().toLowerCase();
    if (!x) continue;
    if (x === q) return item.answer;
    let score = 0;
    if (q.includes(x) || x.includes(q)) score += 5;
    const a = new Set(q.split(/\s+/).filter(Boolean));
    const b = new Set(x.split(/\s+/).filter(Boolean));
    for (const w of a) if (b.has(w)) score += 1;
    if (score > bestScore) { bestScore = score; best = item.answer; }
  }
  return bestScore >= 3 ? best : null;
}

async function geminiAnswer(env, question) {
  const faq = await faqFirst(env, question);
  if (faq) return faq;
  if (!env.GEMINI_API_KEY) {
    return "ဒီမေးခွန်းအတွက် FAQ မထည့်ရသေးပါ။ Admin ကို ဆက်သွယ်ပေးပါ။";
  }

  const [contents, faqs, courses] = await Promise.all([
    env.DB.prepare("SELECT key,title,content FROM bot_content").all(),
    env.DB.prepare("SELECT question,answer FROM faqs WHERE is_active=1 ORDER BY created_at DESC LIMIT 60").all(),
    env.DB.prepare("SELECT title,description,url FROM courses WHERE is_published=1 ORDER BY sort_order ASC,created_at DESC LIMIT 30").all(),
  ]);
  const knowledge = JSON.stringify({
    content: contents.results || [],
    faqs: faqs.results || [],
    courses: courses.results || [],
  });

  const model = env.GEMINI_MODEL || "gemini-2.5-flash-lite";
  const prompt = `You are Future Code AI Assistant. Reply in clear Burmese. You help users with AI video creation, prompts, Gemini, Google Flow, ChatGPT concepts, and Future Code course/app questions. For Future Code prices, courses, app features or business-specific facts, use ONLY the provided knowledge. If the knowledge does not contain a business-specific fact, say the admin has not added that information yet. Do not invent prices or availability.\n\nFUTURE CODE KNOWLEDGE:\n${knowledge}\n\nUSER QUESTION:\n${question}`;

  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.35, maxOutputTokens: 900 },
    }),
  });
  if (!r.ok) {
    return "အခမဲ့ AI Assistant က လက်ရှိ quota ပြည့်နေခြင်း သို့မဟုတ် ချိတ်ဆက်မှုအခက်အခဲ ရှိနိုင်ပါတယ်။ ခဏနေပြီး ပြန်မေးပါ။";
  }
  const j = await r.json();
  const parts = j?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((p) => p.text || "").join("").trim();
  return text || "အဖြေမရသေးပါ။ ခဏနေပြီး ပြန်မေးပါ။";
}

async function handleAdminState(env, ctx, origin, message, uid, stateObj) {
  const { state, data = {} } = stateObj;
  const text = String(message.text || message.caption || "").trim();

  if (state === "faq_add_question") {
    if (!message.text) return sendMessage(env, uid, "မေးခွန်းကို စာသားနဲ့ပို့ပါ။");
    data.question = message.text.trim();
    await setSession(env, uid, "faq_add_answer", data);
    return sendMessage(env, uid, "အခု ဒီမေးခွန်းအတွက် အဖြေကို ရေးပို့ပါ။");
  }
  if (state === "faq_add_answer") {
    if (!message.text) return sendMessage(env, uid, "အဖြေကို စာသားနဲ့ပို့ပါ။");
    const id = crypto.randomUUID();
    const t = nowIso();
    await env.DB.prepare("INSERT INTO faqs (id,question,answer,is_active,created_at,updated_at) VALUES (?,?,?,1,?,?)")
      .bind(id, data.question, message.text.trim(), t, t).run();
    await clearSession(env, uid);
    return sendMessage(env, uid, "✅ FAQ အသစ်ထည့်ပြီးပါပြီ။", { reply_markup: adminMenu() });
  }
  if (state === "faq_edit_question") {
    if (!message.text) return sendMessage(env, uid, "စာသားနဲ့ပို့ပါ။");
    await env.DB.prepare("UPDATE faqs SET question=?,updated_at=? WHERE id=?").bind(message.text.trim(), nowIso(), data.faq_id).run();
    await clearSession(env, uid);
    return sendMessage(env, uid, "✅ မေးခွန်းပြင်ပြီးပါပြီ။", { reply_markup: adminMenu() });
  }
  if (state === "faq_edit_answer") {
    if (!message.text) return sendMessage(env, uid, "စာသားနဲ့ပို့ပါ။");
    await env.DB.prepare("UPDATE faqs SET answer=?,updated_at=? WHERE id=?").bind(message.text.trim(), nowIso(), data.faq_id).run();
    await clearSession(env, uid);
    return sendMessage(env, uid, "✅ အဖြေပြင်ပြီးပါပြီ။", { reply_markup: adminMenu() });
  }
  if (state === "course_add_title") {
    if (!message.text) return sendMessage(env, uid, "သင်တန်းနာမည်ကို စာသားနဲ့ပို့ပါ။");
    data.title = message.text.trim();
    await setSession(env, uid, "course_add_description", data);
    return sendMessage(env, uid, "သင်တန်းမှာ ဘာတွေသင်မလဲဆိုတာ အသေးစိတ်ရေးပို့ပါ။");
  }
  if (state === "course_add_description") {
    if (!message.text) return sendMessage(env, uid, "Description ကို စာသားနဲ့ပို့ပါ။");
    data.description = message.text.trim();
    await setSession(env, uid, "course_add_url", data);
    return sendMessage(env, uid, "သင်တန်း Link ရှိရင် ပို့ပါ။ မရှိရင် - ပို့ပါ။");
  }
  if (state === "course_add_url") {
    if (!message.text) return sendMessage(env, uid, "Link သို့မဟုတ် - ကို စာသားနဲ့ပို့ပါ။");
    const id = crypto.randomUUID();
    const t = nowIso();
    const url = message.text.trim() === "-" ? null : message.text.trim();
    await env.DB.prepare("INSERT INTO courses (id,title,description,url,is_published,sort_order,created_at,updated_at) VALUES (?,?,?,?,1,0,?,?)")
      .bind(id, data.title, data.description, url, t, t).run();
    await clearSession(env, uid);
    return sendMessage(env, uid, "✅ သင်တန်းအသစ်ထည့်ပြီးပါပြီ။", {
      reply_markup: { inline_keyboard: [
        [{ text: "📢 ဒီသင်တန်းကို ကြော်ငြာမယ်", callback_data: `adm_course_broadcast:${id}` }],
        [{ text: "⬅️ Admin Menu", callback_data: "adm_home" }],
      ] },
    });
  }
  if (state === "content_edit") {
    if (!message.text) return sendMessage(env, uid, "စာသားနဲ့ပို့ပါ။");
    await setContent(env, data.content_key, message.text.trim());
    await clearSession(env, uid);
    return sendMessage(env, uid, "✅ Bot စာသားပြင်ပြီးပါပြီ။", { reply_markup: adminMenu() });
  }
  if (state === "broadcast_wait_message") {
    await clearSession(env, uid);
    const jobId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO broadcast_jobs (id,admin_chat_id,kind,source_chat_id,message_id,last_user_id,sent_count,failed_count,status,created_at)
      VALUES (?,?,?,?,?,0,0,0,'pending',?)
    `).bind(jobId, uid, "copy", message.chat.id, message.message_id, nowIso()).run();
    await sendMessage(env, uid, "📢 User အားလုံးဆီ ပို့နေပါတယ်…");
    ctx.waitUntil(processBroadcastJob(env, jobId, origin));
    return;
  }
  return false;
}

async function createTextBroadcast(env, ctx, origin, adminChatId, text, parseMode = null) {
  const jobId = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO broadcast_jobs (id,admin_chat_id,kind,text_payload,parse_mode,last_user_id,sent_count,failed_count,status,created_at)
    VALUES (?,?, 'text', ?, ?,0,0,0,'pending',?)
  `).bind(jobId, adminChatId, text, parseMode, nowIso()).run();
  ctx.waitUntil(processBroadcastJob(env, jobId, origin));
}

async function processBroadcastJob(env, jobId, origin) {
  const job = await env.DB.prepare("SELECT * FROM broadcast_jobs WHERE id=?").bind(jobId).first();
  if (!job || job.status === "done") return;

  const { results = [] } = await env.DB.prepare(
    "SELECT telegram_id FROM users WHERE is_blocked=0 AND telegram_id>? ORDER BY telegram_id ASC LIMIT 25"
  ).bind(job.last_user_id || 0).all();

  let sent = Number(job.sent_count || 0);
  let failed = Number(job.failed_count || 0);
  let last = Number(job.last_user_id || 0);

  for (const row of results) {
    last = Number(row.telegram_id);
    try {
      if (job.kind === "copy") {
        await tg(env, "copyMessage", {
          chat_id: row.telegram_id,
          from_chat_id: job.source_chat_id,
          message_id: job.message_id,
        });
      } else {
        await tg(env, "sendMessage", {
          chat_id: row.telegram_id,
          text: job.text_payload || "",
          parse_mode: job.parse_mode || undefined,
          disable_web_page_preview: true,
        });
      }
      sent++;
    } catch (e) {
      failed++;
      if (e?.telegram?.error_code === 403) {
        await env.DB.prepare("UPDATE users SET is_blocked=1 WHERE telegram_id=?").bind(row.telegram_id).run();
      }
    }
  }

  const done = results.length < 25;
  await env.DB.prepare(
    "UPDATE broadcast_jobs SET last_user_id=?,sent_count=?,failed_count=?,status=? WHERE id=?"
  ).bind(last, sent, failed, done ? "done" : "running", jobId).run();

  if (done) {
    await env.DB.prepare(
      "INSERT INTO announcements (id,kind,content,sent_count,failed_count,created_at) VALUES (?,?,?,?,?,?)"
    ).bind(crypto.randomUUID(), job.kind, job.text_payload || null, sent, failed, nowIso()).run();
    await sendMessage(env, job.admin_chat_id, `✅ Broadcast ပြီးပါပြီ။\nအောင်မြင်: ${sent}\nမအောင်မြင်: ${failed}`, { reply_markup: adminMenu() });
    return;
  }

  const key = await webhookSecret(env);
  await fetch(`${origin}/internal/broadcast/${jobId}`, {
    method: "POST",
    headers: { "x-internal-key": key },
  });
}

async function handleCallback(env, ctx, origin, q) {
  const uid = q.from.id;
  const chatId = q.message?.chat?.id || uid;
  const data = q.data || "";
  await tg(env, "answerCallbackQuery", { callback_query_id: q.id });
  await upsertUser(env, q.from);

  if (data === "main") {
    if (isAdmin(env, uid)) await clearSession(env, uid);
    return sendMain(env, chatId);
  }
  if (data === "user_courses") return showCourses(env, chatId, false);

  if (data.startsWith("course:")) {
    const id = data.split(":", 2)[1];
    const c = await env.DB.prepare("SELECT * FROM courses WHERE id=? AND is_published=1").bind(id).first();
    if (!c) return sendMessage(env, chatId, "ဒီသင်တန်းကို မတွေ့တော့ပါ။");
    const rows = [];
    if (c.url) rows.push([{ text: "🔗 အသေးစိတ် / လေ့လာရန်", url: c.url }]);
    rows.push([{ text: "⬅️ သင်တန်းစာရင်း", callback_data: "user_courses" }]);
    return sendMessage(env, chatId, `🎓 ${c.title}\n\n${c.description || ""}`, { reply_markup: { inline_keyboard: rows } });
  }

  if (data.startsWith("faq:")) {
    const id = data.split(":", 2)[1];
    const f = await env.DB.prepare("SELECT question,answer FROM faqs WHERE id=? AND is_active=1").bind(id).first();
    if (!f) return sendMessage(env, chatId, "ဒီ FAQ ကို မတွေ့တော့ပါ။");
    return sendMessage(env, chatId, `❓ ${f.question}\n\n${f.answer}`, { reply_markup: MAIN_MENU });
  }

  if (!data.startsWith("adm_") || !isAdmin(env, uid)) return;

  if (data === "adm_home") {
    await clearSession(env, uid);
    return sendMessage(env, chatId, "🔐 Future Code Admin Panel", { reply_markup: adminMenu() });
  }
  if (data === "adm_users") {
    const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first();
    return sendMessage(env, chatId, `👥 Bot User စုစုပေါင်း: ${Number(row?.n || 0).toLocaleString()}`, { reply_markup: adminMenu() });
  }
  if (data === "adm_faq_add") {
    await setSession(env, uid, "faq_add_question", {});
    return sendMessage(env, chatId, "➕ FAQ မေးခွန်းအသစ်ကို ရေးပို့ပါ။\n\nပယ်ဖျက်ရန် /cancel");
  }
  if (data === "adm_faq_list") return showFaqs(env, chatId, true);

  if (data.startsWith("adm_faq:")) {
    const id = data.split(":", 2)[1];
    const f = await env.DB.prepare("SELECT question,answer FROM faqs WHERE id=?").bind(id).first();
    if (!f) return sendMessage(env, chatId, "FAQ မတွေ့တော့ပါ။");
    return sendMessage(env, chatId, `❓ ${f.question}\n\n${f.answer}`, {
      reply_markup: { inline_keyboard: [
        [
          { text: "✏️ မေးခွန်းပြင်", callback_data: `adm_faq_q:${id}` },
          { text: "✏️ အဖြေပြင်", callback_data: `adm_faq_a:${id}` },
        ],
        [{ text: "🗑 ဖျက်မယ်", callback_data: `adm_faq_del:${id}` }],
        [{ text: "⬅️ FAQ စာရင်း", callback_data: "adm_faq_list" }],
      ] },
    });
  }
  if (data.startsWith("adm_faq_q:")) {
    const id = data.split(":", 2)[1];
    await setSession(env, uid, "faq_edit_question", { faq_id: id });
    return sendMessage(env, chatId, "မေးခွန်းအသစ်ကို ရေးပို့ပါ။");
  }
  if (data.startsWith("adm_faq_a:")) {
    const id = data.split(":", 2)[1];
    await setSession(env, uid, "faq_edit_answer", { faq_id: id });
    return sendMessage(env, chatId, "အဖြေအသစ်ကို ရေးပို့ပါ။");
  }
  if (data.startsWith("adm_faq_del:")) {
    const id = data.split(":", 2)[1];
    await env.DB.prepare("DELETE FROM faqs WHERE id=?").bind(id).run();
    return sendMessage(env, chatId, "✅ FAQ ဖျက်ပြီးပါပြီ။", { reply_markup: adminMenu() });
  }

  if (data === "adm_course_add") {
    await setSession(env, uid, "course_add_title", {});
    return sendMessage(env, chatId, "➕ သင်တန်းနာမည်ကို ရေးပို့ပါ။\n\nပယ်ဖျက်ရန် /cancel");
  }
  if (data === "adm_course_list") return showCourses(env, chatId, true);

  if (data.startsWith("adm_course:")) {
    const id = data.split(":", 2)[1];
    const c = await env.DB.prepare("SELECT * FROM courses WHERE id=?").bind(id).first();
    if (!c) return sendMessage(env, chatId, "သင်တန်းမတွေ့တော့ပါ။");
    return sendMessage(env, chatId, `🎓 ${c.title}\n\n${c.description || ""}\n\nStatus: ${c.is_published ? "Published" : "Hidden"}${c.url ? `\nLink: ${c.url}` : ""}`, {
      reply_markup: { inline_keyboard: [
        [
          { text: c.is_published ? "⏸ ဖျောက်မယ်" : "✅ ပြန်ပြမယ်", callback_data: `adm_course_toggle:${id}` },
          { text: "📢 ကြော်ငြာမယ်", callback_data: `adm_course_broadcast:${id}` },
        ],
        [{ text: "🗑 ဖျက်မယ်", callback_data: `adm_course_del:${id}` }],
        [{ text: "⬅️ သင်တန်းစာရင်း", callback_data: "adm_course_list" }],
      ] },
    });
  }
  if (data.startsWith("adm_course_toggle:")) {
    const id = data.split(":", 2)[1];
    await env.DB.prepare("UPDATE courses SET is_published=CASE is_published WHEN 1 THEN 0 ELSE 1 END,updated_at=? WHERE id=?")
      .bind(nowIso(), id).run();
    return sendMessage(env, chatId, "✅ Status ပြောင်းပြီးပါပြီ။", { reply_markup: adminMenu() });
  }
  if (data.startsWith("adm_course_del:")) {
    const id = data.split(":", 2)[1];
    await env.DB.prepare("DELETE FROM courses WHERE id=?").bind(id).run();
    return sendMessage(env, chatId, "✅ သင်တန်းဖျက်ပြီးပါပြီ။", { reply_markup: adminMenu() });
  }
  if (data.startsWith("adm_course_broadcast:")) {
    const id = data.split(":", 2)[1];
    const c = await env.DB.prepare("SELECT * FROM courses WHERE id=?").bind(id).first();
    if (!c) return sendMessage(env, chatId, "သင်တန်းမတွေ့တော့ပါ။");
    await sendMessage(env, chatId, "📢 User အားလုံးဆီ ပို့နေပါတယ်…");
    const text = `🔥 Future Code သင်တန်းအသစ်\n\n🎓 ${c.title}\n\n${c.description || ""}${c.url ? `\n\n🔗 ${c.url}` : ""}`;
    await createTextBroadcast(env, ctx, origin, chatId, text, null);
    return;
  }

  if (data === "adm_content") {
    const rows = Object.entries(CONTENT_LABELS).map(([k, label]) => [{ text: label, callback_data: `adm_content:${k}` }]);
    rows.push([{ text: "⬅️ Admin Menu", callback_data: "adm_home" }]);
    return sendMessage(env, chatId, "ပြင်ချင်တဲ့စာကို ရွေးပါ။", { reply_markup: { inline_keyboard: rows } });
  }
  if (data.startsWith("adm_content:")) {
    const key = data.split(":", 2)[1];
    const current = await getContent(env, key) || "(စာမရှိသေးပါ)";
    await setSession(env, uid, "content_edit", { content_key: key });
    return sendMessage(env, chatId, `${CONTENT_LABELS[key] || key}\n\nလက်ရှိစာ:\n${current}\n\nစာအသစ်ကို ရေးပို့ပါ။`);
  }
  if (data === "adm_broadcast") {
    await setSession(env, uid, "broadcast_wait_message", {});
    return sendMessage(env, chatId, "📢 User အားလုံးဆီ ပို့ချင်တဲ့ Message ကို အခု ပို့ပါ။\n\nText / Photo / Video အားလုံးရပါတယ်။\nပယ်ဖျက်ရန် /cancel");
  }
}

async function handleMessage(env, ctx, origin, m) {
  const user = m.from;
  if (!user?.id) return;
  const uid = user.id;
  const chatId = m.chat.id;
  await upsertUser(env, user);
  const text = String(m.text || "").trim();

  if (text.startsWith("/")) {
    const cmd = text.split(/\s+/, 1)[0].split("@", 1)[0].toLowerCase();
    if (cmd === "/start") {
      if (isAdmin(env, uid)) await clearSession(env, uid);
      const welcome = await getContent(env, "welcome") || "👋 မင်္ဂလာပါ။ Future Code AI Assistant မှ ကြိုဆိုပါတယ်။";
      return sendMessage(env, chatId, welcome, { reply_markup: MAIN_MENU });
    }
    if (cmd === "/menu") return sendMain(env, chatId);
    if (cmd === "/myid") return sendMessage(env, chatId, `သင့် Telegram User ID: ${uid}`);
    if (cmd === "/cancel") {
      if (isAdmin(env, uid)) await clearSession(env, uid);
      return sendMain(env, chatId, "လုပ်ဆောင်ချက်ကို ပယ်ဖျက်ပြီးပါပြီ။");
    }
    if (cmd === "/admin") {
      if (!isAdmin(env, uid)) return;
      await clearSession(env, uid);
      return sendMessage(env, chatId, "🔐 Future Code Admin Panel", { reply_markup: adminMenu() });
    }
  }

  if (isAdmin(env, uid)) {
    const state = await getSession(env, uid);
    if (state) return handleAdminState(env, ctx, origin, m, uid, state);
  }

  if (text === "🎓 AI Video သင်တန်း") {
    return sendMessage(env, chatId, await getContent(env, "course_info") || "သင်တန်းအချက်အလက် မထည့်ရသေးပါ။", { reply_markup: MAIN_MENU });
  }
  if (text === "📱 Future Code App") {
    return sendMessage(env, chatId, await getContent(env, "app_info") || "Future Code App အချက်အလက် မထည့်ရသေးပါ။", { reply_markup: MAIN_MENU });
  }
  if (text === "✨ AI Pro Account") {
    return sendMessage(env, chatId, await getContent(env, "pro_info") || "AI Pro Account အချက်အလက် မထည့်ရသေးပါ။", { reply_markup: MAIN_MENU });
  }
  if (text === "💰 သင်တန်းကြေး / ဝယ်ယူရန်") {
    return sendMessage(env, chatId, await getContent(env, "pricing") || "ဈေးနှုန်းအချက်အလက် မထည့်ရသေးပါ။", { reply_markup: MAIN_MENU });
  }
  if (text === "👨‍💻 Admin နှင့်ဆက်သွယ်ရန်") {
    let x = await getContent(env, "contact_info") || "Admin ဆက်သွယ်ရန် အချက်အလက် မထည့်ရသေးပါ။";
    if (env.SUPPORT_URL) x += `\n\n${env.SUPPORT_URL}`;
    return sendMessage(env, chatId, x, { reply_markup: MAIN_MENU });
  }
  if (text === "🔥 သင်တန်းအသစ်များ") return showCourses(env, chatId, false);
  if (text === "❓ အမေးများသောမေးခွန်းများ") return showFaqs(env, chatId, false);
  if (text === "🤖 AI Assistant") {
    return sendMessage(env, chatId, "🤖 Future Code AI Assistant အသင့်ရှိပါတယ်။\n\nAI Video, Prompt, ChatGPT, Gemini, Google Flow၊ Future Code သင်တန်း/App စတာတွေကို မြန်မာလို မေးနိုင်ပါတယ်။\n\nမေးခွန်းကို တိုက်ရိုက်ရေးပို့ပါ။");
  }

  if (text) {
    await tg(env, "sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {});
    const answer = await geminiAnswer(env, text);
    const chunks = String(answer).match(/[\s\S]{1,3900}/g) || [String(answer)];
    for (const chunk of chunks) await sendMessage(env, chatId, chunk);
    return;
  }

  return sendMessage(env, chatId, "စာသားနဲ့ မေးခွန်းရေးပို့ပေးပါ။ 🙂", { reply_markup: MAIN_MENU });
}

async function handleUpdate(env, ctx, origin, update) {
  if (update.callback_query) return handleCallback(env, ctx, origin, update.callback_query);
  if (update.message) return handleMessage(env, ctx, origin, update.message);
}

export default {
  async fetch(request, env, ctx) {
    if (!env.TELEGRAM_BOT_TOKEN || !env.DB) {
      return new Response("Missing TELEGRAM_BOT_TOKEN or DB binding", { status: 500 });
    }
    await ensureDb(env);
    const url = new URL(request.url);
    const origin = url.origin;

    if (request.method === "GET" && url.pathname === "/") {
      return Response.json({
        ok: true,
        service: "Future Code Telegram Bot",
        hosting: "Cloudflare Workers",
        database: "Cloudflare D1",
        menu: "public users see /start only",
      });
    }

    if (request.method === "GET" && url.pathname === "/setup") {
      const admin = Number(url.searchParams.get("admin") || 0);
      if (!admin || !isAdmin(env, admin)) return new Response("Forbidden", { status: 403 });
      await setupBot(env, origin);
      return Response.json({ ok: true, webhook: `${origin}/webhook`, message: "Telegram webhook and command menus configured" });
    }

    if (request.method === "POST" && url.pathname === "/webhook") {
      const expected = await webhookSecret(env);
      const received = request.headers.get("x-telegram-bot-api-secret-token") || "";
      if (received !== expected) return new Response("Forbidden", { status: 403 });
      const update = await request.json();
      ctx.waitUntil(handleUpdate(env, ctx, origin, update).catch((e) => console.error(e)));
      return Response.json({ ok: true });
    }

    if (request.method === "POST" && url.pathname.startsWith("/internal/broadcast/")) {
      const expected = await webhookSecret(env);
      if ((request.headers.get("x-internal-key") || "") !== expected) return new Response("Forbidden", { status: 403 });
      const jobId = url.pathname.split("/").pop();
      ctx.waitUntil(processBroadcastJob(env, jobId, origin).catch((e) => console.error(e)));
      return Response.json({ ok: true, queued: true });
    }

    return new Response("Not found", { status: 404 });
  },
};