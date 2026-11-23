from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = "healthy"
    version: str = "1.0.0"
    ytdlp_version: str
    ffmpeg_available: bool
    ffprobe_available: bool
    active_tasks: int = 0
    temp_dir_free_mb: int = 0


class FormatSummary(BaseModel):
    format_id: Optional[str] = None
    ext: Optional[str] = None
    vcodec: Optional[str] = None
    acodec: Optional[str] = None
    abr: Optional[float] = None
    resolution: Optional[str] = None


class MetadataRequest(BaseModel):
    url: str
    include_raw: bool = False
    proxy: Optional[str] = None


class MetadataResponse(BaseModel):
    success: bool
    platform: Optional[str] = None
    video_id: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    uploader: Optional[str] = None
    uploader_id: Optional[str] = None
    channel_url: Optional[str] = None
    duration: Optional[int] = None
    view_count: Optional[int] = None
    like_count: Optional[int] = None
    upload_date: Optional[str] = None
    thumbnail: Optional[str] = None
    webpage_url: Optional[str] = None
    available_subtitles: List[str] = Field(default_factory=list)
    auto_subtitles: List[str] = Field(default_factory=list)
    formats_summary: List[FormatSummary] = Field(default_factory=list)
    raw: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class TranscriptSnippet(BaseModel):
    text: str
    start: float
    duration: float


class SubtitleRequest(BaseModel):
    url: str
    preferred_languages: Optional[List[str]] = Field(default_factory=lambda: ["en", "hi", "ur", "es"])
    include_auto: bool = True
    format: Optional[str] = "snippets"


class SubtitleResponse(BaseModel):
    success: bool
    language: Optional[str] = None
    is_auto: bool = False
    full_text: Optional[str] = ""
    snippets: List[TranscriptSnippet] = Field(default_factory=list)
    available_tracks: List[str] = Field(default_factory=list)
    error: Optional[str] = None


AudioFormatType = Literal["mp3", "m4a", "wav", "aac", "ogg", "opus", "flac"]
AudioReturnModeType = Literal["stream", "json"]


class AudioExtractRequest(BaseModel):
    url: str
    format: AudioFormatType = "mp3"
    bitrate: str = Field(default="32k", pattern=r"^\d+k?$")
    sample_rate: int = Field(default=16000, ge=8000, le=48000)
    channels: int = Field(default=1, ge=1, le=2)
    max_duration_seconds: int = Field(default=3600, ge=1, le=86400)
    return_mode: AudioReturnModeType = "stream"


class AudioExtractJsonResponse(BaseModel):
    success: bool
    file_id: Optional[str] = None
    file_name: Optional[str] = None
    duration_seconds: Optional[int] = None
    file_size_bytes: Optional[int] = None
    mime_type: Optional[str] = "audio/mpeg"
    bitrate: Optional[str] = "32k"
    channels: Optional[int] = 1
    sample_rate: Optional[int] = 16000
    download_url: Optional[str] = None
    error: Optional[str] = None
