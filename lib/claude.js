// Shared helper for the server functions: checks the app password,
// calls your AI provider(s), and returns the reply parsed as JSON.
//
// MAIN provider (Vercel environment variables):
//   AI_PROVIDER = anthropic (default) | openai | gemini | groq | openrouter | deepseek | custom
//   AI_API_KEY  = the key for that provider   (ANTHROPIC_API_KEY also works for anthropic)
//   AI_MODEL    = model name from the provider (required for every provider except anthropic).
//                 For openrouter you may list several, separated by commas.
//   AI_BASE_URL = only for "custom": an OpenAI-compatible /chat/completions URL
//
// BACKUP providers (optional): the same four names ending in _2 (and _3), e.g.
//   AI_PROVIDER_2=gemini  AI_API_KEY_2=...  AI_MODEL_2=...
// If the main provider fails (daily limit reached, busy, error), the next one is tried automatically.

const OPENAI_COMPATIBLE = {
  openai: "https://api.openai.com/v1/chat/completions",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  groq: "https://api.groq.com/openai/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  deepseek: "https://api.deepseek.com/chat/completions",
};
const env = n => (process.env[n] || "").trim();

function readSlot(suffix) {
  const provider = (env("AI_PROVIDER" + suffix) || (suffix === "" ? "anthropic" : "")).toLowerCase();
  if (!provider) return null;
  const key = env("AI_API_KEY" + suffix) || (provider === "anthropic" && suffix === "" ? env("ANTHROPIC_API_KEY") : "");
  const model = env("AI_MODEL" + suffix) || (suffix === "" ? env("CLAUDE_MODEL") : "") || (provider === "anthropic" ? "claude-haiku-5-5" : "");
  const url = provider === "custom" ? env("AI_BASE_URL" + suffix) : OPENAI_COMPATIBLE[provider];
  const name = suffix ? `backup${suffix}` : "main";
  let problem = "";
  if (provider !== "anthropic" && !url) problem = provider === "custom" ? `AI_BASE_URL${suffix} is missing` : `unknown AI_PROVIDER${suffix} "${provider}"`;
  else if (!key) problem = `AI_API_KEY${suffix} is missing`;
  else if (!model) problem = `AI_MODEL${suffix} is missing`;
  return { provider, key, model, url, name, problem };
}

function providers() {
  return ["", "_2", "_3"].map(readSlot).filter(Boolean);
}

export function guard(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Use POST" }); return false; }
  const pass = process.env.APP_PASSWORD;
  if (pass && req.headers["x-app-password"] !== pass) {
    res.status(401).json({ error: "Wrong app password. Open Settings (⚙︎) and enter it." });
    return false;
  }
  const usable = providers().filter(p => !p.problem);
  if (!usable.length) {
    const p = providers()[0];
    res.status(500).json({ error: `AI is not set up: ${p?.problem || "no provider"}. Fix it in Vercel → Environment Variables, then Redeploy.` });
    return false;
  }
  return true;
}

export const clip = (v, n, d = "") => String(v ?? d).slice(0, n);
export const LANG = { hi: "Hindi", mr: "Marathi" };

class AIError extends Error {
  constructor(msg, status) { super(msg); this.status = status; }
}

async function callAnthropic({ key, model }, system, messages, maxTokens) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new AIError(data?.error?.message || `AI error (${r.status})`, r.status);
  return (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
}

async function callOpenAICompatible({ key, model, url, provider }, system, messages, maxTokens) {
  const headers = { "content-type": "application/json", authorization: `Bearer ${key}` };
  const body = {
    model,
    max_tokens: maxTokens,
    temperature: 0.7,
    messages: [{ role: "system", content: system }, ...messages],
  };
  if (provider === "openrouter") {
    headers["X-Title"] = "TalkMate";
    const list = model.split(",").map(m => m.trim()).filter(Boolean);
    body.model = list[0];
    if (list.length > 1) body.models = list;
    body.reasoning = { effort: "low", exclude: true }; // keep "thinking" short on reasoning models
  }
  // Many models think before answering; leave room so the reply isn't cut off.
  if (provider === "openrouter" || provider === "gemini") body.max_tokens = Math.max(maxTokens, 3000);
  const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = Array.isArray(data) ? data[0]?.error : data?.error;
    throw new AIError(e?.message || `AI error (${r.status})`, r.status);
  }
  return data?.choices?.[0]?.message?.content || "";
}

const isLimit = e => e?.status === 429 || /rate.?limit|quota|exhausted|per-day/i.test(e?.message || "");

export async function askClaude({ system, messages, maxTokens = 700 }) {
  const list = providers().filter(p => !p.problem);
  const errors = [];
  for (const p of list) {
    try {
      const text = p.provider === "anthropic"
        ? await callAnthropic(p, system, messages, maxTokens)
        : await callOpenAICompatible(p, system, messages, maxTokens);
      if (!text.trim()) throw new AIError("The AI sent an empty answer.", 502);
      const s = text.indexOf("{"), e = text.lastIndexOf("}");
      let out;
      try { out = JSON.parse(text.slice(s, e + 1)); }
      catch { out = { _raw: text.replace(/```(json)?/g, "").trim() }; }
      out._via = p.name;
      return out;
    } catch (err) {
      console.warn(`[talkmate] ${p.name} (${p.provider}) failed:`, err.message);
      errors.push(err);
    }
  }
  if (errors.length && errors.every(isLimit)) {
    throw new AIError("Today's free AI limit is used up. Try again later, or play the Games and saved Translate sentences, which work without AI.", 429);
  }
  throw errors.at(-1) || new AIError("Could not reach the AI. Try again.", 502);
}

export async function run(res, fn) {
  try { res.status(200).json(await fn()); }
  catch (err) { res.status(err.status === 429 ? 429 : 502).json({ error: err.message || "Could not reach the AI. Try again." }); }
}
