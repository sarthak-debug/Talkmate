# TalkMate – AI English Speaking Partner (mobile app)

TalkMate helps you practise spoken English with **Tara**, an animated partner who talks, listens and corrects you kindly.

The app opens on a **Home screen** with one big button for each activity. Tap one to open it, and tap **‹ Home** (or the phone's Back button) to return.

| Activity | What you do |
|---|---|
| 💬 **Talk with Tara** | Chat by voice or typing. She answers out loud, asks you questions, and shows your mistakes as *wrong → right* with a short reason. |
| हि **Hindi → English** / म **Marathi → English** | Tara says a sentence in Hindi or Marathi. You say it in English. She scores it (0–100), shows the best way to say it and explains your mistakes. |
| 🧩 🔍 👂 🔗 **Games** | Sentence Builder, Spot the Mistake, Listen & Spell, Word Match. Each one opens on its own screen. |

Built for all ages: large buttons, simple words, Tara reads the instructions aloud, and **⚙︎ → Text size** makes everything bigger (Normal, Large, Extra large).

You earn ⭐ points for practice, and 🔥 counts how many days in a row you've practised.

Tara's mouth moves while she speaks. She also blinks, tilts her head when listening, shows thinking dots, and smiles and hops when you get it right.

TalkMate is a Progressive Web App (PWA). You install it from the browser onto your home screen, and it opens full-screen like a normal app.

## Files

| File | What it does |
|---|---|
| `index.html`, `styles.css` | The screens and Tara's drawing |
| `js/app.js` | Everything the app does: voice, Tara's animation, chat, translate, games, points |
| `js/data.js` | Built-in sentences, words and Hindi/Marathi practice (edit this to add your own) |
| `api/chat.js`, `api/translate.js`, `api/game.js` | Server functions that talk to the AI and keep your API key secret |
| `api/status.js` | Tells the app how much free AI is left today (for the battery). Uses no AI requests. |
| `lib/claude.js` | Shared server code, including the AI provider switch |
| `manifest.json`, `sw.js`, `icon-*.png` | Make it installable as an app |

## Setup (about 15 minutes, free hosting)

### 1. Get a Claude API key
1. Go to https://console.anthropic.com and sign up.
2. Add a little credit under **Billing**. TalkMate uses the fast, low-cost Haiku model, and $5 lasts one person a long time.
3. Open **API Keys** → **Create Key** and copy it (it starts with `sk-ant-`). Keep it private.

### 2. Put the code on GitHub
1. Create a free account at https://github.com.
2. Click **New repository**, name it `talkmate`, and click **Create**.
3. Click **uploading an existing file**, drag in **everything inside the `talkmate` folder** (including the `api`, `js` and `lib` folders), then click **Commit**.

### 3. Deploy on Vercel (free)
1. Go to https://vercel.com and sign up **with GitHub**.
2. Click **Add New → Project**, choose `talkmate`, then **Import**.
3. Under **Environment Variables**, add:
   - `ANTHROPIC_API_KEY` = your key
   - `APP_PASSWORD` = any password (recommended, so strangers can't use your credit)
4. Click **Deploy**. You get a link like `https://talkmate-xyz.vercel.app`.

### Using a different AI provider (optional)
TalkMate can use other AI services instead of Claude. In Vercel → **Settings → Environment Variables**, set these, then click **Redeploy**:

| Variable | Value |
|---|---|
| `AI_PROVIDER` | `anthropic` (default), `openai`, `gemini`, `groq`, `openrouter`, `deepseek`, or `custom` |
| `AI_API_KEY` | the key from that provider |
| `AI_MODEL` | the model name, copied exactly from the provider's model list (required for every provider except Claude) |
| `AI_BASE_URL` | only for `custom`: the full URL of any OpenAI-compatible `/chat/completions` endpoint |

Where to get keys:
- **Google Gemini:** https://aistudio.google.com/apikey
- **Groq:** https://console.groq.com/keys
- **OpenAI:** https://platform.openai.com/api-keys
- **OpenRouter** (one key for many models): https://openrouter.ai/keys
- **DeepSeek:** https://platform.deepseek.com

Gemini and Groq have offered free tiers, but limits and prices change, so check the provider's pricing page. Corrections and the Hindi/Marathi checks depend on the model's quality. Small free models make more mistakes, especially in Marathi.

To change the main provider, change the variables and redeploy. The app on your phone doesn't need any change.

### Backup AI: keeps Tara talking when a free limit runs out (optional)
Add a second provider by using the same names ending in `_2`. You can add a third with `_3`. When the main provider fails, for example when OpenRouter's 50-a-day free limit is used up, TalkMate automatically uses the backup.

Example: OpenRouter as main and Google Gemini as backup:

| Key | Value |
|---|---|
| `AI_PROVIDER` | `openrouter` |
| `AI_API_KEY` | your OpenRouter key (`sk-or-v1-…`) |
| `AI_MODEL` | `nvidia/nemotron-3-super-120b-a12b:free` |
| `AI_PROVIDER_2` | `gemini` |
| `AI_API_KEY_2` | your Gemini key from https://aistudio.google.com/apikey |
| `AI_MODEL_2` | a free Gemini model ID, copied from Google AI Studio (for example a "Flash" or "Flash-Lite" model) |

After adding them, **Redeploy**. If every provider has hit its limit, Tara says so, and the games and saved Translate sentences keep working without AI.

## AI battery 🔋
The battery at the top shows how much **free AI is left today**. It counts down as you use Tara and turns orange, then red, as it gets low. Tap it to see the exact number and when it refills.
- With an OpenRouter free model, it shows the real number left (for example 38 of 50). It refills every day at 5:30 AM India time (midnight UTC).
- With other providers, it shows **AI** while the AI works, and empties if a daily limit is reached.
- If a backup AI is set up, the battery shows **B** when the main one is empty and the backup is answering.

## New questions first, then saved ones
- Translate and every game ask the AI for **brand-new** questions first. They're marked **✨ New**.
- Every new sentence, question and word is **saved on your phone**, so your offline collection keeps growing. Home shows how many you have (📦 saved).
- When the battery gets low (5 or fewer left), offline, or the AI fails, they switch to **saved** questions automatically. These are marked **📦 Saved**. This keeps the last few AI requests for talking with Tara.
- Saved practice picks questions you haven't seen recently.
- TalkMate comes with 25 Hindi and 25 Marathi sentences, 40 builder sentences, 30 spot-the-mistake questions and 40 words. To add your own permanently, edit `js/data.js`.

### 4. Install on your phone
- **Android (Chrome):** open the link, then tap **⋮ → Add to Home screen / Install app**.
- **iPhone (Safari):** open the link, then tap **Share → Add to Home Screen**.

Open TalkMate, tap **⚙︎** and enter your app password. Then tap **🎤** and allow the microphone.

### 5. Hindi and Marathi voices (Android)
For Tara to speak Hindi and Marathi, the phone needs those voices. Go to **Settings → Accessibility (or System) → Text-to-speech → Google → ⚙︎ → Install voice data** and download **Hindi** and **Marathi**. TalkMate's Settings screen shows which voices your phone has. If Marathi is missing, Tara reads Marathi with the Hindi voice, and the sentence is always shown on screen.

## Tips
- In Settings you can change the topic, level, your accent (Indian English is the default so the mic understands you better), and Tara's speaking speed.
- Voice input works best in **Chrome on Android** and **Safari on iPhone**.
- Talk needs the internet and the AI. Games and saved Translate sentences work offline.
- Your progress and chat are stored only on your phone.
- For richer answers from Claude, set `AI_MODEL` to `claude-sonnet-5-5` (this costs more).

## Later: Google Play Store
Go to https://www.pwabuilder.com, paste your Vercel link, choose **Android**, and download the Play Store package. A Google Play developer account costs a one-time $25.
