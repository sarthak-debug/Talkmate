import { BUILDER, SPOT, WORDS, TRANSLATE } from "./data.js";

/* ============ helpers ============ */
const $ = s => document.querySelector(s);
const S = {
  get(k, d) { try { const v = localStorage.getItem("tm_" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("tm_" + k, JSON.stringify(v)); } catch {} },
};
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9' ]/g, " ").replace(/\s+/g, " ").trim();
let toastTimer;
function toast(t) { document.querySelector(".toast")?.remove(); const d = el("div", "toast", t); document.body.append(d); clearTimeout(toastTimer); toastTimer = setTimeout(() => d.remove(), 2400); }

/* ============ settings ============ */
["topic", "level", "accent", "rate", "password", "textSize"].forEach(id => {
  const v = S.get(id, null); if (v != null) $("#" + id).value = v;
  $("#" + id).addEventListener("change", () => S.set(id, $("#" + id).value));
});
["autoSpeak", "autoSend"].forEach(id => {
  const v = S.get(id, null); if (v != null) $("#" + id).checked = v;
  $("#" + id).addEventListener("change", () => S.set(id, $("#" + id).checked));
});
const applySize = () => document.documentElement.dataset.size = $("#textSize").value;
$("#textSize").addEventListener("change", applySize); applySize();
$("#openSettings").onclick = () => $("#settings").showModal();
$("#closeSettings").onclick = () => { S.set("password", $("#password").value); $("#settings").close(); refreshBattery(); };
$("#newChat").onclick = () => { $("#settings").close(); freshChat(); go("talk"); };
const level = () => $("#level").value;

/* ============ AI battery: how much free AI is left today ============ */
const RESERVE = 5;                // keep the last few requests for talking with Tara
const utcDay = () => new Date().toISOString().slice(0, 10);
let bat = Object.assign({ day: utcDay(), known: false, remaining: null, limit: null, backup: false, empty: false }, S.get("bat", {}));
if (bat.day !== utcDay()) bat = { day: utcDay(), known: false, remaining: null, limit: null, backup: bat.backup, empty: false };
const saveBat = () => S.set("bat", bat);

// How many AI requests we can still make (Infinity when unknown or a backup exists).
function aiLeft() {
  if (!navigator.onLine) return 0;
  if (bat.backup) return Infinity;
  if (bat.empty) return 0;
  return bat.known ? bat.remaining : Infinity;
}
const canAI = () => aiLeft() > 0;
const canMakeNew = () => aiLeft() > RESERVE;

function nextRefill() {
  const n = new Date(), t = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1));
  const mins = Math.max(1, Math.round((t - n) / 60000));
  const h = Math.floor(mins / 60), m = mins % 60;
  return { time: t.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }), wait: h ? `${h} h ${m} min` : `${m} min` };
}
function batState() {
  if (!navigator.onLine) return { level: "off", pct: 0, text: "Off", line: "You are offline. Games and saved sentences still work." };
  const mainLeft = bat.empty ? 0 : bat.known ? bat.remaining : null;
  if (mainLeft === 0 && bat.backup) return { level: "backup", pct: 100, text: "B", line: "Main free AI is used up. The backup AI is answering now." };
  if (mainLeft === 0) return { level: "low", pct: 0, text: "0", line: "Free AI is used up for today." };
  if (mainLeft == null) return { level: "full", pct: 100, text: "AI", line: "AI is ready." };
  const pct = Math.round((mainLeft / bat.limit) * 100);
  return { level: pct > 50 ? "full" : pct > 20 ? "mid" : "low", pct: Math.max(4, pct), text: String(mainLeft), line: `${mainLeft} of ${bat.limit} left today.` };
}
function renderBattery() {
  const s = batState();
  $("#battery").dataset.level = s.level; $("#batFill").style.width = s.pct + "%"; $("#batText").textContent = s.text;
  $("#battery").setAttribute("aria-label", "Free AI: " + s.line);
  $(".bat-big").dataset.level = s.level; $("#batBigFill").style.width = s.pct + "%";
  $("#batNum").textContent = s.line;
  const r = nextRefill();
  $("#batWhen").textContent = `Refills every day at ${r.time} (in ${r.wait}).`;
  $("#batBackup").hidden = !bat.backup;
}
let batTimer;
async function refreshBattery() {
  if (!navigator.onLine) return renderBattery();
  try {
    const r = await fetch("/api/status", { method: "POST", headers: { "content-type": "application/json", "x-app-password": $("#password").value || "" }, body: "{}" });
    if (!r.ok) return;
    const s = await r.json();
    bat.day = utcDay(); bat.backup = !!s.backup;
    if (s.free) { bat.known = true; bat.limit = s.free.limit; bat.remaining = s.free.remaining; bat.empty = s.free.remaining <= 0; }
    else { bat.known = false; }
    saveBat();
  } catch { /* keep last known */ }
  renderBattery();
}
const refreshSoon = () => { clearTimeout(batTimer); batTimer = setTimeout(refreshBattery, 1500); };
// Called after every AI request.
function usedAI(out, err) {
  if (bat.day !== utcDay()) bat = { day: utcDay(), known: false, remaining: null, limit: null, backup: bat.backup, empty: false };
  if (err?.status === 429) { bat.empty = true; if (bat.known) bat.remaining = 0; }
  else if (out?.via && out.via !== "main") { bat.empty = true; if (bat.known) bat.remaining = 0; }   // main failed, backup answered
  else if (out && bat.known && bat.remaining > 0) bat.remaining--;
  saveBat(); renderBattery(); refreshSoon();
}
async function api(path, body) {
  if (!navigator.onLine) throw Object.assign(new Error("You are offline. Connect to the internet and try again."), { status: 0 });
  let out = {}, r;
  try {
    r = await fetch(path, { method: "POST", headers: { "content-type": "application/json", "x-app-password": $("#password").value || "" }, body: JSON.stringify(body) });
    out = await r.json().catch(() => ({}));
  } catch { throw Object.assign(new Error("Could not connect. Check your internet and try again."), { status: 0 }); }
  if (!r.ok) { const e = Object.assign(new Error(out.error || "Something went wrong. Try again."), { status: r.status }); usedAI(null, e); throw e; }
  usedAI(out); return out;
}
$("#battery").onclick = () => { renderBattery(); $("#batteryInfo").showModal(); refreshBattery(); };
$("#batClose").onclick = () => $("#batteryInfo").close();
addEventListener("online", refreshBattery); addEventListener("offline", renderBattery);
document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshBattery(); });
renderBattery(); refreshBattery();

