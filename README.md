# Voice Chat

Voice-to-voice AI conversation — record your voice, get a spoken reply. Built with FastAPI, OpenAI Whisper, GPT-4o, and TTS.

## Pipeline

```text
Browser mic
    │  audio/webm blob
    ▼
voice-api
    ├── Whisper (transcription)   → text
    ├── GPT-4o (chat completion)  → reply text
    └── TTS (speech synthesis)    → audio/mpeg bytes
    │
    ▼
voice-ui plays audio + shows transcription
```

## Tech Stack

| Layer | Technology |
| --- | --- |
| Backend | FastAPI, Python 3.11, Uvicorn |
| Transcription | OpenAI Whisper (`whisper-1`) |
| Chat | OpenAI GPT-4o |
| Text-to-Speech | OpenAI TTS (`tts-1`, voice: `alloy`) |
| Frontend | React 19, Vite |
| Infrastructure | Docker, Docker Compose |

## Project Structure

```text
voice-chat/
├── voice-api/
│   ├── app/
│   │   ├── main.py                      # FastAPI app, multipart + JSON routes
│   │   ├── models.py                    # VoiceChatResponse, SpeakRequest (Pydantic)
│   │   ├── config.py                    # Model names, TTS voice, history limit
│   │   └── services/
│   │       └── voice_service.py        # Transcribe, generate reply, synthesise speech
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── requirements.txt
└── voice-ui/
    └── src/
        └── App.jsx                      # Record button, message history, audio playback
```

## Running Locally

**Prerequisites:** Docker, Node.js, OpenAI API key

**Backend:**

```bash
cd voice-api
cp .env.example .env   # add OPENAI_API_KEY
docker compose up --build
```

**Frontend:**

```bash
cd voice-ui
npm install
npm run dev
```

| Service | URL |
| --- | --- |
| API | <http://localhost:8004> |
| API docs | <http://localhost:8004/docs> |
| UI | <http://localhost:5173> |

## API Reference

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/` | Health check |
| `POST` | `/voice/chat` | Send audio → get transcription + reply |
| `POST` | `/voice/speak` | Send text → get audio/mpeg bytes |
| `DELETE` | `/chat/{session_id}` | Clear session history |

**POST /voice/chat — request:** `multipart/form-data`

```text
audio:      <audio blob>   (audio/webm from MediaRecorder)
session_id: "user-abc123"
```

**POST /voice/chat — response:**

```json
{
  "transcription": "What is the capital of France?",
  "reply": "The capital of France is Paris.",
  "session_id": "user-abc123"
}
```

**POST /voice/speak — request:**

```json
{ "text": "The capital of France is Paris." }
```

**POST /voice/speak — response:** `audio/mpeg` bytes (ready to play in `<audio>` or `new Audio()`)

## What This Demonstrates

- **OpenAI Whisper** — `audio/transcriptions` endpoint with raw audio bytes upload
- **TTS** — `audio/speech` endpoint returning binary audio, streamed back as `audio/mpeg`
- **Multipart uploads** — FastAPI `UploadFile` + `Form` fields combined in one endpoint
- **Session memory** — same rolling history pattern as Project 1, adapted for voice turns
- **MediaRecorder API** — browser mic capture, chunks collected, blob constructed and POSTed
- **Blob URL playback** — `URL.createObjectURL(blob)` used for auto-play and reply button
