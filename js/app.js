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
function toast(t) { document.querySelector(".toast")?.remove(); const d = el("div", "toast", t); document.body.append(d); clearTimeout(toastTimer); toastTimer = setTimeout(() => d.remove(), 2200); }

async function api(path, body) {
  if (!navigator.onLine) throw new Error("You are offline. Connect to the internet and try again.");
  const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json", "x-app-password": $("#password").value || "" }, body: JSON.stringify(body) });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(out.error || "Something went wrong. Try again.");
  return out;
}

/* ============ settings ============ */
["topic", "level", "accent", "rate", "password"].forEach(id => {
  const v = S.get(id, null); if (v != null) $("#" + id).value = v;
  $("#" + id).addEventListener("change", () => S.set(id, $("#" + id).value));
});
["autoSpeak", "autoSend"].forEach(id => {
  const v = S.get(id, null); if (v != null) $("#" + id).checked = v;
  $("#" + id).addEventListener("change", () => S.set(id, $("#" + id).checked));
});
$("#openSettings").onclick = () => $("#settings").showModal();
$("#closeSettings").onclick = () => { S.set("password", $("#password").value); $("#settings").close(); };
$("#newChat").onclick = () => { $("#settings").close(); showTab("talk"); freshChat(); };
const level = () => $("#level").value;

/* ============ points & streak ============ */
let prog = S.get("prog", { xp: 0, streak: 0, last: "" });
const dayStr = d => d.toDateString();
function renderProg() {
  const today = dayStr(new Date()), yest = dayStr(new Date(Date.now() - 864e5));
  $("#xp").textContent = prog.xp;
  $("#streak").textContent = (prog.last === today || prog.last === yest) ? prog.streak : 0;
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
  if (!SR) { toast("Voice needs Chrome (Android) or Safari (iPhone). You can type."); return; }
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
    else if (e.error === "no-speech") toast("I didn't hear anything. Try again.");
  };
  rec.onend = () => { activeRec = null; btn.classList.remove("on"); btn.textContent = "🎤"; Tara.mood(null); onDone?.(latest); };
  try { rec.start(); } catch { return; }
  activeRec = rec; btn.classList.add("on"); btn.textContent = "■";
  Tara.mood("listening"); setCaption("I'm listening…");
}

// any button with data-say / data-lang speaks its text
document.addEventListener("click", e => {
  const b = e.target.closest("[data-say]");
  if (b) speak(b.dataset.say, b.dataset.sayLang || "en", b.dataset.slow ? { rate: 0.6 } : {});
});

/* ============ tabs ============ */
let tab = "talk";
function showTab(name) {
  tab = name; stopSpeaking(); if (activeRec) activeRec.stop(); Tara.mood(null);
  document.querySelectorAll(".tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === name));
  ["talk", "translate", "games"].forEach(n => $("#p-" + n).hidden = n !== name);
  if (name === "talk") setCaption("Let's chat! Tap 🎤 and tell me something.");
  if (name === "translate") { if (!cur) nextSentence(); else speak(cur.native, tLang); }
  if (name === "games") { if (!game) gameMenu(); else setCaption("Pick a game to play!"); }
}
document.querySelectorAll(".tabs button").forEach(b => b.onclick = () => showTab(b.dataset.tab));

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
async function sendChat(text) {
  text = text.trim(); if (busy || !text) return;
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
    Tara.mood("sad"); setCaption(err.message);
  } finally { busy = false; $("#send").disabled = false; $("#talkMic").disabled = false; }
}
function freshChat() {
  log.innerHTML = ""; turns = [];
  botBubble(GREETING);
  const st = el("div", "starters");
  ["Today I go to office and finish my report.", "I am liking to watch movies in weekend.", "Yesterday I have cooked biryani for my family."]
    .forEach(t => st.append(el("button", null, t)));
  log.append(el("div", "note start", "Try one of these, or say your own:"), st);
  persistChat(); setCaption(GREETING);
}
log.addEventListener("click", e => { const s = e.target.closest(".starters button"); if (s) sendChat(s.textContent); });
$("#send").onclick = () => sendChat(msg.value);
msg.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) { e.preventDefault(); sendChat(msg.value); } });
$("#talkMic").onclick = () => micToggle($("#talkMic"), {
  onInterim: t => msg.value = t,
  onDone: t => { if ($("#autoSend").checked && t) sendChat(t); },
});
const savedView = S.get("view", null);
if (turns.length && savedView) { log.innerHTML = savedView; scrollLog(); } else freshChat();