/* ============ saved practice: built-in + everything the AI made ============ */
const BUILT = { builder: BUILDER, spot: SPOT, words: WORDS, hi: TRANSLATE.hi, mr: TRANSLATE.mr };
const KEY_OF = { builder: s => norm(s), spot: i => norm(i.right), words: i => norm(i.word), hi: i => i.native?.trim(), mr: i => i.native?.trim() };
const learned = Object.assign({ builder: [], spot: [], words: [], hi: [], mr: [] }, S.get("learned", {}));
const bank = kind => [...BUILT[kind], ...learned[kind]];
// Save new AI-made items on this phone so they can be practised later without AI.
function learn(kind, items) {
  const keyOf = KEY_OF[kind], seen = new Set(bank(kind).map(keyOf));
  let added = 0;
  for (const it of items || []) {
    const k = keyOf(it);
    if (!k || seen.has(k)) continue;
    seen.add(k); learned[kind].push(it); added++;
  }
  if (added) { learned[kind] = learned[kind].slice(-800); S.set("learned", learned); renderSaved(); }
  return added;
}
// Remember what was shown, so saved practice picks things not seen recently.
const recent = S.get("recent", {});
function markSeen(kind, items) {
  const all = bank(kind).length;
  recent[kind] = [...(recent[kind] || []), ...items.map(KEY_OF[kind])].slice(-Math.floor(all * 0.7));
  S.set("recent", recent);
}
function pickSaved(kind, n) {
  const keyOf = KEY_OF[kind], all = shuffle(bank(kind)), r = new Set(recent[kind] || []);
  const out = [...all.filter(i => !r.has(keyOf(i))), ...all.filter(i => r.has(keyOf(i)))].slice(0, n);
  markSeen(kind, out);
  return out;
}
function renderSaved() {
  const n = k => bank(k).length, extra = Object.values(learned).reduce((a, l) => a + l.length, 0);
  $("#savedCount").textContent = ["hi", "mr", "builder", "spot", "words"].reduce((a, k) => a + n(k), 0);
  $("#savedInfo").textContent = `Saved for offline practice: ${n("hi")} Hindi and ${n("mr")} Marathi sentences, ${n("builder")} builder sentences, ${n("spot")} mistakes, ${n("words")} words (${extra} made by AI).`;
}
renderSaved();

/* ============ points & streak ============ */
let prog = S.get("prog", { xp: 0, streak: 0, last: "" });
const dayStr = d => d.toDateString();
function renderProg() {
  const today = dayStr(new Date()), yest = dayStr(new Date(Date.now() - 864e5));
  $("#xp").textContent = prog.xp;
  const st = (prog.last === today || prog.last === yest) ? prog.streak : 0;
  $("#streak").textContent = st; $("#dayWord").textContent = st === 1 ? "day" : "days";
}
function addXP(n) {
  const today = dayStr(new Date()), yest = dayStr(new Date(Date.now() - 864e5));
  if (prog.last !== today) { prog.streak = prog.last === yest ? prog.streak + 1 : 1; prog.last = today; }
  prog.xp += n; S.set("prog", prog); renderProg(); toast(`+${n} ⭐`);
}
renderProg();

