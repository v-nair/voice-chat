import logging
import os

from openai import AsyncOpenAI

from config import (
    CHAT_MODEL,
    MAX_HISTORY,
    SYSTEM_PROMPT,
    TRANSCRIPTION_MODEL,
    TTS_MODEL,
    TTS_VOICE,
)

logger = logging.getLogger(__name__)

_client: AsyncOpenAI | None = None
_sessions: dict[str, list[dict]] = {}


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    return _client


def _get_or_create_session(session_id: str) -> list[dict]:
    if session_id not in _sessions:
        _sessions[session_id] = [{"role": "system", "content": SYSTEM_PROMPT}]
    return _sessions[session_id]


def clear_session(session_id: str) -> bool:
    """Delete the conversation history for ``session_id``.

    Returns ``True`` if the session existed and was removed, ``False`` otherwise.
    """
    if session_id not in _sessions:
        return False
    del _sessions[session_id]
    return True


async def _transcribe(audio_bytes: bytes, filename: str) -> str:
    response = await _get_client().audio.transcriptions.create(
        model=TRANSCRIPTION_MODEL,
        file=(filename, audio_bytes, "audio/webm"),
    )
    return response.text


async def _generate_reply(session_id: str, message: str) -> str:
    history = _get_or_create_session(session_id)
    history.append({"role": "user", "content": message})

    if len(history) > MAX_HISTORY + 1:
        _sessions[session_id] = [history[0]] + history[-MAX_HISTORY:]

    response = await _get_client().chat.completions.create(
        model=CHAT_MODEL,
        messages=_sessions[session_id],
        temperature=0.7,
    )
    reply = response.choices[0].message.content or ""
    _sessions[session_id].append({"role": "assistant", "content": reply})
    logger.info(f"Session {session_id}: {len(_sessions[session_id])} messages")
    return reply


async def synthesize_speech(text: str) -> bytes:
    """Convert ``text`` to speech using the OpenAI TTS API.

    Returns raw ``audio/mpeg`` bytes ready to be streamed to the client.
    Raises ``OpenAIError`` on API failure.
    """
    response = await _get_client().audio.speech.create(
        model=TTS_MODEL,
        voice=TTS_VOICE,
        input=text,
    )
    return response.content


async def process_voice_chat(
    session_id: str, audio_bytes: bytes, filename: str
) -> tuple[str, str]:
    """Run the full voice pipeline: transcribe audio, generate a chat reply.

    Args:
        session_id: Unique identifier for the conversation session.
        audio_bytes: Raw audio bytes from the browser (typically ``audio/webm``).
        filename:    Original filename used as a hint for Whisper's file-type detection.

    Returns:
        A ``(transcription, reply)`` tuple — both are plain text strings.
        Raises ``OpenAIError`` on any API failure.
    """
    transcription = await _transcribe(audio_bytes, filename)
    logger.info("Transcribed audio for session %s: %r", session_id, transcription[:80])
    reply = await _generate_reply(session_id, transcription)
    return transcription, reply
