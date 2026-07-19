#!/usr/bin/env python3
"""Vosk STT server — supports both HTTP (one-shot) and WebSocket (streaming) modes.

HTTP mode (port 2700):
    POST /  with audio/wav body → {"text": "..."}
    Legacy one-shot: capture whole utterance, send as WAV, get final text.
    Used by the original toggleMic() flow.

WebSocket mode (port 2701):
    Send binary frames of 16kHz mono 16-bit PCM audio.
    Server streams back partial and final results as JSON:
        {"partial": "..."}     — still speaking
        {"text": "...", "result": [...]}  — Vosk detected silence endpoint
    Used by hands-free voice mode with wake word activation.

Usage:
    python3 ~/vosk-server.py [model_path]
    # Default model: ~/vosk-models/vosk-model-small-en-us-0.15

Requires: vosk, websockets (pip install websockets)
"""

import http.server
import json
import wave
import io
import os
import sys
import asyncio
import threading

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

# ──────────────────────────────────────────────────────────────────────────────
# HTTP MODE (port 2700) — one-shot WAV transcription
# ──────────────────────────────────────────────────────────────────────────────

class HTTPHandler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length == 0:
                self.send_response(400); self._cors()
                self.end_headers()
                self.wfile.write(json.dumps({"error": "No audio data"}).encode())
                return
            audio = self.rfile.read(length)
            wf = wave.open(io.BytesIO(audio), 'rb')
            rec = vosk.KaldiRecognizer(model, wf.getframerate())
            while True:
                data = wf.readframes(4000)
                if len(data) == 0: break
                rec.AcceptWaveform(data)
            result = json.loads(rec.FinalResult())
            self.send_response(200); self._cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"text": result.get("text", "")}).encode())
        except Exception as e:
            self.send_response(500); self._cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def log_message(self, fmt, *args):
        pass  # silence HTTP logging — too noisy during streaming mode


def run_http_server():
    """Run HTTP server on port 2700 in a daemon thread."""
    server = http.server.HTTPServer(('127.0.0.1', 2700), HTTPHandler)
    server.serve_forever()


# ──────────────────────────────────────────────────────────────────────────────
# WEBSOCKET MODE (port 2701) — streaming recognition
# ──────────────────────────────────────────────────────────────────────────────

try:
    import websockets
except ImportError:
    print("ERROR: 'websockets' library not installed.", file=sys.stderr)
    print("Install it with: pip install websockets", file=sys.stderr)
    print("Voice mode (hands-free) requires this. HTTP mode still works.", file=sys.stderr)
    websockets = None

if websockets:
    async def ws_handler(websocket, path):
        """Per-connection handler. Each connection gets its own recognizer."""
        # 16kHz mono — sample rate must match client audio
        rec = vosk.KaldiRecognizer(model, 16000)
        rec.SetWords(True)
        try:
            async for message in websocket:
                if isinstance(message, bytes):
                    # AcceptWaveform returns True when Vosk detects a silence
                    # endpoint (~0.5s of silence). In that case, FinalResult
                    # has the complete utterance. Otherwise PartialResult has
                    # the in-progress transcription.
                    if rec.AcceptWaveform(message):
                        final = rec.FinalResult()
                        await websocket.send(final)
                    else:
                        partial = rec.PartialResult()
                        await websocket.send(partial)
                elif isinstance(message, str):
                    # Text message — ignore (could be used for control commands
                    # in the future, e.g. "reset" to clear recognizer state)
                    pass
        except websockets.exceptions.ConnectionClosed:
            pass
        except Exception as e:
            print(f"[vosk-ws] error: {e}", file=sys.stderr)


    async def run_ws_server():
        """Run WebSocket server on port 2701."""
        async with websockets.serve(ws_handler, "127.0.0.1", 2701,
                                     max_size=None,  # allow large audio chunks
                                     ping_interval=30, ping_timeout=120):
            print("[vosk-ws] WebSocket on ws://127.0.0.1:2701", file=sys.stderr)
            print("[vosk-ws] Send 16kHz mono 16-bit PCM binary frames.", file=sys.stderr)
            print("[vosk-ws] Receives: {\"partial\":\"...\"} or {\"text\":\"...\"}", file=sys.stderr)
            # Run forever
            await asyncio.Future()


def main():
    # Start HTTP server in daemon thread
    http_thread = threading.Thread(target=run_http_server, daemon=True)
    http_thread.start()
    print("[vosk] HTTP on http://127.0.0.1:2700", file=sys.stderr)

    if websockets:
        # Run WebSocket server on main asyncio loop
        try:
            asyncio.run(run_ws_server())
        except KeyboardInterrupt:
            print("\n[vosk] shutting down", file=sys.stderr)
    else:
        # No websockets — just keep HTTP alive
        print("[vosk] WebSocket mode disabled (pip install websockets to enable)", file=sys.stderr)
        try:
            while True:
                threading.Event().wait(3600)
        except KeyboardInterrupt:
            print("\n[vosk] shutting down", file=sys.stderr)


if __name__ == "__main__":
    main()