/* ============ Tara: the animated partner ============ */
const av = $("#avatar"), mouthOpen = $("#mouthOpen"), caption = $("#caption");
const Tara = {
  talking: false, open: 0, target: 0, last: 0, moodTimer: 0,
  start() { this.talking = true; av.classList.add("talking"); },
  stop() { this.talking = false; av.classList.remove("talking"); },
  bump() { this.target = 1; },
  mood(m) {
    av.classList.remove("happy", "sad", "thinking", "listening");
    clearTimeout(this.moodTimer);
    if (m) av.classList.add(m);
    if (m === "happy" || m === "sad") this.moodTimer = setTimeout(() => av.classList.remove(m), 3500);
  },
};
function frame(t) {
  if (Tara.talking) { if (t - Tara.last > 105) { Tara.target = 0.15 + Math.random() * 0.85; Tara.last = t; } }
  else Tara.target = 0;
  Tara.open += (Tara.target - Tara.open) * 0.35;
  mouthOpen.setAttribute("ry", (2 + Tara.open * 11).toFixed(1));
  mouthOpen.setAttribute("rx", (12 - Tara.open * 3).toFixed(1));
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
(function blink() {
  setTimeout(() => { av.classList.add("blink"); setTimeout(() => av.classList.remove("blink"), 130); blink(); }, 2200 + Math.random() * 3200);
})();
function setCaption(text, deva = false) { caption.textContent = text; caption.classList.toggle("deva", deva); }

/* ============ voice out ============ */
let voices = [];
const LANGCODE = { hi: "hi-IN", mr: "mr-IN" };
function loadVoices() {
  voices = speechSynthesis.getVoices();
  const has = p => voices.some(v => v.lang.toLowerCase().replace("_", "-").startsWith(p));
  $("#voiceInfo").textContent = `Voices on this phone: English ${has("en") ? "✓" : "✗"} · Hindi ${has("hi") ? "✓" : "✗"} · Marathi ${has("mr") ? "✓" : "✗ (Hindi voice used)"}. ` +
    (has("hi") && has("mr") ? "" : "Add voices in phone Settings → Text-to-speech → Google → Install voice data.");
}
if ("speechSynthesis" in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
function voiceFor(lang) {
  const code = lang === "en" ? $("#accent").value : LANGCODE[lang];
  const L = v => v.lang.toLowerCase().replace("_", "-");
  return voices.find(v => L(v) === code.toLowerCase())
    || voices.find(v => L(v).startsWith(code.slice(0, 2)))
    || (lang === "mr" ? voices.find(v => L(v).startsWith("hi")) : null)
    || (lang === "en" ? voices.find(v => L(v).startsWith("en")) : null);
}
function stopSpeaking() { try { speechSynthesis.cancel(); } catch {} Tara.stop(); }
// lang: "en" | "hi" | "mr". auto: true when Tara speaks on her own (obeys the "speaks out loud" setting).
function speak(text, lang = "en", { auto = false, rate } = {}) {
  setCaption(text, lang !== "en");
  if (!text) return Promise.resolve();
  if ((auto && !$("#autoSpeak").checked) || !("speechSynthesis" in window)) {
    Tara.start(); return new Promise(r => setTimeout(() => { Tara.stop(); r(); }, Math.min(4000, 600 + text.length * 40)));
  }
  return new Promise(resolve => {
    stopSpeaking();
    const u = new SpeechSynthesisUtterance(text);
    const v = voiceFor(lang);
    if (v) u.voice = v;
    u.lang = v?.lang || (lang === "en" ? "en-IN" : LANGCODE[lang]);
    u.rate = rate || Number($("#rate").value) || 0.95;
    let done = false, timer;
    const finish = () => { if (done) return; done = true; clearTimeout(timer); Tara.stop(); resolve(); };
    u.onend = finish; u.onerror = finish; u.onboundary = () => Tara.bump();
    Tara.start();
    timer = setTimeout(finish, 2000 + (text.length * 95) / u.rate);
    speechSynthesis.speak(u);
  });
}

/* ============ voice in ============ */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let activeRec = null;
function micToggle(btn, { onInterim, onDone }) {
  if (activeRec) { activeRec.stop(); return; }
  if (!SR) { toast("Voice needs Chrome (Android) or Safari (iPhone). You can type instead."); return; }
  stopSpeaking();
  const rec = new SR();
  rec.lang = $("#accent").value; rec.interimResults = true; rec.continuous = false;
  let final = "", latest = "";
  rec.onresult = e => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) final += t + " "; else interim += t;
    }
    latest = (final + interim).trim(); onInterim?.(latest);
  };
  rec.onerror = e => {
    if (e.error === "not-allowed" || e.error === "service-not-allowed") toast("Microphone is blocked. Allow it in browser settings.");
    else if (e.error === "no-speech") toast("I didn't hear anything. Tap 🎤 and try again.");
  };
  rec.onend = () => { activeRec = null; btn.classList.remove("on"); btn.textContent = "🎤"; Tara.mood(null); onDone?.(latest); };
  try { rec.start(); } catch { return; }
  activeRec = rec; btn.classList.add("on"); btn.textContent = "■";
  Tara.mood("listening"); setCaption("I'm listening… Tap ■ when you finish.");
}