/* ============ TRANSLATE ============ */
let tLang = S.get("tLang", "hi"), queue = [], cur = null, scored = false;
const LNAME = { hi: "Hindi", mr: "Marathi" };
document.querySelectorAll(".seg button").forEach(b => {
  b.classList.toggle("on", b.dataset.lang === tLang);
  b.onclick = () => {
    if (b.dataset.lang === tLang) return;
    tLang = b.dataset.lang; S.set("tLang", tLang); queue = [];
    document.querySelectorAll(".seg button").forEach(x => x.classList.toggle("on", x === b));
    nextSentence();
  };
});
async function nextSentence() {
  $("#tResult").innerHTML = ""; $("#tInput").value = ""; $("#tHintText").hidden = true; scored = false;
  $("#tNext").disabled = true;
  if (!queue.length) {
    $("#tNative").textContent = "…"; $("#tRoman").textContent = "";
    Tara.mood("thinking"); setCaption(`Making new ${LNAME[tLang]} sentences for you…`);
    try { queue = (await api("/api/translate", { action: "new", lang: tLang, level: level(), topic: $("#topic").value })).items; }
    catch (e) { queue = shuffle(TRANSLATE[tLang]).slice(0, 5); toast("Using built-in sentences"); }
    Tara.mood(null);
  }
  cur = queue.shift();
  $("#tNative").textContent = cur.native; $("#tRoman").textContent = cur.roman;
  $("#tNext").disabled = false;
  if (tab === "translate") speak(cur.native, tLang);
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
  let r;
  try { r = await api("/api/translate", { action: "check", lang: tLang, native: cur.native, english: cur.english, answer: ans }); }
  catch (e) { r = localCheck(ans, cur.english); r.feedback += " (Checked offline.)"; }
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
  builder: { icon: "🧩", name: "Sentence Builder", desc: "Put the words in the right order.", rounds: 5 },
  spot: { icon: "🔍", name: "Spot the Mistake", desc: "Pick the correct sentence.", rounds: 6 },
  spell: { icon: "👂", name: "Listen & Spell", desc: "Hear Tara say a word, then type it.", rounds: 6 },
  match: { icon: "🔗", name: "Word Match", desc: "Match English words to their meaning.", rounds: 3 },
};
function gameMenu() {
  game = null; area.innerHTML = "";
  setCaption("Pick a game! Every correct answer gives you 10 stars.");
  area.append(el("h2", "gtitle", "Games"));
  const grid = el("div", "games");
  Object.entries(GAMES).forEach(([k, g]) => {
    const c = el("button", "gcard"); c.append(el("span", "gi", g.icon), el("b", null, g.name), el("small", null, g.desc));
    c.onclick = () => startGame(k); grid.append(c);
  });
  area.append(grid);
  area.querySelector(".gtitle").style.cssText = "font:800 1.2rem var(--display);margin:0";
}
function localItems(type) {
  if (type === "builder") return shuffle(BUILDER).slice(0, GAMES.builder.rounds);
  if (type === "spot") return shuffle(SPOT).slice(0, GAMES.spot.rounds);
  if (type === "spell") return shuffle(WORDS).slice(0, GAMES.spell.rounds);
  const w = shuffle(WORDS); return [0, 1, 2].map(i => w.slice(i * 4, i * 4 + 4));
}
async function aiItems(type) {
  const kind = type === "spell" || type === "match" ? "words" : type;
  Tara.mood("thinking"); setCaption("Making brand-new questions for you…");
  area.innerHTML = ""; area.append(el("p", "note", "Making new questions…"));
  try {
    const { items } = await api("/api/game", { game: kind, level: level() });
    Tara.mood(null);
    if (type === "builder") return items.map(i => String(i.sentence || "").replace(/[.?!,"]+/g, "").trim()).filter(s => s.split(" ").length > 2).slice(0, 6);
    if (type === "spot") return items.filter(i => i.wrong && i.right).slice(0, 6);
    const words = items.filter(i => i.word && i.hi && i.mr).map(i => ({ word: String(i.word).trim(), hi: i.hi, mr: i.mr }));
    if (type === "spell") return words.slice(0, 6);
    return [words.slice(0, 4), words.slice(4, 8)].filter(b => b.length === 4);
  } catch (e) { Tara.mood("sad"); toast(e.message); return null; }
}
async function startGame(type, useAI = false) {
  let items = useAI ? await aiItems(type) : null;
  if (!items || !items.length) items = localItems(type);
  game = { type, items, i: 0, correct: 0, total: 0, xp: 0 };
  renderQuestion();
}
function gameHeader() {
  const g = GAMES[game.type];
  const top = el("div", "gtop");
  const back = el("button", "secondary", "‹ Games"); back.onclick = () => { stopSpeaking(); gameMenu(); };
  top.append(back, el("h2", null, g.icon + " " + g.name), el("b", null, `${game.correct} ✓`));
  const bar = el("div", "progress"), fill = el("i"); fill.style.width = (game.i / game.items.length * 100) + "%"; bar.append(fill);
  area.innerHTML = ""; area.append(top, bar);
}
function nextBtn(label = "Next →") {
  const b = el("button", "primary wide", game.i + 1 >= game.items.length ? "See my score" : label);
  b.onclick = () => { game.i++; game.i >= game.items.length ? endGame() : renderQuestion(); };
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
    picked.forEach((p, k) => { const t = el("button", "tile", p.w); t.onclick = () => { picked.splice(k, 1); pool.push(p); draw(); }; ans.append(t); });
    pool.forEach((p, k) => { const t = el("button", "tile", p.w); t.onclick = () => { pool.splice(k, 1); picked.push(p); draw(); }; src.append(t); });
    check.disabled = pool.length > 0;
  }
  check.onclick = () => {
    const ok = norm(picked.map(p => p.w).join(" ")) === norm(sentence);
    check.remove(); src.remove(); ans.querySelectorAll("button").forEach(b => b.disabled = true);
    if (ok) win(); else Tara.mood("sad");
    out.append(feedback(ok, ok ? "Correct! 🎉" : "Not quite. The right order is:"));
    if (!ok) out.append(el("p", null, sentence));
    out.append(nextBtn());
    speak((ok ? "Great! " : "") + sentence + ".", "en");
  };
  draw();
  area.append(el("p", "hint", "Your sentence:"), ans, src, hear, check, out);
}

// 🔍 Spot the Mistake
function qSpot() {
  const q = game.items[game.i]; game.total++;
  setCaption("Which sentence is correct?");
  area.append(el("p", "hint", "Which sentence is correct?"));
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
  const meaning = el("p", "hint", `Meaning in ${LNAME[tLang]}: `); const m = el("strong", null, w[tLang] || w.hi); m.style.fontFamily = "var(--deva)"; meaning.append(m);
  const inp = el("input", "spell-in"); inp.id = "spellInput"; inp.autocomplete = "off"; inp.setAttribute("autocapitalize", "off"); inp.setAttribute("spellcheck", "false"); inp.placeholder = "Type the word";
  const check = el("button", "primary wide", "Check"), out = el("div");
  const go = () => {
    if (!inp.value.trim()) return;
    const ok = norm(inp.value) === norm(w.word);
    inp.disabled = true; check.remove();
    if (ok) win(); else Tara.mood("sad");
    out.append(feedback(ok, ok ? `Correct! ${w.word}` : `The correct spelling is: ${w.word.toUpperCase()}`), nextBtn());
    speak(ok ? `Perfect! ${w.word}` : `It is spelled ${w.word.split("").join(", ")}. ${w.word}.`, "en");
  };
  check.onclick = go; inp.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
  area.append(el("p", "hint", "Listen to Tara and type the word you hear."), row, meaning, inp, check, out);
  speak(w.word, "en", { rate: 0.85 });
}

// 🔗 Word Match
function qMatch() {
  const board = game.items[game.i];
  setCaption(`Match each English word with its ${LNAME[tLang]} meaning.`);
  const left = el("div", "col"), right = el("div", "col"), grid = el("div", "match"), out = el("div");
  let sel = null, matched = 0; const tried = new Set();
  const L = shuffle(board), R = shuffle(board);
  const lb = L.map(w => { const b = el("button", "mbtn", w.word); b.onclick = () => { if (b.classList.contains("done")) return; lb.forEach(x => x.classList.remove("sel")); b.classList.add("sel"); sel = w; speak(w.word, "en"); }; left.append(b); return b; });
  R.forEach(w => {
    const b = el("button", "mbtn deva", w[tLang] || w.hi);
    b.onclick = () => {
      if (!sel || b.classList.contains("done")) return;
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
  area.append(el("p", "hint", "Tap an English word, then its meaning."), grid, out);
}

function endGame() {
  const g = GAMES[game.type]; area.innerHTML = "";
  const box = el("div", "card end");
  const pct = game.total ? game.correct / game.total : 0;
  box.append(el("div", null, g.icon), el("div", "score", `${game.correct}/${game.total}`), el("p", null, `You earned ${game.xp} ⭐`));
  const again = el("button", "primary wide", "Play again"); again.onclick = () => startGame(game.type);
  const ai = el("button", "secondary wide", "✨ New questions by AI"); ai.onclick = () => startGame(game.type, true);
  const back = el("button", "secondary wide", "Back to games"); back.onclick = gameMenu;
  box.append(again, ai, back); area.append(box);
  Tara.mood(pct >= 0.6 ? "happy" : null);
  speak(pct >= 0.8 ? "Amazing work! You are getting better every day." : pct >= 0.5 ? "Good job! Keep practising." : "Nice try! Let's play again and improve.", "en", { auto: true });
}

/* ============ start ============ */
setCaption("Hi! I'm Tara. Let's practise English together. Tap 🎤 to talk.");
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
