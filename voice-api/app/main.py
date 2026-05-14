import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from openai import OpenAIError

from models import SpeakRequest, VoiceChatResponse
from services.voice_service import clear_session, process_voice_chat, synthesize_speech

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError("OPENAI_API_KEY is not set in environment variables")
    logger.info("voice-api ready")
    yield
    logger.info("Shutting down voice-api")


app = FastAPI(
    title="Voice Chat API",
    description="Voice-to-voice AI chat powered by Whisper, GPT-4o, and TTS",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["Health"])
def root():
    return {"status": "voice-api is running"}


@app.post("/voice/chat", response_model=VoiceChatResponse, tags=["Voice"])
async def voice_chat(
    session_id: str = Form(...),
    audio: UploadFile = File(...),
):
    audio_bytes = await audio.read()
    try:
        transcription, reply = await process_voice_chat(
            session_id, audio_bytes, audio.filename or "audio.webm"
        )
    except OpenAIError as e:
        logger.error("OpenAI error during voice chat: %s", e)
        raise HTTPException(status_code=502, detail="AI service unavailable")
    return VoiceChatResponse(
        transcription=transcription, reply=reply, session_id=session_id
    )


@app.post("/voice/speak", tags=["Voice"])
async def speak(req: SpeakRequest):
    try:
        audio_bytes = await synthesize_speech(req.text)
    except OpenAIError as e:
        logger.error("OpenAI error during TTS synthesis: %s", e)
        raise HTTPException(status_code=502, detail="AI service unavailable")
    return Response(content=audio_bytes, media_type="audio/mpeg")


@app.delete("/chat/{session_id}", tags=["Chat"])
def delete_session(session_id: str):
    if not clear_session(session_id):
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "session cleared", "session_id": session_id}