// any button with data-say speaks its text
document.addEventListener("click", e => {
  const b = e.target.closest("[data-say]");
  if (b) speak(b.dataset.say, b.dataset.sayLang || "en", b.dataset.slow ? { rate: 0.6 } : {});
});

/* ============ screens: home → one activity ============ */
const TITLES = { talk: "Talk with Tara", translate: "", game: "" };
let screen = "home";
function show(name, opts = {}) {
  screen = name; stopSpeaking(); if (activeRec) activeRec.stop(); Tara.mood(null);
  $("#app").dataset.screen = name;
  ["home", "talk", "translate", "game"].forEach(n => $("#s-" + n).hidden = n !== name);
  $("#back").hidden = name === "home";
  const title = $("#title");
  if (name === "home") { title.innerHTML = "Talk<span>Mate</span>"; setCaption("Namaste! I'm Tara. Choose what you want to practise."); }
  else title.textContent = opts.title || TITLES[name];
  document.querySelector(".screen:not([hidden]) .scroll, .screen:not([hidden]) #log")?.scrollTo(0, 0);
}
// Opens an activity and adds a history step, so the phone's Back button returns to Home.
function go(name, opts = {}) {
  if (name === "talk") { show("talk"); scrollLog(); speak("Let's chat! Tap the microphone and tell me something in English.", "en", { auto: true }); }
  if (name === "translate") startTranslate(opts.lang);
  if (name === "game") startGame(opts.game);
  if (history.state?.screen !== "activity") history.pushState({ screen: "activity" }, "");
}
function goHome() { if (history.state?.screen === "activity") history.back(); else show("home"); }
addEventListener("popstate", () => show("home"));
$("#back").onclick = goHome;
document.querySelectorAll("[data-go]").forEach(b => b.onclick = () => go(b.dataset.go, { lang: b.dataset.lang, game: b.dataset.game }));

/* ============ TALK ============ */
const log = $("#log"), msg = $("#msg");
const GREETING = "Hi! I'm Tara, your English practice partner. Tell me about your day. What did you do today?";
let turns = S.get("turns", []), busy = false;
const scrollLog = () => requestAnimationFrame(() => log.scrollTop = log.scrollHeight);
function botBubble(text) {
  const r = el("div", "row bot"); r.append(el("div", "bubble", text));
  const b = el("button", "speak", "🔊 Listen"); b.dataset.say = text; r.append(b);
  log.append(r); scrollLog(); return r;
}
function meBubble(text) { const r = el("div", "row me"); r.append(el("div", "bubble", text)); log.append(r); scrollLog(); return r; }
function fixesBox(fixes, okText, tip) {
  const box = el("div", fixes.length ? "fixes" : "fixes ok");
  box.append(el("div", "lab", fixes.length ? `${fixes.length} correction${fixes.length > 1 ? "s" : ""}` : okText));
  fixes.forEach(f => {
    const d = el("div", "fx"), b = el("button", "say", "🔊"); b.dataset.say = f.better; b.setAttribute("aria-label", "Hear the correct way");
    d.append(el("s", null, f.original), " → ", el("strong", null, f.better), b);
    if (f.why) d.append(el("em", null, f.why));
    box.append(d);
  });
  if (tip) box.append(el("span", "tip", "Tip: " + tip));
  return box;
}
function persistChat() { S.set("turns", turns); S.set("view", log.innerHTML); }
function noAIMessage() {
  const r = nextRefill();
  return `Free AI is used up for today. It refills at ${r.time}. Meanwhile, play the games or translate saved sentences.`;
}
async function sendChat(text) {
  text = text.trim(); if (busy || !text) return;
  if (!canAI()) { Tara.mood("sad"); setCaption(navigator.onLine ? noAIMessage() : "You are offline. Connect to the internet to talk with Tara."); return; }
  log.querySelector(".starters")?.remove(); log.querySelector(".note.start")?.remove();
  busy = true; $("#send").disabled = true; $("#talkMic").disabled = true;
  const row = meBubble(text); msg.value = "";
  turns.push({ role: "user", content: text });
  const typing = el("div", "typing", "Tara is thinking…"); log.append(typing); scrollLog();
  Tara.mood("thinking"); setCaption("Hmm, let me think…");
  try {
    const out = await api("/api/chat", { messages: [{ role: "assistant", content: GREETING }, ...turns].slice(-20), level: level(), topic: $("#topic").value });
    typing.remove();
    row.append(fixesBox(out.corrections || [], "Perfect English ✓", out.tip));
    turns.push({ role: "assistant", content: out.reply });
    botBubble(out.reply); persistChat();
    addXP(out.corrections?.length ? 5 : 10);
    Tara.mood(out.mood === "happy" ? "happy" : null);
    await speak(out.reply, "en", { auto: true });
  } catch (err) {
    typing.remove(); turns.pop(); row.remove(); msg.value = text;
    Tara.mood("sad"); setCaption(err.status === 429 ? noAIMessage() : err.message);
  } finally { busy = false; $("#send").disabled = false; $("#talkMic").disabled = false; }
}
function freshChat() {
  log.innerHTML = ""; turns = [];
  botBubble(GREETING);
  const st = el("div", "starters");
  ["Today I go to office and finish my report.", "I am liking to watch movies in weekend.", "Yesterday I have cooked biryani for my family."]
    .forEach(t => st.append(el("button", null, t)));
  log.append(el("div", "note start", "Tap one to try, or say your own:"), st);
  persistChat();
}
log.addEventListener("click", e => { const s = e.target.closest(".starters button"); if (s) sendChat(s.textContent); });
$("#send").onclick = () => sendChat(msg.value);
msg.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) { e.preventDefault(); sendChat(msg.value); } });
$("#talkMic").onclick = () => micToggle($("#talkMic"), {
  onInterim: t => msg.value = t,
  onDone: t => { if ($("#autoSend").checked && t) sendChat(t); },
});
const savedView = S.get("view", null);
if (turns.length && savedView) log.innerHTML = savedView; else freshChat();

