// Fresh AI-made questions for the mini-games.
//  game "builder": sentences to rebuild from shuffled words
//  game "spot":    a wrong and a right sentence
//  game "words":   English words with Hindi and Marathi meanings (Listen & Spell, Word Match)
import { guard, askClaude, run, clip } from "../lib/claude.js";

const SPECS = {
  builder: `{"items":[{"sentence":"A correct, natural English sentence"}]}  -- 6 items. Beginner 4-6 words, intermediate 6-9, advanced 9-13. No commas or quotes inside sentences.`,
  spot: `{"items":[{"wrong":"sentence with ONE common mistake Indian learners make","right":"the corrected sentence","why":"very short reason"}]}  -- 6 items, different kinds of mistakes (tense, articles, prepositions, word order, Indian-English habits).`,
  words: `{"items":[{"word":"English word","hi":"Hindi meaning in Devanagari","mr":"Marathi meaning in Devanagari"}]}  -- 8 useful everyday words that are tricky to spell. Single words only.`,
};

export default async function handler(req, res) {
  if (!guard(req, res)) return;
  const b = req.body || {};
  const game = SPECS[b.game] ? b.game : "builder";
  const avoid = Array.isArray(b.avoid) ? b.avoid.slice(0, 40).map(x => clip(x, 60)).join("; ") : "";
  await run(res, async () => {
    const out = await askClaude({
      system: "You create short English-learning game questions for an Indian learner. Everything must be correct and natural.",
      messages: [{ role: "user", content: `Level: ${clip(b.level, 20, "intermediate")}.${avoid ? ` Do not repeat these: ${avoid}.` : ""}
Reply with ONLY JSON in this shape:
${SPECS[game]}` }],
      maxTokens: 900,
    });
    const items = Array.isArray(out.items) ? out.items : [];
    if (!items.length) throw new Error("Could not make new questions. Try again.");
    return { items };
  });
}
