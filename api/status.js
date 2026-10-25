// Reports how much free AI is left today, for the battery in the app.
// This call does not use up any AI requests.
import { guard, quota, run } from "../lib/claude.js";

export default async function handler(req, res) {
  if (!guard(req, res)) return;
  res.setHeader("cache-control", "no-store");
  await run(res, quota);
}