/* ============ TRANSLATE ============ */
let tLang = "hi", queue = [], cur = null, scored = false, lowNotice = false;
const LNAME = { hi: "Hindi", mr: "Marathi" };
function startTranslate(lang) {
  if (lang !== tLang) queue = [];
  tLang = lang || "hi";
  show("translate", { title: `${LNAME[tLang]} → English` });
  nextSentence();
}
// New AI sentences first; saved sentences when AI is low, offline or fails.
async function getSentences() {
  if (canMakeNew()) {
    $("#tNative").textContent = "…"; $("#tRoman").textContent = ""; setSource(null);
    Tara.mood("thinking"); setCaption(`Getting new ${LNAME[tLang]} sentences for you…`);
    try {
      const { items } = await api("/api/translate", { action: "new", lang: tLang, level: level(), topic: $("#topic").value });
      learn(tLang, items); markSeen(tLang, items);
      Tara.mood(null);
      return items.map(i => ({ ...i, _src: "new" }));
    } catch { Tara.mood(null); }
  }
  if (!lowNotice && navigator.onLine) { lowNotice = true; toast("Using saved sentences to keep your free AI for talking"); }
  return pickSaved(tLang, 5).map(i => ({ ...i, _src: "saved" }));
}
function setSource(src) {
  const b = $("#tSource");
  b.hidden = !src; b.className = "badge" + (src === "saved" ? " saved" : "");
  b.textContent = src === "new" ? "✨ New" : "📦 Saved";
}
async function nextSentence() {
  $("#tResult").innerHTML = ""; $("#tInput").value = ""; $("#tHintText").hidden = true; scored = false;
  $("#tNext").disabled = true;
  if (!queue.length) queue = await getSentences();
  if (screen !== "translate") return;
  cur = queue.shift();
  $("#tNative").textContent = cur.native; $("#tRoman").textContent = cur.roman; setSource(cur._src);
  $("#tNext").disabled = false;
  speak(cur.native, tLang);
}
$("#tHear").onclick = () => cur && speak(cur.native, tLang);
$("#tHint").onclick = () => { if (!cur) return; const h = $("#tHintText"); h.textContent = "💡 " + (cur.hint || "Think about the tense."); h.hidden = false; };
$("#tShow").onclick = () => { if (!cur) return; showResult({ verdict: "try", score: 0, feedback: "Here is the answer. Say it out loud with me!", best: cur.english, corrections: [] }, null, true); };
$("#tNext").onclick = nextSentence;
$("#tCheck").onclick = () => checkTranslation($("#tInput").value);
$("#tInput").addEventListener("keydown", e => { if (e.key === "Enter") checkTranslation($("#tInput").value); });
$("#tMic").onclick = () => micToggle($("#tMic"), { onInterim: t => $("#tInput").value = t, onDone: t => { if (t) checkTranslation(t); } });

