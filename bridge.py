#!/usr/bin/env python3
"""Tiny bridge server — proxies file I/O for Firefox-based browsers.
The HTML page (teletraan.html) calls this via fetch() to read/write
Tomogichi bridge files in the configured data directory.

Usage:
    python3 bridge.py ~/.local/share/tomogichi-qt/
    python3 bridge.py ~/.local/share/tomogichi-qt/ --port 9191
    python3 bridge.py ~/.local/share/tomogichi-qt/ --token mysecret123

Endpoints:
    GET  /ping              — health check
    GET  /read/<filename>    — read file contents
    POST /write/<filename>   — write file (body = content)
    POST /append/<filename>  — append line to file (body = content)
    GET  /exists/<filename>  — check if file exists, returns {"exists":true/false}
    GET  /files              — list bridge files with sizes

Auth (optional):
    If --token is set, client must send "Authorization: Bearer <token>" header.
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

        if path == "/ping":
            self.send_cors(200, "application/json")
            self.wfile.write(json.dumps({
                "status": "ok",
                "dir": str(self.base_dir),
                "files": self._list_files()
            }).encode())
            return

        if path == "/files":
            self.send_cors(200, "application/json")
            self.wfile.write(json.dumps({"files": self._list_files()}).encode())
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

        self.send_cors(404)
        self.wfile.write(b"unknown endpoint")

    def do_POST(self):
        if not self.check_auth():
            self.send_cors(401, "application/json")
            self.wfile.write(json.dumps({"error": "unauthorized"}).encode())
            return

        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode("utf-8", errors="replace") if length > 0 else ""

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

        if path == "/tts":
            try:
                piper_req = urllib.request.Request(
                    "http://localhost:5000/synthesize",
                    data=json.dumps({"text": body}).encode(),
                    headers={"Content-Type": "application/json"},
                )
                with urllib.request.urlopen(piper_req, timeout=30) as resp:
                    wav_data = resp.read()
                self.send_cors(200, "audio/wav")
                self.wfile.write(wav_data)
                print(f"[bridge] TTS synthesized ({len(wav_data)} bytes)", file=sys.stderr)
            except Exception as e:
                self.send_cors(502, "application/json")
                self.wfile.write(json.dumps({"error": f"Piper TTS failed: {e}"}).encode())
            return

        self.send_cors(404)
        self.wfile.write(b"unknown endpoint")

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

    i = 2
    while i < len(sys.argv):
        arg = sys.argv[i]
        if arg == "--port" and i + 1 < len(sys.argv):
            port = int(sys.argv[i + 1])
            i += 2
        elif arg == "--token" and i + 1 < len(sys.argv):
            token = sys.argv[i + 1]
            i += 2
        else:
            i += 1

    BridgeHandler.base_dir = base_dir
    BridgeHandler.auth_token = token

    server = http.server.HTTPServer(("127.0.0.1", port), BridgeHandler)
    print(f"[bridge] serving {base_dir} on http://127.0.0.1:{port}", file=sys.stderr)
    print(f"[bridge] endpoints: /ping /read/ /write/ /append/ /exists/ /files /tts", file=sys.stderr)
    if token:
        print(f"[bridge] auth: enabled (Bearer token required)", file=sys.stderr)
    else:
        print(f"[bridge] auth: disabled (open access on localhost)", file=sys.stderr)
    print(f"[bridge] Ctrl+C to stop", file=sys.stderr)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[bridge] shutting down", file=sys.stderr)


if __name__ == "__main__":
    main()
