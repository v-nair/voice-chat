# voice-api

FastAPI backend for the [Voice Chat](../README.md) project. Handles audio upload, Whisper transcription, GPT-4o reply generation, and TTS speech synthesis.

## Relationship to Other Services

| Service | Direction | Description |
| --- | --- | --- |
| `voice-ui` | ← receives requests | UI sends audio blob + session_id, receives transcription + reply |
| OpenAI Whisper | → calls | Transcribes audio to text |
| OpenAI Chat API | → calls | Generates conversational reply |
| OpenAI TTS | → calls | Synthesises reply text into audio/mpeg |

## Service Structure

```text
app/
├── main.py              # FastAPI app, /voice/chat (multipart), /voice/speak (JSON→audio)
├── models.py            # VoiceChatResponse, SpeakRequest
├── config.py            # Model names, TTS voice, MAX_HISTORY
└── services/
    └── voice_service.py # _transcribe, _generate_reply, synthesize_speech, process_voice_chat
```

## Configuration

| Constant | Value | Purpose |
| --- | --- | --- |
| `CHAT_MODEL` | `gpt-4o` | Chat completion model |
| `TRANSCRIPTION_MODEL` | `whisper-1` | Whisper model |
| `TTS_MODEL` | `tts-1` | TTS model |
| `TTS_VOICE` | `alloy` | TTS voice (alloy/echo/fable/onyx/nova/shimmer) |
| `MAX_HISTORY` | `20` | Conversation turns kept per session |

## Starting This Service

```bash
cp .env.example .env   # add OPENAI_API_KEY
docker compose up --build
```

Runs on `http://localhost:8004`

## Logic — Pseudocode

```text
POST /voice/chat (multipart: audio + session_id):
    audio_bytes = read audio file
    transcription = Whisper.transcribe(audio_bytes, filename)
    reply = GPT-4o.chat(session_id, transcription)   // same session memory as Project 1
    RETURN { transcription, reply, session_id }

POST /voice/speak (json: text):
    audio_bytes = OpenAI.TTS.synthesize(text, model=tts-1, voice=alloy)
    RETURN Response(audio_bytes, media_type="audio/mpeg")
```

## Design Notes

- **AsyncOpenAI** — all three OpenAI calls (Whisper, Chat, TTS) use the async client for non-blocking I/O
- **python-multipart** — required for FastAPI to parse `UploadFile` + `Form` fields in the same endpoint
- **TTS returns raw bytes** — `response.content` from the TTS call is streamed back directly as `audio/mpeg`
