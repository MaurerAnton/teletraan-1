#!/usr/bin/env python3
"""Vosk STT server — receives audio (WAV) via POST, returns {"text":"..."}.
Listens on http://127.0.0.1:2700

Usage:
    python3 ~/vosk-server.py [model_path]
    # Default model: ~/vosk-models/vosk-model-small-en-us-0.15
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json, wave, io, os, sys

# Resolve model path (absolute, not relative)
DEFAULT_MODEL = os.path.expanduser("~/vosk-models/vosk-model-small-en-us-0.15")
model_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_MODEL
model_path = os.path.expanduser(model_path)

if not os.path.isdir(model_path):
    print(f"ERROR: Model directory not found: {model_path}", file=sys.stderr)
    print(f"Download it:", file=sys.stderr)
    print(f"  mkdir -p ~/vosk-models && cd ~/vosk-models", file=sys.stderr)
    print(f"  wget https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip", file=sys.stderr)
    print(f"  unzip vosk-model-small-en-us-0.15.zip", file=sys.stderr)
    sys.exit(1)

import vosk
model = vosk.Model(model_path)
print(f"Vosk loaded model: {model_path}", file=sys.stderr)

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            if length == 0:
                self.send_response(400)
                self._cors()
                self.end_headers()
                self.wfile.write(json.dumps({"error": "No audio data"}).encode())
                return
            audio = self.rfile.read(length)
            wf = wave.open(io.BytesIO(audio), 'rb')
            rec = vosk.KaldiRecognizer(model, wf.getframerate())
            while True:
                data = wf.readframes(4000)
                if len(data) == 0:
                    break
                rec.AcceptWaveform(data)
            result = json.loads(rec.FinalResult())
            self.send_response(200)
            self._cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"text": result.get("text", "")}).encode())
        except Exception as e:
            self.send_response(500)
            self._cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def log_message(self, fmt, *args):
        print(f"[vosk] {args[0] if args else ''}", file=sys.stderr)

print("Vosk STT server on http://127.0.0.1:2700", file=sys.stderr)
print("Send WAV audio via POST to http://localhost:2700", file=sys.stderr)
HTTPServer(('127.0.0.1', 2700), Handler).serve_forever()
