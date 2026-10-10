// Talk mode: friendly conversation + corrections.
import { guard, askClaude, run, clip } from "../lib/claude.js";

const SYSTEM = (level, topic) => `You are Tara, a warm, patient English conversation partner for a learner from India who has nobody else to practise English with.
Learner level: ${level}. Conversation topic: ${topic}.
The learner may be speaking (speech converted to text), so ignore capital letters, punctuation and small transcription glitches.

For EVERY learner message:
1. Find real mistakes in grammar, word choice, tense, articles, prepositions, or unnatural phrasing (including common Indian-English patterns like "I am having", "discuss about", "revert back"). Do not invent mistakes. If it is correct, return an empty list.
2. Write a friendly, natural spoken reply (1-3 short sentences${level === "beginner" ? ", simple words" : ""}) that shows interest and ends with ONE easy follow-up question.
3. Never lecture in the reply. Corrections go only in the corrections list.
4. If the learner writes in Hindi or Marathi, reply in English and give the English way to say it as a correction.
5. mood: "happy" if the message had no mistakes, otherwise "neutral".

Reply with ONLY JSON:
{"reply": "...", "corrections": [{"original": "...", "better": "...", "why": "very short reason"}], "tip": "one useful phrase, or empty string", "mood": "happy|neutral"}`;

export default async function handler(req, res) {
  if (!guard(req, res)) return;
  const { messages = [], level, topic } = req.body || {};
  const clean = messages
    .filter(m => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-20).map(m => ({ role: m.role, content: m.content.slice(0, 2000) }));
  while (clean.length && clean[0].role !== "user") clean.shift();
  if (!clean.length || clean.at(-1).role !== "user") return res.status(400).json({ error: "No message to answer." });

  await run(res, async () => {
    const out = await askClaude({ system: SYSTEM(clip(level, 20, "intermediate"), clip(topic, 100, "daily life")), messages: clean });
    return {
      reply: String(out.reply || out._raw || "Sorry, could you say that again?"),
      corrections: Array.isArray(out.corrections) ? out.corrections.filter(c => c?.original && c?.better) : [],
      tip: String(out.tip || ""),
      mood: out.mood === "happy" ? "happy" : "neutral",
    };
  });
}
