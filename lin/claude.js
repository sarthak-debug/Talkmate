// Shared helper for the server functions: checks the app password,
// calls the AI provider you chose, and returns the reply parsed as JSON.
//
// Choose a provider with environment variables in Vercel:
//   AI_PROVIDER = anthropic (default) | openai | gemini | groq | openrouter | deepseek | custom
//   AI_API_KEY  = the key for that provider   (ANTHROPIC_API_KEY also works for anthropic)
//   AI_MODEL    = model name from the provider's docs (required for every provider except anthropic)
//   AI_BASE_URL = only for "custom": full URL of an OpenAI-compatible /chat/completions endpoint

const OPENAI_COMPATIBLE = {
  openai: "https://api.openai.com/v1/chat/completions",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  groq: "https://api.groq.com/openai/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  deepseek: "https://api.deepseek.com/chat/completions",
};

function config() {
  const provider = (process.env.AI_PROVIDER || "anthropic").toLowerCase().trim();
  const key = process.env.AI_API_KEY || (provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : "");
  const model = process.env.AI_MODEL || process.env.CLAUDE_MODEL || (provider === "anthropic" ? "claude-haiku-5-5" : "");
  const url = provider === "custom" ? process.env.AI_BASE_URL : OPENAI_COMPATIBLE[provider];
  return { provider, key, model, url };
}

function configError() {
  const c = config();
  if (c.provider !== "anthropic" && !OPENAI_COMPATIBLE[c.provider] && c.provider !== "custom")
    return `Unknown AI_PROVIDER "${c.provider}". Use anthropic, openai, gemini, groq, openrouter, deepseek or custom.`;
  if (!c.key) return "Server is missing the API key. Set AI_API_KEY in Vercel.";
  if (!c.model) return `Set AI_MODEL in Vercel to a model name from your ${c.provider} account.`;
  if (c.provider === "custom" && !c.url) return "Set AI_BASE_URL for the custom provider.";
  return "";
}

export function guard(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Use POST" }); return false; }
  const pass = process.env.APP_PASSWORD;
  if (pass && req.headers["x-app-password"] !== pass) {
    res.status(401).json({ error: "Wrong app password. Open Settings (⚙︎) and enter it." });
    return false;
  }
  const err = configError();
  if (err) { res.status(500).json({ error: err }); return false; }
  return true;
}

export const clip = (v, n, d = "") => String(v ?? d).slice(0, n);
export const LANG = { hi: "Hindi", mr: "Marathi" };

async function callAnthropic({ key, model }, system, messages, maxTokens) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error?.message || `AI error (${r.status})`);
  return (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
}

async function callOpenAICompatible({ key, model, url, provider }, system, messages, maxTokens) {
  const headers = { "content-type": "application/json", authorization: `Bearer ${key}` };
  if (provider === "openrouter") headers["X-Title"] = "TalkMate";
  const r = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.7,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = Array.isArray(data) ? data[0]?.error : data?.error;
    throw new Error(e?.message || `AI error (${r.status})`);
  }
  return data?.choices?.[0]?.message?.content || "";
}

export async function askClaude({ system, messages, maxTokens = 700 }) {
  const c = config();
  const text = c.provider === "anthropic"
    ? await callAnthropic(c, system, messages, maxTokens)
    : await callOpenAICompatible(c, system, messages, maxTokens);
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  try { return JSON.parse(text.slice(s, e + 1)); }
  catch { return { _raw: text.replace(/```(json)?/g, "").trim() }; }
}

export async function run(res, fn) {
  try { res.status(200).json(await fn()); }
  catch (err) { res.status(502).json({ error: err.message || "Could not reach the AI. Try again." }); }
}
