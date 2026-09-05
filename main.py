from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from dotenv import load_dotenv
import os
import sys
import json
from groq import Groq
from pathlib import Path

# --- 🛠️ STEP 1: ULTRA-RELIABLE KEY LOADING ---
base_dir = Path(__file__).resolve().parent
env_path = base_dir / ".env"

# We try to read the file manually to bypass OneDrive encoding quirks
key = None
if env_path.exists():
    try:
        # We try 'utf-8-sig' which handles the "BOM" Windows often adds
        with open(env_path, "r", encoding="utf-8-sig") as f:
            for line in f:
                if "=" in line and "GROQ_API_KEY" in line:
                    key = line.split("=")[1].strip().replace('"', '').replace("'", "")
                    break
    except Exception as e:
        print(f"⚠️ Manual read failed: {e}")

# If manual read failed, try standard dotenv (also covers hosting platforms
# that inject env vars directly, e.g. Render/HF Spaces, with no .env file)
if not key:
    load_dotenv(dotenv_path=env_path)
    key = os.getenv("GROQ_API_KEY")

if not key:
    print(f"\n❌ ERROR: Key not found at: {env_path}")
    print(f"📂 Current Dir: {os.getcwd()}")
    print(f"📄 Files in folder: {os.listdir(base_dir)}")
    sys.exit(1) # Stop the script if no key
else:
    print(f"✅ SUCCESS: Key loaded (Starts with: {key[:6]}...)")

# --- 🤖 STEP 2: INITIALIZE CLIENTS ---
groq_client = Groq(api_key=key)
app = FastAPI(title="Serene Sentiment API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 📝 STEP 3: MODELS & ENDPOINTS ---
class TextRequest(BaseModel):
    text: str

class ChatRequest(BaseModel):
    message: str
    history: list = []
    system: str = ""

@app.get("/")
def health_check():
    return {"status": "Serene API running", "database": "Supabase connected via Frontend"}

@app.post("/sentiment")
def analyze_sentiment(request: TextRequest):
    """Sentiment via Groq (no local model — keeps the backend lightweight)."""
    try:
        prompt = (
            "Classify the sentiment of the following message. "
            "Reply with ONLY a JSON object, no other text, in this exact form: "
            '{"label": "POSITIVE" or "NEGATIVE", "confidence": a number between 0 and 1}.\n\n'
            f"Message: {request.text}"
        )
        response = groq_client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[{"role": "user", "content": prompt}],
            temperature=0
        )
        raw = response.choices[0].message.content.strip()
        # Strip accidental code fences if the model adds them
        raw = raw.replace("```json", "").replace("```", "").strip()
        parsed = json.loads(raw)
        label = parsed.get("label", "NEUTRAL")
        confidence = float(parsed.get("confidence", 0.5))
        score = confidence if label == "POSITIVE" else -confidence
        return {"label": label, "score": score, "confidence": confidence}
    except Exception as e:
        return {"error": str(e)}

@app.post("/chat")
def chat_with_groq(request: ChatRequest):
    try:
        # Build message list for Groq
        messages = []
        if request.system:
            messages.append({"role": "system", "content": request.system})
        
        # Format history correctly for Llama 3
        for m in request.history:
            messages.append({
                "role": "assistant" if m.get("role") == "ai" else "user",
                "content": m.get("text", "")
            })
        
        # Add current message
        messages.append({"role": "user", "content": request.message})

        response = groq_client.chat.completions.create(
            model="openai/gpt-oss-20b", 
            messages=messages,
            temperature=0.7
        )
        return {"reply": response.choices[0].message.content}
    except Exception as e:
        print(f"Groq API Error: {e}")
        return {"error": str(e)}

if __name__ == "__main__":
    print("🚀 Starting Server on http://127.0.0.1:8000")
    uvicorn.run(app, host="127.0.0.1", port=8000)