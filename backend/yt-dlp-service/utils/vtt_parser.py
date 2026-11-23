import html
import re
from typing import Any, Dict, List

# Matches WebVTT and SRT timestamp lines:
# 00:00:18.500 --> 00:00:22.700 or 00:18,500 --> 00:22,700
TIMESTAMP_REGEX = re.compile(
    r'(?:(\d{1,2}):)?(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(?:(\d{1,2}):)?(\d{2}):(\d{2})[.,](\d{3})'
)

# Strips XML/HTML style formatting tags e.g. <c>, <c.colorE5E5E5>, <b>, </i>, <00:00:01.000>
TAG_CLEANER = re.compile(r'<[^>]+>')


def time_to_seconds(hours: str, minutes: str, seconds: str, millis: str) -> float:
    h = float(hours) if hours else 0.0
    m = float(minutes)
    s = float(seconds)
    ms = float(millis) / 1000.0
    return round(h * 3600.0 + m * 60.0 + s + ms, 2)


def clean_cue_text(raw_text: str) -> str:
    cleaned = TAG_CLEANER.sub('', raw_text)
    cleaned = html.unescape(cleaned)
    # Remove leading dash/bullet points often used in dialogue
    cleaned = re.sub(r'^\s*[-–—]\s*', '', cleaned)
    # Normalize multiple whitespace characters
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned


def parse_vtt_content(vtt_text: str) -> List[Dict[str, Any]]:
    """
    Parses raw WebVTT or SRT subtitle text into timestamped snippet dicts:
    [{"text": "...", "start": 18.5, "duration": 4.2}, ...]
    Handles multi-line cues, cue deduplication, and tag sanitization.
    """
    if not vtt_text or not vtt_text.strip():
        return []

    snippets: List[Dict[str, Any]] = []
    lines = vtt_text.splitlines()
    i = 0
    total_lines = len(lines)

    last_text = ""

    while i < total_lines:
        line = lines[i].strip()
        match = TIMESTAMP_REGEX.search(line)
        if match:
            h1, m1, s1, ms1, h2, m2, s2, ms2 = match.groups()
            start = time_to_seconds(h1, m1, s1, ms1)
            end = time_to_seconds(h2, m2, s2, ms2)
            duration = max(round(end - start, 2), 0.1)

            i += 1
            text_lines: List[str] = []
            while i < total_lines and lines[i].strip():
                # Avoid reading header blocks or next timestamp
                if TIMESTAMP_REGEX.search(lines[i]):
                    break
                clean_line = clean_cue_text(lines[i])
                if clean_line and clean_line not in text_lines:
                    text_lines.append(clean_line)
                i += 1

            combined_text = " ".join(text_lines).strip()
            # De-duplicate consecutive identical lines common in rolling auto-captions
            if combined_text and combined_text != last_text:
                snippets.append({
                    "text": combined_text,
                    "start": start,
                    "duration": duration,
                })
                last_text = combined_text
        else:
            i += 1

    return snippets
