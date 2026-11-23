import asyncio
import glob
import logging
import os
import re
import shutil
from typing import Optional
from starlette.concurrency import run_in_threadpool

from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
import yt_dlp
from yt_dlp.utils import DownloadError

from config import settings
from extractor import YtDlpExtractor
from models import (
    AudioExtractJsonResponse,
    AudioExtractRequest,
    HealthResponse,
    MetadataRequest,
    MetadataResponse,
    SubtitleRequest,
    SubtitleResponse,
)
from utils.ssrf import validate_safe_url

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("yt_dlp_service")

# Regex to strictly validate file_id format (UUID v4 or 32-36 char hex string)
FILE_ID_REGEX = re.compile(r"^[0-9a-fA-F-]{32,36}$")

# Initialize FastAPI App
app = FastAPI(
    title="Elio AI yt-dlp Companion Service",
    description="High-performance companion microservice for metadata, zero-download subtitle extraction, and compressed speech audio extraction.",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global extractor and concurrency semaphore
extractor = YtDlpExtractor(temp_base_dir=settings.TEMP_BASE_DIR)
semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_EXTRACTIONS)
active_tasks_count = 0
active_tasks_lock = asyncio.Lock()


async def acquire_slot():
    global active_tasks_count
    await semaphore.acquire()
    async with active_tasks_lock:
        active_tasks_count += 1


async def release_slot():
    global active_tasks_count
    async with active_tasks_lock:
        active_tasks_count = max(0, active_tasks_count - 1)
    semaphore.release()


def remove_file_safely(file_path: str):
    """Background task to remove temporary extracted files after streaming."""
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            logger.info("Cleaned up temporary file: %s", file_path)
    except Exception as e:
        logger.warning("Failed to clean up temp file %s: %s", file_path, e)


