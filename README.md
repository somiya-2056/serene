# 🌿 Serene — Mental Health Companion

A web-based mental health companion powered by **Groq AI (LLaMA 3)**, **Supabase**, and a **FastAPI** sentiment analysis backend. Serene listens, learns, and supports your mental wellness journey.

---

## ✨ Features

- 💬 **AI Chat** — Warm, CBT-informed conversations powered by LLaMA 3.3 70B via Groq
- 📊 **Mood Dashboard** — Heatmaps, streak tracking, and mood trend charts
- 📈 **Progress Page** — 30-day mood history, session logs, and AI insights
- 🌐 **Community Forum** — Anonymous posts, categories, and upvotes
- 🩺 **Therapist Panel** — Optional session sharing with your therapist
- ♿ **Accessibility** — TTS, voice input, Morse code, and ASL sign language input (MediaPipe)
- 🔐 **Auth** — Supabase email/password + Google OAuth

---

## 🗂️ Project Structure

```
serene-clean/
├── index.html          # Landing page
├── login.html          # Sign in
├── signup.html         # Create account
├── chat.html           # AI chat interface
├── dashboard.html      # Mood dashboard
├── progress.html       # Progress & history
├── forum.html          # Community forum
├── therapist.html      # Therapist view
├── style.css           # All styles (dark/light theme)
├── script.js           # All frontend JS logic
├── config.js           # 🔐 Local keys (gitignored!)
├── main.py             # FastAPI backend (sentiment + Groq)
├── requirements.txt    # Python dependencies
├── .env                # 🔐 Backend secrets (gitignored!)
└── .gitignore
```

---

## 🚀 Setup Guide

### 1. Clone the repo

```bash
git clone https://github.com/yourusername/serene-clean.git
cd serene-clean
```

### 2. Create `config.js` (Frontend keys)

Ye file **gitignored** hai — manually banao:

```js
// config.js
window.__SERENE_CONFIG = {
  SUPABASE_URL:      'https://your-project-id.supabase.co',
  SUPABASE_ANON_KEY: 'your-supabase-anon-key',
  GROQ_API_KEY:      'your-groq-api-key',
};
```

### 3. Create `.env` (Backend key)

```env
GROQ_API_KEY=your-groq-api-key
```

### 4. Python backend setup

```bash
# Virtual environment banao
python -m venv .venv

# Activate karo (Windows)
.venv\Scripts\activate

# Activate karo (Mac/Linux)
source .venv/bin/activate

# Dependencies install karo
pip install -r requirements.txt

# Server run karo
python main.py
```

Backend `http://localhost:8000` pe chalega.

### 5. Frontend open karo

Koi bhi local server se open karo, ya directly browser mein:

```
index.html
```

> **Tip:** VS Code ka **Live Server** extension best hai frontend ke liye.

---

## 🗄️ Supabase Setup

### Tables (SQL Editor mein run karo)

**mood_entries**
```sql
CREATE TABLE mood_entries (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  mood_label  TEXT NOT NULL,
  mood_score  INTEGER NOT NULL CHECK (mood_score BETWEEN 1 AND 5),
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE mood_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own moods" ON mood_entries
  FOR ALL USING (auth.uid() = user_id);
```

**chat_sessions**
```sql
CREATE TABLE chat_sessions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT DEFAULT 'New Chat',
  mood_start    TEXT,
  mood_end      TEXT,
  message_count INTEGER DEFAULT 0,
  duration_min  INTEGER,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own sessions" ON chat_sessions
  FOR ALL USING (auth.uid() = user_id);
```

**chat_messages**
```sql
CREATE TABLE chat_messages (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id      UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'ai')),
  content         TEXT NOT NULL,
  sentiment_score FLOAT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own messages" ON chat_messages
  FOR ALL USING (auth.uid() = user_id);
```

---

## 🔑 API Keys Kahan Se Milenge

| Key | Kahan Se |
|-----|----------|
| `SUPABASE_URL` | Supabase → Settings → General → Project ID |
| `SUPABASE_ANON_KEY` | Supabase → Settings → API Keys → anon public |
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vanilla HTML, CSS, JavaScript |
| AI Chat | Groq API — LLaMA 3.3 70B |
| Sentiment | DistilBERT (HuggingFace Transformers) |
| Backend | FastAPI + Uvicorn |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Accessibility | MediaPipe (ASL), Web Speech API |

---

## ⚠️ Important — Security

- **Never commit** `config.js` or `.env` to GitHub
- Both files are in `.gitignore` — double check before pushing
- Use only the `anon` key on frontend — never the `service_role` key
- Groq API key bhi sirf `config.js` mein rakho

---

## 📄 License

MIT — free to use and modify.