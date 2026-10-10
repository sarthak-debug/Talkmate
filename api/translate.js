// Translate mode.
//  action "new":   returns 5 sentences in Hindi or Marathi for the learner to say in English.
//  action "check": grades the learner's English answer.
import { guard, askClaude, run, clip, LANG } from "../lib/claude.js";

export default async function handler(req, res) {
  if (!guard(req, res)) return;
  const b = req.body || {};
  const lang = LANG[b.lang] ? b.lang : "hi";
  const L = LANG[lang];
  const level = clip(b.level, 20, "intermediate");

  if (b.action === "new") {
    return run(res, async () => {
      const out = await askClaude({
        system: `You create speaking practice for an Indian learner of English. Write natural, everyday ${L} sentences (in Devanagari script, correct ${L} grammar - not Hindi words in Marathi or vice versa) that the learner will translate into English out loud.
Level: ${level}. Beginner = 4-7 words, present/past simple. Intermediate = 6-10 words, mixed tenses, questions. Advanced = 9-15 words, perfect tenses, conditionals, polite requests.
Topic: ${clip(b.topic, 80, "daily life")}. Vary the sentences.`,
        messages: [{ role: "user", content: `Give 5 sentences. Reply with ONLY JSON:
{"items":[{"native":"${L} sentence in Devanagari","roman":"same sentence in Roman letters","english":"natural English translation","hint":"short grammar hint in English, e.g. 'Use past tense'"}]}` }],
        maxTokens: 900,
      });
      const items = (out.items || []).filter(i => i?.native && i?.english).slice(0, 5)
        .map(i => ({ native: String(i.native), roman: String(i.roman || ""), english: String(i.english), hint: String(i.hint || "") }));
      if (!items.length) throw new Error("Could not create sentences. Try again.");
      return { items };
    });
  }

  if (b.action === "check") {
    return run(res, async () => {
      const out = await askClaude({
        system: `You are Tara, a kind English teacher. The learner heard a ${L} sentence and said it in English (speech converted to text, so ignore capitals, punctuation and small transcription glitches). Accept any correct, natural translation, not only the reference. Judge meaning AND grammar.`,
        messages: [{ role: "user", content: `${L} sentence: ${clip(b.native, 300)}
Reference English: ${clip(b.english, 300)}
Learner said: ${clip(b.answer, 400)}

Reply with ONLY JSON:
{"score": 0-100, "verdict": "great|close|try", "feedback": "one or two short encouraging spoken sentences", "best": "the best natural English sentence (theirs if it was already perfect)", "corrections": [{"original":"learner words","better":"corrected words","why":"very short reason"}]}
great = correct meaning and grammar (score 85+); close = meaning right but grammar or word mistakes (50-84); try = meaning wrong or missing (below 50).` }],
      });
      const v = ["great", "close", "try"].includes(out.verdict) ? out.verdict : "close";
      return {
        score: Math.max(0, Math.min(100, Number(out.score) || 0)),
        verdict: v,
        feedback: String(out.feedback || out._raw || ""),
        best: String(out.best || b.english || ""),
        corrections: Array.isArray(out.corrections) ? out.corrections.filter(c => c?.original && c?.better) : [],
      };
    });
  }

  res.status(400).json({ error: "Unknown action" });
}
