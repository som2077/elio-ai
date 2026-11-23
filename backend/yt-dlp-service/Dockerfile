FROM python:3.11-slim

# Install system dependencies: ffmpeg, ffprobe, ca-certificates, curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create non-root elio user and scratch temp directory
RUN useradd -m -u 1001 elio && \
    mkdir -p /tmp/elio-ytdlp && \
    chown -R elio:elio /tmp/elio-ytdlp /app

USER elio

COPY --chown=elio:elio . .

ENV PORT=8000 \
    TEMP_BASE_DIR=/tmp/elio-ytdlp \
    PYTHONUNBUFFERED=1

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "main.py:app", "--host", "0.0.0.0", "--port", "8000"]
