<div align="center">

# 🏙️ Komşu — the Agent Upstairs Neighbor

**An AI agent that turns any ordinary CCTV camera into a watchful neighbor** — it *sees* the scene, *reasons* about what matters, and *acts* on its own to keep you informed, in Turkish, over WhatsApp, Telegram and the web.

🔗 **Live demo:** [komsu.aymam.ai](https://komsu.aymam.ai) · a product concept by [aymam.ai](https://aymam.ai)

</div>

---

## Why this is an *agent*, not just a camera app

Most "smart camera" tools are passive: they record, and maybe run a fixed detector. Komşu closes the full **perceive → reason → act** loop and holds standing goals on your behalf:

| Agent capability | How Komşu does it |
|---|---|
| **Perceive** | Streams RTSP → detects motion locally (grid diff, no cloud cost) → sends only meaningful frames to a vision LLM |
| **Reason** | Google **Gemini** describes the scene, answers free-form questions, and judges whether user-defined conditions are met — with structured (JSON-schema) output |
| **Act** | Proactively messages you: danger alerts *and* your own natural-language "watch" requests, delivered on the channel you used |
| **Hold intent** | You say *"minibüs gelirse bugün haber ver"* — it parses that into a persistent goal, watches for it across frames, and notifies you when it happens |
| **Be reliable** | Multi-key rotation, per-model quota fallback, transient-retry, self-healing webhooks — so the agent keeps working unattended |

The **watch feature** is the clearest expression of agency: the operator hands over a goal in plain language, and the system autonomously pursues it until it's met or expires — no rules to configure, no dashboards to watch.

---

## ✨ What it does

- **📹 Live view + AI chat** — ask *"şu an ne oluyor?"*, *"son bir saatte ne oldu?"*, *"kaç araba var?"* on the web, WhatsApp or Telegram. Present-tense questions analyze the **live frame**; detail questions re-analyze **saved frames** (colour, clothing, count).
- **📝 Activity log** — motion triggers a short, timestamped scene description, kept in history for time-window questions (*"dün akşam ne oldu?"*, *"geçen hafta?"*).
- **🚨 Proactive danger alerts** — smoking, fire, fall, fight, weapon, medical, intrusion, emergency → an image + caption to preset numbers, with an approved WhatsApp template so alerts land even outside the 24-hour service window.
- **🔔 Standing "watch" requests** *(the agentic core)* — a privileged operator sets conditional, recurring notifications in natural language, and manages them (*"uyarılarım neler?"*, *"1. uyarıyı iptal et"*). Evaluated inside the existing scene-description call, so it adds **~0%** to API usage.
- **🖼️ "Show me the frame"** — send a photo of a moment (now, a time, or a described event) with zero extra model calls.

---

## 🧠 Architecture

```
RTSP camera ──ffmpeg──▶ MJPEG frames ──▶ motion (grid diff) ──▶ [cooldown gate]
                                                                      │
                                                     one Gemini call per scene
                                                                      │
                                   ┌──────────────────────────────────┼─────────────────────────────┐
                                   ▼                                  ▼                               ▼
                          scene description                  danger alerts                   watch matches
                          (SQLite event log)              (WhatsApp template)          (notify the requester)
                                   │
        web page ◀── Express API ──┤── WhatsApp Cloud API (webhook)   Telegram (long-poll)
        (live MJPEG + chat)        └── shared chat() : Q&A, image requests, watch commands
```

**One model call per scene** does triple duty — description, danger detection, and watch evaluation — via a single structured-output schema. That keeps free-tier quota under control while the agent stays responsive.

---

## 🛠️ Tech stack

- **Runtime:** Node.js (Express), zero heavy deps — native `node:sqlite`, `fetch`, `FormData`
- **Vision + reasoning:** Google Gemini (`@google/genai`), JSON-schema structured output, multi-key round-robin with per-model fallback
- **Video:** `ffmpeg` (RTSP → MJPEG), in-process motion detection (grayscale grid diff)
- **Channels:** Web (MJPEG + REST), WhatsApp Cloud API (Meta), Telegram Bot API
- **Storage:** SQLite (events + watches), on-disk frame store with age/size pruning
- **Deploy:** AWS EC2 (Ubuntu, systemd) · Caddy + Let's Encrypt (auto-TLS) · DNS on AWS Lightsail

---

## 🔒 Privacy by design

The assistant is instructed to **never identify individuals**, describe faces, or read plates — it refers to people only in general terms ("two people", "a person with a bicycle"). This keeps the demo aligned with **KVKK/GDPR** expectations for camera data. Camera footage in the demo is used with the owner's permission.

---

## 🚀 Getting started

```bash
git clone https://github.com/mfatihdinc61/komsu.git
cd komsu
npm install
cp .env.example .env      # fill in your camera URL + Gemini key(s)
npm run make-test-video   # optional: a sample clip to run without a camera
npm start                 # http://localhost:3000
```

**Minimum config** (`.env`): a `CAMERA_URL` (or `test/sample.mp4`) and at least one `GOOGLE_AI_API_KEYS` / `GEMINI_API_KEY`. WhatsApp/Telegram and alerts are optional add-ons — see `.env.example` for every knob.

---

## 🗺️ Roadmap ideas

- Named-person recognition via a dedicated face-embedding pipeline (kept separate from the LLM; consent/KVKK-gated)
- Vertical event vocabularies (retail, car parks, construction) and per-site tuning
- Paid-tier model backend for production reliability at scale

---

<div align="center">
<sub>Built as a real-world demonstration of agentic AI — perception, reasoning, and autonomous action over live video. · <a href="https://aymam.ai">aymam.ai</a></sub>
</div>