async def verify_auth(
    authorization: Optional[str] = Header(None),
    x_api_key: Optional[str] = Header(None)
):
    """
    Validates service-to-service Bearer token or X-API-Key if SERVICE_KEY is configured.
    """
    if not settings.SERVICE_KEY:
        return

    expected = settings.SERVICE_KEY.strip()

    if x_api_key and x_api_key.strip() == expected:
        return

    if authorization:
        parts = authorization.strip().split()
        if len(parts) == 2 and parts[0].lower() == "bearer" and parts[1] == expected:
            return

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unauthorized: invalid or missing service authentication key.",
        headers={"WWW-Authenticate": "Bearer"},
    )


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check verifying yt-dlp version, ffmpeg presence, and available scratch disk."""
    ffmpeg_bin = shutil.which("ffmpeg")
    ffprobe_bin = shutil.which("ffprobe")

    try:
        disk_usage = shutil.disk_usage(settings.TEMP_BASE_DIR)
        free_mb = int(disk_usage.free // (1024 * 1024))
    except Exception:
        free_mb = 0

    return HealthResponse(
        status="healthy",
        version="1.0.0",
        ytdlp_version=getattr(yt_dlp.version, "__version__", "unknown"),
        ffmpeg_available=ffmpeg_bin is not None,
        ffprobe_available=ffprobe_bin is not None,
        active_tasks=active_tasks_count,
        temp_dir_free_mb=free_mb,
    )


@app.post("/extract-metadata", response_model=MetadataResponse)
async def extract_metadata_endpoint(
    req: MetadataRequest,
    _: None = Depends(verify_auth)
):
    """
    Extracts complete video metadata without downloading video or audio streams.
    """
    validate_safe_url(req.url, allow_private=settings.ALLOW_PRIVATE_IPS_FOR_TESTING)
    if req.proxy:
        validate_safe_url(
            req.proxy,
            allow_private=settings.ALLOW_PRIVATE_IPS_FOR_TESTING,
            allowed_schemes=("http", "https", "socks5", "socks5h")
        )

    await acquire_slot()
    try:
        result = await run_in_threadpool(
            extractor.extract_metadata,
            url=req.url,
            include_raw=req.include_raw,
            proxy=req.proxy,
        )
        return MetadataResponse(**result)
    except DownloadError as e:
        err_msg = str(e)
        logger.error("yt-dlp DownloadError on %s: %s", req.url, err_msg)
        if any(term in err_msg.lower() for term in ["private", "sign in", "login", "account"]):
            raise HTTPException(status_code=403, detail=f"Access denied: {err_msg}")
        if any(term in err_msg.lower() for term in ["not found", "unavailable", "does not exist"]):
            raise HTTPException(status_code=404, detail=f"Video unavailable: {err_msg}")
        if any(term in err_msg.lower() for term in ["429", "rate limit", "too many requests"]):
            raise HTTPException(status_code=429, detail=f"Upstream rate limited: {err_msg}")
        raise HTTPException(status_code=500, detail=f"Extraction failed: {err_msg}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error in /extract-metadata for %s", req.url)
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")
    finally:
        await release_slot()


@app.post("/extract-subtitles", response_model=SubtitleResponse)
async def extract_subtitles_endpoint(
    req: SubtitleRequest,
    _: None = Depends(verify_auth)
):
    """
    Extracts and parses manual or automatic subtitles into structured timestamped cues
    without downloading any media bytes.
    """
    validate_safe_url(req.url, allow_private=settings.ALLOW_PRIVATE_IPS_FOR_TESTING)

    await acquire_slot()
    try:
        result = await run_in_threadpool(
            extractor.extract_subtitles,
            url=req.url,
            preferred_languages=req.preferred_languages,
            include_auto=req.include_auto,
        )
        return SubtitleResponse(**result)
    except DownloadError as e:
        err_msg = str(e)
        logger.error("yt-dlp DownloadError in subtitles for %s: %s", req.url, err_msg)
        if any(term in err_msg.lower() for term in ["private", "sign in", "login"]):
            raise HTTPException(status_code=403, detail=f"Access denied: {err_msg}")
        if any(term in err_msg.lower() for term in ["not found", "unavailable"]):
            raise HTTPException(status_code=404, detail=f"Video unavailable: {err_msg}")
        raise HTTPException(status_code=500, detail=f"Subtitle extraction failed: {err_msg}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error in /extract-subtitles for %s", req.url)
        raise HTTPException(status_code=500, detail=f"Subtitle extraction failed: {str(e)}")
    finally:
        await release_slot()


@app.post("/extract-audio")
async def extract_audio_endpoint(
    req: AudioExtractRequest,
    background_tasks: BackgroundTasks,
    _: None = Depends(verify_auth)
):
    """
    Downloads best audio stream, transcodes to lightweight speech MP3 (16kHz mono),
    and either streams binary audio or returns async file info.
    """
    validate_safe_url(req.url, allow_private=settings.ALLOW_PRIVATE_IPS_FOR_TESTING)

    await acquire_slot()
    try:
        audio_info = await run_in_threadpool(
            extractor.extract_audio,
            url=req.url,
            format=req.format,
            bitrate=req.bitrate,
            sample_rate=req.sample_rate,
            channels=req.channels,
            max_duration_seconds=req.max_duration_seconds,
        )

        file_path = audio_info["file_path"]

        if req.return_mode == "stream":
            # Schedule file cleanup after response finishes streaming
            background_tasks.add_task(remove_file_safely, file_path)
            media_type = f"audio/{req.format}" if req.format != "mp3" else "audio/mpeg"
            return FileResponse(
                path=file_path,
                media_type=media_type,
                filename=audio_info["file_name"],
                headers={
                    "X-Audio-Duration": str(audio_info["duration"]),
                    "X-Audio-Bitrate": audio_info["bitrate"],
                    "X-Audio-Channels": str(audio_info["channels"]),
                    "X-Audio-Sample-Rate": str(audio_info["sample_rate"]),
                    "X-Video-Id": str(audio_info["video_id"]),
                }
            )

        # return_mode == "json"
        return AudioExtractJsonResponse(
            success=True,
            file_id=audio_info["file_id"],
            file_name=audio_info["file_name"],
            duration_seconds=audio_info["duration"],
            file_size_bytes=audio_info["size_bytes"],
            mime_type=f"audio/{req.format}" if req.format != "mp3" else "audio/mpeg",
            bitrate=audio_info["bitrate"],
            channels=audio_info["channels"],
            sample_rate=audio_info["sample_rate"],
            download_url=f"/download/{audio_info['file_id']}",
            error=None,
        )

    except ValueError as e:
        err_msg = str(e)
        if "exceeds maximum allowed" in err_msg:
            raise HTTPException(status_code=413, detail=err_msg)
        raise HTTPException(status_code=400, detail=err_msg)
    except DownloadError as e:
        err_msg = str(e)
        logger.error("yt-dlp DownloadError in audio for %s: %s", req.url, err_msg)
        if any(term in err_msg.lower() for term in ["private", "sign in", "login"]):
            raise HTTPException(status_code=403, detail=f"Access denied: {err_msg}")
        if any(term in err_msg.lower() for term in ["not found", "unavailable"]):
            raise HTTPException(status_code=404, detail=f"Video unavailable: {err_msg}")
        if any(term in err_msg.lower() for term in ["429", "rate limit"]):
            raise HTTPException(status_code=429, detail=f"Upstream rate limited: {err_msg}")
        raise HTTPException(status_code=500, detail=f"Audio extraction failed: {err_msg}")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error in /extract-audio for %s", req.url)
        raise HTTPException(status_code=500, detail=f"Audio extraction failed: {str(e)}")
    finally:
        await release_slot()


@app.get("/download/{file_id}")
async def download_file_endpoint(
    file_id: str,
    background_tasks: BackgroundTasks,
    _: None = Depends(verify_auth)
):
    """
    Downloads an asynchronously extracted audio file. Cleans up file after download.
    Strictly validates file_id format to prevent path traversal or glob wildcard injection.
    """
    if not FILE_ID_REGEX.match(file_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file_id format. Must be a valid UUID or 32-36 character hex string."
        )

    safe_file_id = os.path.basename(file_id)
    candidates = glob.glob(os.path.join(settings.TEMP_BASE_DIR, f"{safe_file_id}.*"))
    if not candidates or not os.path.exists(candidates[0]):
        raise HTTPException(status_code=404, detail="Audio file not found or already expired.")

    target_path = candidates[0]
    filename = os.path.basename(target_path)
    ext = os.path.splitext(filename)[1].replace(".", "")
    media_type = f"audio/{ext}" if ext != "mp3" else "audio/mpeg"

    background_tasks.add_task(remove_file_safely, target_path)

    return FileResponse(
        path=target_path,
        media_type=media_type,
        filename=filename,
    )
