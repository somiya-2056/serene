from fastapi import FastAPI
from pydantic import BaseModel
from transformers import pipeline
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from dotenv import load_dotenv
import os
import sys
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

# If manual read failed, try standard dotenv
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

# Global model variable
sentiment_model = None

@app.on_event("startup")
def load_model():
    global sentiment_model
    print("⏳ Loading Sentiment Model (this takes a moment)...")
    try:
        sentiment_model = pipeline(
            "sentiment-analysis", 
            model="distilbert-base-uncased-finetuned-sst-2-english"
        )
        print("✅ Sentiment Model Ready.")
    except Exception as e:
        print(f"❌ Model Load Error: {e}")

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
    try:
        if not sentiment_model:
            return {"error": "Model not loaded yet"}
        res = sentiment_model(request.text)[0]
        # Normalize: Negative label = negative score
        score = res["score"] if res["label"] == "POSITIVE" else -res["score"]
        return {"label": res["label"], "score": score, "confidence": res["score"]}
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
            model="llama3-8b-8192", 
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