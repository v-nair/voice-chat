from pydantic import BaseModel, field_validator


class VoiceChatResponse(BaseModel):
    transcription: str
    reply: str
    session_id: str


class SpeakRequest(BaseModel):
    text: str

    @field_validator("text")
    @classmethod
    def must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Text must not be empty")
        return v.strip()
