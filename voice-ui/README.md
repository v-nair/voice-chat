# voice-ui

React frontend for the [Voice Chat](../README.md) project. Records audio via the browser's MediaRecorder API, streams it to `voice-api`, and plays the TTS audio reply.

## Relationship to Other Services

| Service | Direction | Description |
| --- | --- | --- |
| `voice-api` | → calls | Sends audio to `/voice/chat`, sends text to `/voice/speak` |

## Service Structure

```text
src/
├── main.jsx     # React entry point
├── index.css    # Dark theme, wave-bar + pulse-ring animations
└── App.jsx      # Record button, message history, audio playback
```

## Starting This Service

```bash
npm install
npm run dev
```

Runs on `http://localhost:5173` — requires `voice-api` on port 8004. Browser will prompt for microphone permission.

## Logic — Pseudocode

```text
ON mic button click (idle → recording):
    stream = getUserMedia({ audio: true })
    recorder = new MediaRecorder(stream)
    recorder.start()

ON mic button click (recording → processing):
    recorder.stop()
    → onstop fires:
        blob = new Blob(chunks, { type: "audio/webm" })
        formData.append("audio", blob)
        formData.append("session_id", SESSION_ID)

        { transcription, reply } = POST /voice/chat (formData)
        audioBlob = POST /voice/speak { text: reply }  → binary audio
        audioUrl = URL.createObjectURL(audioBlob)

        new Audio(audioUrl).play()   // auto-play reply
        messages.push({ role: "user", text: transcription })
        messages.push({ role: "assistant", text: reply, audioUrl })

RENDER:
    IF recording: animate wave bars + red mic button
    IF processing: amber mic button + "Thinking…" bubble
    FOR each message: text bubble + "▶ Play again" button for assistant
```

## Design Notes

- **Click-to-toggle** recording — click once to start, click again to stop
- **Blob URL** — `URL.createObjectURL` creates a local URL from the raw audio bytes for `<Audio>` playback
- **Auto-play** — response audio plays immediately; replay button available on each assistant bubble
- **Session ID** — generated on mount, sent with every request to maintain conversation context