function localCheck(ans, ref) {
  const a = norm(ans).split(" "), r = norm(ref).split(" ");
  const hit = r.filter(w => a.includes(w)).length;
  const score = Math.round((hit / Math.max(r.length, a.length)) * 100);
  const verdict = score >= 85 ? "great" : score >= 50 ? "close" : "try";
  return { score, verdict, best: ref, corrections: [], feedback: verdict === "great" ? "Well done!" : "Good try! Compare with the answer." };
}
async function checkTranslation(ans) {
  ans = ans.trim(); if (!ans || !cur || busy) return;
  busy = true; $("#tCheck").disabled = true;
  Tara.mood("thinking"); setCaption("Let me check…");
  let r = null;
  if (canAI()) { try { r = await api("/api/translate", { action: "check", lang: tLang, native: cur.native, english: cur.english, answer: ans }); } catch {} }
  if (!r) { r = localCheck(ans, cur.english); r.feedback += " (Checked without AI.)"; }
  busy = false; $("#tCheck").disabled = false;
  showResult(r, ans);
}
function showResult(r, ans, revealed = false) {
  const box = $("#tResult"); box.innerHTML = "";
  const res = el("div", "result " + r.verdict);
  const head = { great: "Excellent! 🎉", close: "Almost there! 👍", try: revealed ? "The answer" : "Let's try again 💪" }[r.verdict];
  res.append(el("div", "big", head + (ans ? `  ${r.score}/100` : "")));
  if (ans) res.append(el("div", null, "You said: " + ans));
  const best = el("div"); const sb = el("button", "say", "🔊"); sb.dataset.say = r.best;
  best.append("Best way: ", el("strong", null, r.best), sb); res.append(best);
  if (r.corrections?.length) res.append(fixesBox(r.corrections, ""));
  if (r.feedback) res.append(el("em", "hint", r.feedback));
  box.append(res);
  if (ans && !scored) { scored = true; addXP(r.verdict === "great" ? 15 : r.verdict === "close" ? 8 : 2); }
  Tara.mood(r.verdict === "great" ? "happy" : r.verdict === "try" && !revealed ? "sad" : null);
  speak(r.verdict === "great" ? r.feedback : `${r.feedback} You can say: ${r.best}`, "en", { auto: true });
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/* ============ GAMES ============ */
const area = $("#gameArea");
let game = null;
const GAMES = {
  builder: { icon: "🧩", name: "Sentence Builder", rounds: 5, intro: "Tap the words in the right order to make a sentence." },
  spot: { icon: "🔍", name: "Spot the Mistake", rounds: 6, intro: "Two sentences. Tap the one that is correct." },
  spell: { icon: "👂", name: "Listen & Spell", rounds: 6, intro: "Listen to the word, then type it." },
  match: { icon: "🔗", name: "Word Match", rounds: 3, intro: "Tap an English word, then tap its meaning." },
};
function savedItems(type) {
  if (type === "builder") return pickSaved("builder", GAMES.builder.rounds);
  if (type === "spot") return pickSaved("spot", GAMES.spot.rounds);
  if (type === "spell") return pickSaved("words", GAMES.spell.rounds);
  return toBoards(pickSaved("words", 24), 3);
}
// Word Match: boards of 4 words, no two meanings alike on a board
function toBoards(words, max) {
  const boards = Array.from({ length: max }, () => []);
  for (const w of words) {
    const b = boards.find(b => b.length < 4 && !b.some(x => x.word === w.word || (x[tLang] || x.hi) === (w[tLang] || w.hi)));
    if (b) b.push(w);
  }
  return boards.filter(b => b.length === 4);
}
// New AI questions first. Returns null when AI is low, offline or fails.
async function newItems(type) {
  if (!canMakeNew()) return null;
  const kind = type === "spell" || type === "match" ? "words" : type;
  area.innerHTML = "";
  const ld = el("div", "loading"); ld.append(el("span", null, "✨"), el("span", null, "Getting new questions…")); area.append(ld);
  Tara.mood("thinking"); setCaption("Getting brand-new questions for you…");
  try {
    const { items } = await api("/api/game", { game: kind, level: level() });
    Tara.mood(null);
    if (type === "builder") {
      const list = items.map(i => String(i.sentence || "").replace(/[.?!,"]+/g, "").trim()).filter(s => s.split(" ").length > 2).slice(0, 6);
      learn("builder", list); markSeen("builder", list); return list.length >= 3 ? list : null;
    }
    if (type === "spot") {
      const list = items.filter(i => i.wrong && i.right).map(i => ({ wrong: String(i.wrong), right: String(i.right), why: String(i.why || "") })).slice(0, 6);
      learn("spot", list); markSeen("spot", list); return list.length >= 3 ? list : null;
    }
    const words = items.filter(i => i.word && i.hi && i.mr && !/\s/.test(String(i.word).trim())).map(i => ({ word: String(i.word).trim().toLowerCase(), hi: String(i.hi), mr: String(i.mr) }));
    learn("words", words); markSeen("words", words);
    if (type === "spell") return words.length >= 3 ? words.slice(0, 6) : null;
    const boards = toBoards(words, 2);
    return boards.length ? boards : null;
  } catch { Tara.mood(null); return null; }
}
async function startGame(type) {
  const g = GAMES[type];
  show("game", { title: `${g.icon} ${g.name}` });
  let items = await newItems(type), source = "new";
  if (!items) {
    items = savedItems(type); source = "saved";
    if (navigator.onLine && !canMakeNew()) toast("Using saved questions to keep your free AI for talking");
  }
  if (screen !== "game") return;
  game = { type, items, source, i: 0, correct: 0, total: 0, xp: 0 };
  renderQuestion();
  speak(g.intro, "en", { auto: true });
}
function gameHeader() {
  const top = el("div", "gtop");
  const badge = el("span", "badge" + (game.source === "saved" ? " saved" : ""), game.source === "new" ? "✨ New" : "📦 Saved");
  top.append(el("span", "qnum", `${game.type === "match" ? "Board" : "Question"} ${game.i + 1} of ${game.items.length}`), badge, el("span", "score", `✓ ${game.correct}`));
  const bar = el("div", "progress"), fill = el("i"); fill.style.width = (game.i / game.items.length * 100) + "%"; bar.append(fill);
  area.innerHTML = ""; area.append(top, bar);
  area.scrollTo(0, 0);
}
function nextBtn(label = "Next →") {
  const b = el("button", "primary wide", game.i + 1 >= game.items.length ? "See my score" : label);
  b.onclick = () => { game.i++; game.i >= game.items.length ? endGame() : renderQuestion(); };
  setTimeout(() => b.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
  return b;
}
function win(points = 10) { game.correct++; game.xp += points; addXP(points); Tara.mood("happy"); }
function feedback(ok, text) { return el("div", "feedback " + (ok ? "good" : "bad"), text); }
function renderQuestion() { gameHeader(); ({ builder: qBuilder, spot: qSpot, spell: qSpell, match: qMatch })[game.type](); }

// 🧩 Sentence Builder
function qBuilder() {
  const sentence = game.items[game.i], words = sentence.split(/\s+/);
  let pool = shuffle(words.map((w, id) => ({ w, id })));
  if (pool.map(p => p.w).join(" ") === sentence && words.length > 1) pool.reverse();
  let picked = [];
  game.total++;
  setCaption("Tap the words to build the sentence.");
  const ans = el("div", "tiles answer"), src = el("div", "tiles"), out = el("div");
  const check = el("button", "primary wide", "Check");
  const hear = el("button", "chip", "🔊 Hear the sentence"); hear.dataset.say = sentence;
  function draw() {
    ans.innerHTML = ""; src.innerHTML = "";
    if (!picked.length) ans.append(el("span", "hint", "Your sentence will appear here"));
    picked.forEach((p, k) => { const t = el("button", "tile", p.w); t.onclick = () => { picked.splice(k, 1); pool.push(p); draw(); }; ans.append(t); });
    pool.forEach((p, k) => { const t = el("button", "tile", p.w); t.onclick = () => { pool.splice(k, 1); picked.push(p); draw(); }; src.append(t); });
    check.disabled = pool.length > 0;
  }
  check.onclick = () => {
    const ok = norm(picked.map(p => p.w).join(" ")) === norm(sentence);
    check.remove(); src.remove(); ans.querySelectorAll("button").forEach(b => b.disabled = true);
    if (ok) win(); else Tara.mood("sad");
    out.append(feedback(ok, ok ? "Correct! 🎉" : "Not quite. The right order is:"));
    if (!ok) out.append(el("p", "ask", sentence));
    out.append(nextBtn());
    speak((ok ? "Great! " : "") + sentence + ".", "en");
  };
  draw();
  area.append(el("p", "ask", "Make the sentence:"), ans, src, hear, check, out);
}

// 🔍 Spot the Mistake
function qSpot() {
  const q = game.items[game.i]; game.total++;
  setCaption("Which sentence is correct?");
  area.append(el("p", "ask", "Which sentence is correct?"));
  const out = el("div");
  const opts = shuffle([{ t: q.right, ok: true }, { t: q.wrong, ok: false }]);
  const btns = opts.map(o => {
    const b = el("button", "opt", o.t);
    b.onclick = () => {
      btns.forEach((x, k) => { x.disabled = true; x.classList.add(opts[k].ok ? "right" : "wrong"); });
      if (o.ok) win(); else Tara.mood("sad");
      out.append(feedback(o.ok, (o.ok ? "Correct! " : "Oops! ") + (q.why || "")), nextBtn());
      speak(`${o.ok ? "Correct!" : "The right one is:"} ${q.right} ${q.why || ""}`, "en");
    };
    area.append(b); return b;
  });
  area.append(out);
}

// 👂 Listen & Spell
function qSpell() {
  const w = game.items[game.i]; game.total++;
  const hear = el("button", "chip", "🔊 Hear again"); hear.dataset.say = w.word;
  const slow = el("button", "chip", "🐢 Slowly"); slow.dataset.say = w.word; slow.dataset.slow = "1";
  const row = el("div", "btns"); row.append(hear, slow);
  const meaning = el("p", "hint", "Meaning: "); const m = el("strong", "deva", `${w.hi} (हिंदी) · ${w.mr} (मराठी)`); meaning.append(m);
  const inp = el("input", "spell-in"); inp.id = "spellInput"; inp.autocomplete = "off"; inp.setAttribute("autocapitalize", "off"); inp.setAttribute("spellcheck", "false"); inp.placeholder = "Type the word";
  const check = el("button", "primary wide", "Check"), out = el("div");
  const goCheck = () => {
    if (!inp.value.trim()) return;
    const ok = norm(inp.value) === norm(w.word);
    inp.disabled = true; check.remove();
    if (ok) win(); else Tara.mood("sad");
    out.append(feedback(ok, ok ? `Correct! ${w.word}` : `The correct spelling is: ${w.word.toUpperCase()}`), nextBtn());
    speak(ok ? `Perfect! ${w.word}` : `It is spelled ${w.word.split("").join(", ")}. ${w.word}.`, "en");
  };
  check.onclick = goCheck; inp.addEventListener("keydown", e => { if (e.key === "Enter") goCheck(); });
  area.append(el("p", "ask", "Listen and type the word"), row, meaning, inp, check, out);
  setTimeout(() => speak(w.word, "en", { rate: 0.85 }), game.i ? 0 : 2500);
}

// 🔗 Word Match: meanings shown in Hindi, with Marathi under them
function qMatch() {
  const board = game.items[game.i];
  setCaption("Tap an English word, then tap its meaning.");
  const left = el("div", "col"), right = el("div", "col"), grid = el("div", "match"), out = el("div");
  let sel = null, matched = 0; const tried = new Set();
  const L = shuffle(board), R = shuffle(board);
  const lb = L.map(w => { const b = el("button", "mbtn", w.word); b.onclick = () => { if (b.classList.contains("done")) return; lb.forEach(x => x.classList.remove("sel")); b.classList.add("sel"); sel = w; speak(w.word, "en"); }; left.append(b); return b; });
  R.forEach(w => {
    const b = el("button", "mbtn deva", w.hi === w.mr ? w.hi : `${w.hi} / ${w.mr}`);
    b.onclick = () => {
      if (!sel) { toast("First tap an English word on the left"); return; }
      if (b.classList.contains("done")) return;
      const lbtn = lb[L.indexOf(sel)];
      if (sel === w) {
        b.classList.add("done"); lbtn.classList.add("done"); lbtn.classList.remove("sel"); b.disabled = lbtn.disabled = true;
        game.total++; if (!tried.has(w.word)) win(5); matched++; sel = null;
        if (matched === board.length) { out.append(feedback(true, "Board complete! 🎉"), nextBtn("Next board →")); speak("Well done!", "en"); }
      } else {
        tried.add(sel.word); Tara.mood("sad");
        [b, lbtn].forEach(x => { x.classList.remove("shake"); void x.offsetWidth; x.classList.add("shake"); });
      }
    };
    right.append(b);
  });
  grid.append(left, right);
  area.append(el("p", "ask", "Match the word with its meaning"), grid, out);
}

function endGame() {
  const g = GAMES[game.type]; area.innerHTML = "";
  const box = el("div", "card end");
  const pct = game.total ? game.correct / game.total : 0;
  box.append(el("div", "big-icon", pct >= 0.8 ? "🏆" : pct >= 0.5 ? "👏" : "💪"), el("div", "final", `${game.correct}/${game.total}`), el("p", null, `You earned ${game.xp} ⭐`));
  const again = el("button", "primary wide", "▶ Play again"); again.onclick = () => startGame(game.type);
  const home = el("button", "secondary wide", "🏠 Back to Home"); home.onclick = goHome;
  box.append(again, home); area.append(box);
  Tara.mood(pct >= 0.6 ? "happy" : null);
  speak(pct >= 0.8 ? "Amazing work! You are getting better every day." : pct >= 0.5 ? "Good job! Keep practising." : "Nice try! Let's play again and improve.", "en", { auto: true });
}

/* ============ start ============ */
show("home");
history.replaceState({ screen: "home" }, "");
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
