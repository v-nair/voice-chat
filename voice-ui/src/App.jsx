import { useCallback, useEffect, useRef, useState } from "react"

const API_URL = "http://localhost:8004"
const SESSION_ID = `session-${Math.random().toString(36).slice(2, 10)}`

export default function App() {
  const [phase, setPhase] = useState("idle") // idle | recording | processing
  const [messages, setMessages] = useState([])
  const [error, setError] = useState("")
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const startRecording = async () => {
    setError("")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: "audio/webm" })
        processAudio(blob)
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setPhase("recording")
    } catch {
      setError("Microphone access denied. Please allow microphone permissions.")
      setPhase("idle")
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setPhase("processing")
  }

  const toggleRecording = () => {
    if (phase === "idle") startRecording()
    else if (phase === "recording") stopRecording()
  }

  const processAudio = useCallback(async (blob) => {
    try {
      const formData = new FormData()
      formData.append("audio", blob, "recording.webm")
      formData.append("session_id", SESSION_ID)

      const chatRes = await fetch(`${API_URL}/voice/chat`, {
        method: "POST",
        body: formData,
      })
      if (!chatRes.ok) throw new Error(`HTTP ${chatRes.status}`)
      const { transcription, reply } = await chatRes.json()

      const ttsRes = await fetch(`${API_URL}/voice/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: reply }),
      })
      const audioBlob = await ttsRes.blob()
      const audioUrl = URL.createObjectURL(audioBlob)

      setMessages((prev) => [
        ...prev,
        { role: "user", text: transcription },
        { role: "assistant", text: reply, audioUrl },
      ])

      new Audio(audioUrl).play().catch(() => {})
    } catch {
      setError("Something went wrong. Is the API running on port 8004?")
    } finally {
      setPhase("idle")
    }
  }, [])

  const micColor = phase === "recording" ? "#ef4444" : phase === "processing" ? "#f59e0b" : "#6366f1"
  const micLabel = phase === "recording" ? "Stop" : phase === "processing" ? "Processing…" : "Record"

  return (
    <div style={s.layout}>
      <header style={s.header}>
        <h1 style={s.title}>Voice Chat</h1>
        <p style={s.subtitle}>Whisper · GPT-4o · TTS — speak, listen, reply</p>
      </header>

      <div style={s.messages}>
        {messages.length === 0 && (
          <div style={s.empty}>Press the button below and start speaking</div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ ...s.row, justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{ ...s.bubble, ...(m.role === "user" ? s.userBubble : s.assistantBubble) }}>
              {m.role === "assistant" && <div style={s.roleLabel}>Assistant</div>}
              <p style={s.bubbleText}>{m.text}</p>
              {m.audioUrl && (
                <button
                  onClick={() => new Audio(m.audioUrl).play()}
                  style={s.playBtn}
                >
                  ▶ Play again
                </button>
              )}
            </div>
          </div>
        ))}
        {phase === "processing" && (
          <div style={{ ...s.row, justifyContent: "flex-start" }}>
            <div style={{ ...s.bubble, ...s.assistantBubble }}>
              <div style={s.roleLabel}>Assistant</div>
              <p style={{ ...s.bubbleText, color: "#9ca3af" }}>Thinking…</p>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <div style={s.errorBox}>{error}</div>}

      <div style={s.controls}>
        <button
          onClick={toggleRecording}
          disabled={phase === "processing"}
          style={{
            ...s.micBtn,
            background: micColor,
            cursor: phase === "processing" ? "not-allowed" : "pointer",
            transform: phase === "recording" ? "scale(1.08)" : "scale(1)",
          }}
        >
          {phase === "recording" ? (
            <div style={s.waveform}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="wave-bar" />
              ))}
            </div>
          ) : (
            <span style={{ fontSize: 28 }}>🎤</span>
          )}
        </button>
        <div style={s.micLabel}>{micLabel}</div>
      </div>
    </div>
  )
}

const s = {
  layout: {
    display: "flex",
    flexDirection: "column",
    height: "100dvh",
    maxWidth: 600,
    margin: "0 auto",
  },
  header: {
    padding: "20px 24px 12px",
    borderBottom: "1px solid #1f2937",
    flexShrink: 0,
  },
  title: { fontSize: 20, fontWeight: 700, margin: 0, color: "#f9fafb" },
  subtitle: { fontSize: 12, color: "#6b7280", margin: "4px 0 0" },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  empty: {
    textAlign: "center",
    color: "#4b5563",
    fontSize: 14,
    marginTop: 60,
  },
  row: { display: "flex" },
  bubble: {
    maxWidth: "78%",
    padding: "10px 14px",
    borderRadius: 14,
    lineHeight: 1.55,
  },
  userBubble: { background: "#4f46e5", color: "#fff", borderBottomRightRadius: 4 },
  assistantBubble: { background: "#1f2937", color: "#e5e7eb", borderBottomLeftRadius: 4 },
  roleLabel: { fontSize: 10, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" },
  bubbleText: { margin: 0, fontSize: 14 },
  playBtn: {
    marginTop: 8,
    background: "none",
    border: "1px solid #374151",
    color: "#9ca3af",
    borderRadius: 6,
    padding: "3px 8px",
    fontSize: 11,
    cursor: "pointer",
  },
  errorBox: {
    margin: "0 16px 8px",
    padding: "10px 14px",
    background: "#1f0a0a",
    border: "1px solid #7f1d1d",
    borderRadius: 8,
    color: "#f87171",
    fontSize: 13,
  },
  controls: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "16px 0 28px",
    borderTop: "1px solid #1f2937",
    gap: 8,
    flexShrink: 0,
  },
  micBtn: {
    width: 72,
    height: 72,
    borderRadius: "50%",
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s",
    boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
  },
  waveform: { display: "flex", alignItems: "center", gap: 3, height: 30 },
  micLabel: { fontSize: 12, color: "#6b7280" },
}
