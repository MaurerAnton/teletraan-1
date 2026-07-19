#!/usr/bin/env python3
"""Tiny bridge server — proxies file I/O for Firefox-based browsers.
The HTML page (teletraan.html) calls this via fetch() to read/write
Tomogichi bridge files in the configured data directory.

Usage:
    python3 bridge.py ~/.local/share/tomogichi-qt/
    python3 bridge.py ~/.local/share/tomogichi-qt/ --port 9191
    python3 bridge.py ~/.local/share/tomogichi-qt/ --token mysecret123
    python3 bridge.py ~/.local/share/tomogichi-qt/ --tts-url http://localhost:5000

Endpoints:
    GET  /ping              — health check
    GET  /read/<filename>    — read file contents
    POST /write/<filename>   — write file (body = content)
    POST /append/<filename>  — append line to file (body = content)
    GET  /exists/<filename>  — check if file exists, returns {"exists":true/false}
    GET  /files              — list bridge files with sizes
    POST /tts                — proxy TTS (body = {"text":"..."}), returns audio bytes
    GET  /config             — read persistent config (teletraan-config.json)
    POST /config             — save persistent config (body = JSON)

Auth (optional):
    If --token is set, client must send "Authorization: Bearer <token>" header.

TTS proxy (optional):
    If --tts-url is set, POST /tts forwards the request to that URL's /synthesize
    endpoint (Piper TTS compatible) and returns audio bytes. Default: disabled.
"""

import http.server
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path


