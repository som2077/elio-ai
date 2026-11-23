import os
import sys
import unittest
from fastapi.testclient import TestClient

from config import settings
from main import app
from utils.ssrf import validate_safe_url
from utils.vtt_parser import clean_cue_text, parse_vtt_content, time_to_seconds

client = TestClient(app)


class TestYtDlpService(unittest.TestCase):

    def test_health_check(self):
        """Verify health check returns valid structure and healthy status."""
        response = client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")
        self.assertEqual(data["version"], "1.0.0")
        self.assertTrue(data["ffmpeg_available"], "FFmpeg must be detected on system")
        self.assertTrue(data["ffprobe_available"], "FFprobe must be detected on system")
        self.assertIn("ytdlp_version", data)
        self.assertGreaterEqual(data["temp_dir_free_mb"], 0)

    def test_ssrf_prohibited_hosts(self):
        """Verify SSRF protection blocks loopback, private subnets, and metadata IPs."""
        blocked_targets = [
            "http://127.0.0.1:8000/health",
            "http://localhost:8000/health",
            "http://169.254.169.254/latest/meta-data/",
            "http://10.0.0.1/admin",
            "http://192.168.1.1/router",
            "http://172.16.0.1/secret",
            "http://metadata.google.internal/computeMetadata/v1/",
            "http://[::1]:8000/health",
        ]

        for target in blocked_targets:
            response = client.post("/extract-metadata", json={"url": target})
            self.assertEqual(
                response.status_code,
                403,
                f"URL '{target}' should have been blocked with 403 Forbidden"
            )

    def test_ssrf_proxy_validation(self):
        """Verify req.proxy SSRF protection blocks internal proxy addresses."""
        # Internal proxy should return 403 Forbidden
        response = client.post(
            "/extract-metadata",
            json={
                "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                "proxy": "http://127.0.0.1:8080"
            }
        )
        self.assertEqual(response.status_code, 403)

        response_meta = client.post(
            "/extract-metadata",
            json={
                "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                "proxy": "http://169.254.169.254:3128"
            }
        )
        self.assertEqual(response_meta.status_code, 403)

    def test_download_file_id_validation(self):
        """Verify /download/{file_id} rejects wildcard/glob injection and malformed IDs."""
        invalid_ids = [
            "*",
            "test*",
            "short",
            "12345",
            "not-a-valid-uuid-wildcard-*",
            "../../etc/passwd",
        ]
        for bad_id in invalid_ids:
            response = client.get(f"/download/{bad_id}")
            # If routed to endpoint, returns 400 Bad Request; if path traversal normalized by router, returns 404
            self.assertIn(
                response.status_code,
                [400, 404],
                f"ID '{bad_id}' should be rejected with 400 or 404"
            )

        # Valid formatted UUID that doesn't exist returns 404
        valid_uuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
        response = client.get(f"/download/{valid_uuid}")
        self.assertEqual(response.status_code, 404)

    def test_audio_request_validation(self):
        """Verify AudioExtractRequest enforces format, bitrate, channels, and sample rate."""
        # Invalid format
        resp = client.post(
            "/extract-audio",
            json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "format": "exe"}
        )
        self.assertEqual(resp.status_code, 422)

        # Invalid channels (e.g. 5)
        resp = client.post(
            "/extract-audio",
            json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "channels": 5}
        )
        self.assertEqual(resp.status_code, 422)

        # Invalid sample rate (e.g. 1000)
        resp = client.post(
            "/extract-audio",
            json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "sample_rate": 1000}
        )
        self.assertEqual(resp.status_code, 422)

        # Invalid return_mode
        resp = client.post(
            "/extract-audio",
            json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "return_mode": "invalid"}
        )
        self.assertEqual(resp.status_code, 422)

    def test_ssrf_invalid_schemes(self):
        """Verify non-HTTP schemes are rejected with 400 Bad Request."""
        invalid_urls = [
            "ftp://example.com/file.mp4",
            "file:///etc/passwd",
            "gopher://example.com",
            "javascript:alert(1)",
            "",
        ]
        for url in invalid_urls:
            response = client.post("/extract-metadata", json={"url": url})
            self.assertEqual(response.status_code, 400)

    def test_vtt_parser_timing_and_cues(self):
        """Verify WebVTT parser correctly extracts timestamps and cleans markup."""
        sample_vtt = """WEBVTT
Kind: captions
Language: en

00:00:01.000 --> 00:00:04.500
<c.colorE5E5E5>Welcome to</c> <b>Elio AI</b>!

00:00:05.250 --> 00:00:08.800
- Here is your video summary &amp; insights.

00:00:09.000 --> 00:00:11.000
- Here is your video summary &amp; insights.

00:00:12.000 --> 00:00:15.500
Enjoy learning faster!
"""
        snippets = parse_vtt_content(sample_vtt)
        self.assertEqual(len(snippets), 3, "Duplicate consecutive cues should be deduplicated")

        self.assertEqual(snippets[0]["start"], 1.0)
        self.assertEqual(snippets[0]["duration"], 3.5)
        self.assertEqual(snippets[0]["text"], "Welcome to Elio AI!")

        self.assertEqual(snippets[1]["start"], 5.25)
        self.assertEqual(snippets[1]["duration"], 3.55)
        self.assertEqual(snippets[1]["text"], "Here is your video summary & insights.")

        self.assertEqual(snippets[2]["start"], 12.0)
        self.assertEqual(snippets[2]["duration"], 3.5)
        self.assertEqual(snippets[2]["text"], "Enjoy learning faster!")

    def test_srt_parser_support(self):
        """Verify SRT format with commas in timestamps parses accurately."""
        sample_srt = """1
00:01:20,500 --> 00:01:24,200
This is an SRT subtitle cue.

2
00:01:25,000 --> 00:01:28,000
Second subtitle cue.
"""
        snippets = parse_vtt_content(sample_srt)
        self.assertEqual(len(snippets), 2)
        self.assertEqual(snippets[0]["start"], 80.5)
        self.assertEqual(snippets[0]["duration"], 3.7)
        self.assertEqual(snippets[0]["text"], "This is an SRT subtitle cue.")

    def test_service_auth_token(self):
        """Verify service key enforcement when SERVICE_KEY is configured."""
        orig_key = settings.SERVICE_KEY
        try:
            settings.SERVICE_KEY = "test-secret-token"

            # No header -> 401
            resp = client.post("/extract-metadata", json={"url": "https://example.com/video"})
            self.assertEqual(resp.status_code, 401)

            # Invalid Bearer -> 401
            resp = client.post(
                "/extract-metadata",
                json={"url": "https://example.com/video"},
                headers={"Authorization": "Bearer wrong-key"}
            )
            self.assertEqual(resp.status_code, 401)

            # Valid X-API-Key -> Auth passes (then proceeds to URL validation)
            resp = client.post(
                "/extract-metadata",
                json={"url": "http://127.0.0.1:8000"},
                headers={"X-API-Key": "test-secret-token"}
            )
            # Should pass auth and fail at SSRF check (403)
            self.assertEqual(resp.status_code, 403)

        finally:
            settings.SERVICE_KEY = orig_key


if __name__ == "__main__":
    unittest.main()
