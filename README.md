# Teletraan-1

Agora Desktop Web Bridge — Tomogichi habit-tracking RPG companion with LLM integration.

## Features

- Multi-provider LLM support (DeepSeek Flash/Pro, OpenAI, llama.cpp, Custom)
- SSE streaming with token-by-token display
- Thinking/reasoning mode (collapsible reasoning blocks)
- Tool calling for Tomogichi state: read tasks, add diary entries, log moods, manage challenges
- Voice input (Web Speech STT) and output (Web Speech TTS + Piper TTS via bridge)
- Two bridge modes: File System Access API (Chrome) or local HTTP server (Firefox/LibreWolf)
- Persistent conversation history and memory files (localStorage)

## Quick start

```bash
# 1. Start Piper TTS server (optional)
python3 -m piper.http_server -m en_US-lessac-medium

# 2. Start bridge server (required for Firefox/LibreWolf)
python3 bridge.py ~/.local/share/tomogichi-qt/

# 3. Open teletraan.html in browser
```

## Bridge server

```
python3 bridge.py <tomogichi-data-dir> [--port 9191] [--token secret]
```

Endpoints: `/ping`, `/read/`, `/write/`, `/append/`, `/exists/`, `/files`, `/tts`

## TTS providers

| Provider | Status |
|----------|--------|
| Web Speech | Browser built-in, zero config |
| Piper | Local neural TTS via bridge `/tts` proxy |
| Custom | User-defined endpoint |