class BridgeHandler(http.server.BaseHTTPRequestHandler):
    base_dir: Path = Path(".")
    auth_token: str = ""
    tts_url: str = ""

    def log_message(self, fmt, *args):
        print(f"[bridge] {self.command} {self.path} -> {args[0]}", file=sys.stderr)

    def send_cors(self, status=200, content_type="text/plain; charset=utf-8"):
        self.send_response(status)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Content-Type", content_type)
        self.end_headers()

    def check_auth(self):
        """Returns True if auth passes (or no token configured)."""
        if not self.auth_token:
            return True
        auth = self.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            return auth[7:] == self.auth_token
        return False

    def do_OPTIONS(self):
        self.send_cors(204)

    def safe_path(self, filename: str) -> Path:
        """Resolve filename within base_dir, rejecting path traversal."""
        filename = filename.lstrip("/")
        decoded = urllib.parse.unquote(filename)
        resolved = (self.base_dir / decoded).resolve()
        if not str(resolved).startswith(str(self.base_dir.resolve())):
            raise ValueError("path traversal denied")
        return resolved

    def do_GET(self):
        if not self.check_auth():
            self.send_cors(401, "application/json")
            self.wfile.write(json.dumps({"error": "unauthorized"}).encode())
            return

        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # Serve teletraan.html at / and /teletraan.html
        # This allows opening http://localhost:9191 in browser, which is needed
        # for getUserMedia (microphone) — file:// doesn't allow mic access in Firefox
        if path == "/" or path == "/teletraan.html" or path == "/index.html":
            html_path = self.base_dir / "teletraan.html"
            # Also try sibling to script dir (when bridge.py is in repo root)
            if not html_path.exists():
                html_path = Path(__file__).parent / "teletraan.html"
            if html_path.exists():
                content = html_path.read_bytes()
                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return
            else:
                self.send_cors(404, "application/json")
                self.wfile.write(json.dumps({"error": "teletraan.html not found. Place it next to bridge.py or in the data dir."}).encode())
                return

        if path == "/ping":
            self.send_cors(200, "application/json")
            self.wfile.write(json.dumps({
                "status": "ok",
                "dir": str(self.base_dir),
                "files": self._list_files(),
                "tts_proxy": bool(self.tts_url),
                "tts_url": self.tts_url or None,
            }).encode())
            return

        if path == "/files":
            self.send_cors(200, "application/json")
            self.wfile.write(json.dumps({"files": self._list_files()}).encode())
            return

        if path == "/config":
            # Read persistent config from teletraan-config.json in the bridge dir
            # This survives browser restarts (localStorage may be cleared by LibreWolf)
            config_path = self.base_dir / "teletraan-config.json"
            if config_path.exists():
                try:
                    config_data = json.loads(config_path.read_text())
                    self.send_cors(200, "application/json")
                    self.wfile.write(json.dumps(config_data).encode())
                except Exception as e:
                    self.send_cors(500, "application/json")
                    self.wfile.write(json.dumps({"error": f"Config parse error: {e}"}).encode())
            else:
                self.send_cors(404, "application/json")
                self.wfile.write(json.dumps({"error": "No config file yet"}).encode())
            return

        if path.startswith("/read/"):
            filename = path[len("/read/"):]
            try:
                fpath = self.safe_path(filename)
                if not fpath.exists():
                    self.send_cors(404)
                    self.wfile.write(b"not found")
                    return
                content = fpath.read_text()
                self.send_cors(200)
                self.wfile.write(content.encode())
            except ValueError as e:
                self.send_cors(403)
                self.wfile.write(str(e).encode())
            except Exception as e:
                self.send_cors(500)
                self.wfile.write(str(e).encode())
            return

        if path.startswith("/exists/"):
            filename = path[len("/exists/"):]
            try:
                fpath = self.safe_path(filename)
                self.send_cors(200, "application/json")
                self.wfile.write(json.dumps({"exists": fpath.exists()}).encode())
            except ValueError as e:
                self.send_cors(403, "application/json")
                self.wfile.write(json.dumps({"error": str(e)}).encode())
            return

        self.send_cors(404, "application/json")
        self.wfile.write(json.dumps({"error": "unknown endpoint"}).encode())

    def do_POST(self):
        if not self.check_auth():
            self.send_cors(401, "application/json")
            self.wfile.write(json.dumps({"error": "unauthorized"}).encode())
            return

        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode("utf-8", errors="replace") if length > 0 else ""

        if path == "/tts":
            # Proxy to Piper TTS server (or any compatible HTTP TTS endpoint)
            if not self.tts_url:
                self.send_cors(503, "application/json")
                self.wfile.write(json.dumps({"error": "TTS proxy disabled (start bridge with --tts-url http://localhost:5000)"}).encode())
                return
            # Body size limit (10MB) — prevents DoS via huge POST
            if len(body) > 10_000_000:
                self.send_cors(413, "application/json")
                self.wfile.write(json.dumps({"error": "Request body too large (max 10MB)"}).encode())
                return
            try:
                target_url = self.tts_url.rstrip("/") + "/synthesize"
                req = urllib.request.Request(
                    target_url,
                    data=body.encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=60) as resp:
                    audio_data = resp.read()
                    content_type = resp.headers.get("Content-Type", "audio/wav")
                    # Check if response is actually audio by looking at magic bytes:
                    # WAV files start with "RIFF"...."WAVE"
                    # This is more reliable than Content-Type (Piper may send odd headers)
                    is_audio = (
                        len(audio_data) >= 12 and
                        audio_data[0:4] == b'RIFF' and
                        audio_data[8:12] == b'WAVE'
                    )
                    if not is_audio:
                        # Not WAV audio — likely an error response from Piper
                        self.send_cors(502, "application/json")
                        err_text = audio_data.decode("utf-8", errors="replace")[:300]
                        self.wfile.write(json.dumps({"error": "Piper returned non-audio (Content-Type: " + content_type + "): " + err_text}).encode())
                        return
                    # It's valid WAV audio — override content_type to be sure
                    content_type = "audio/wav"
                # Send response with explicit Content-Length (audio can be large)
                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(audio_data)))
                self.end_headers()
                self.wfile.write(audio_data)
                print(f"[bridge] TTS proxy: {len(audio_data)} bytes from {target_url}", file=sys.stderr)
            except urllib.error.HTTPError as e:
                # Piper returned an HTTP error (400/500) — forward as JSON, not audio
                err_body = e.read().decode("utf-8", errors="replace")[:200] if e.fp else ""
                self.send_cors(502, "application/json")
                self.wfile.write(json.dumps({"error": f"Piper HTTP {e.code}: {err_body}"}).encode())
            except urllib.error.URLError as e:
                self.send_cors(502, "application/json")
                self.wfile.write(json.dumps({"error": f"TTS server unreachable: {e.reason}"}).encode())
            except Exception as e:
                self.send_cors(500, "application/json")
                self.wfile.write(json.dumps({"error": f"TTS proxy failed: {e}"}).encode())
            return

        if path == "/config":
            # Save persistent config to teletraan-config.json in the bridge dir
            # Survives browser restarts — localStorage may be cleared by LibreWolf privacy settings
            config_path = self.base_dir / "teletraan-config.json"
            try:
                # Parse to validate JSON, then write prettified
                config_data = json.loads(body)
                config_path.write_text(json.dumps(config_data, indent=2))
                self.send_cors(200, "application/json")
                self.wfile.write(json.dumps({"ok": True, "saved": True}).encode())
                print(f"[bridge] config saved to {config_path.name}", file=sys.stderr)
            except json.JSONDecodeError as e:
                self.send_cors(400, "application/json")
                self.wfile.write(json.dumps({"error": f"Invalid JSON: {e}"}).encode())
            except Exception as e:
                self.send_cors(500, "application/json")
                self.wfile.write(json.dumps({"error": f"Config save failed: {e}"}).encode())
            return

        if path.startswith("/write/"):
            filename = path[len("/write/"):]
            try:
                fpath = self.safe_path(filename)
                fpath.parent.mkdir(parents=True, exist_ok=True)
                fpath.write_text(body)
                self.send_cors(200, "application/json")
                self.wfile.write(json.dumps({"ok": True, "bytes": len(body)}).encode())
                print(f"[bridge] wrote {fpath.name} ({len(body)} bytes)", file=sys.stderr)
            except ValueError as e:
                self.send_cors(403)
                self.wfile.write(str(e).encode())
            except Exception as e:
                self.send_cors(500)
                self.wfile.write(str(e).encode())
            return

        if path.startswith("/append/"):
            filename = path[len("/append/"):]
            try:
                fpath = self.safe_path(filename)
                fpath.parent.mkdir(parents=True, exist_ok=True)
                with open(fpath, "a") as f:
                    f.write(body)
                self.send_cors(200, "application/json")
                self.wfile.write(json.dumps({"ok": True, "bytes": len(body)}).encode())
                print(f"[bridge] appended to {fpath.name} ({len(body)} bytes)", file=sys.stderr)
            except ValueError as e:
                self.send_cors(403)
                self.wfile.write(str(e).encode())
            except Exception as e:
                self.send_cors(500)
                self.wfile.write(str(e).encode())
            return

        self.send_cors(404, "application/json")
        self.wfile.write(json.dumps({"error": "unknown endpoint"}).encode())

    def _list_files(self):
        """Return list of bridge files with sizes."""
        files = []
        if self.base_dir.exists():
            for entry in self.base_dir.iterdir():
                if entry.is_file():
                    files.append({
                        "name": entry.name,
                        "size": entry.stat().st_size,
                        "modified": entry.stat().st_mtime
                    })
        return files


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    base_dir = Path(sys.argv[1]).resolve()
    if not base_dir.exists():
        print(f"Error: directory does not exist: {base_dir}", file=sys.stderr)
        print("Create it first: mkdir -p " + str(base_dir), file=sys.stderr)
        sys.exit(1)
    if not base_dir.is_dir():
        print(f"Error: not a directory: {base_dir}", file=sys.stderr)
        sys.exit(1)

    port = 9191
    token = ""
    tts_url = ""

    i = 2
    while i < len(sys.argv):
        arg = sys.argv[i]
        if arg == "--port" and i + 1 < len(sys.argv):
            port = int(sys.argv[i + 1])
            i += 2
        elif arg == "--token" and i + 1 < len(sys.argv):
            token = sys.argv[i + 1]
            i += 2
        elif arg == "--tts-url" and i + 1 < len(sys.argv):
            tts_url = sys.argv[i + 1]
            i += 2
        else:
            i += 1

    BridgeHandler.base_dir = base_dir
    BridgeHandler.auth_token = token
    BridgeHandler.tts_url = tts_url

    server = http.server.HTTPServer(("127.0.0.1", port), BridgeHandler)
    print(f"[bridge] serving {base_dir} on http://127.0.0.1:{port}", file=sys.stderr)
    print(f"[bridge] endpoints: /ping /read/ /write/ /append/ /exists/ /files /tts", file=sys.stderr)
    if token:
        print(f"[bridge] auth: enabled (Bearer token required)", file=sys.stderr)
    else:
        print(f"[bridge] auth: disabled (open access on localhost)", file=sys.stderr)
    if tts_url:
        print(f"[bridge] TTS proxy: {tts_url}/synthesize", file=sys.stderr)
    else:
        print(f"[bridge] TTS proxy: disabled (use --tts-url http://localhost:5000 to enable)", file=sys.stderr)
    print(f"[bridge] Ctrl+C to stop", file=sys.stderr)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[bridge] shutting down", file=sys.stderr)


if __name__ == "__main__":
    main()
