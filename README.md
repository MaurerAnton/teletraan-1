# Teletraan-1

Agora Desktop Web Bridge — Tomogichi habit-tracking RPG companion with LLM integration.

## Quick start (one command)

```bash
~/teletraan-1/start.sh
```

That's it. The script:
1. Starts Piper TTS (if installed at `~/piper-venv`)
2. Starts Vosk STT (if installed at `~/vosk-server.py`)
3. Starts bridge.py (file I/O + TTS proxy + config storage)
4. Opens your browser to `http://localhost:9191`

Press **Ctrl+C** in the terminal to stop all services.

## First-time setup (do once)

After `start.sh` opens the browser:

1. Click **CONFIG**
2. Click **DeepSeek Flash** preset
3. Enter your DeepSeek API key (get one at platform.deepseek.com/api_keys)
4. Set **TTS Provider**: `piper`
5. Set **STT Provider**: `custom`, **STT Endpoint**: `http://localhost:2700`
6. Click **APPLY**
7. Click **SELECT** to connect the bridge (auto-detects Tomogichi dir)
8. Toggle **🔊 ON** for voice output

Your config saves to disk (survives browser restarts).

## Desktop shortcut

```bash
cp ~/teletraan-1/teletraan-1.desktop ~/.local/share/applications/
```

Then Teletraan-1 appears in your app launcher. Double-click to start everything.

## Features

- **DeepSeek / OpenAI / llama.cpp** LLM support with SSE streaming
- **Thinking mode** (DeepSeek v4-pro) with collapsible reasoning blocks
- **Tool calling** — 15 Tomogichi bridge tools (read state, add diary, tasks, moods, etc.)
- **Piper TTS** — local neural text-to-speech
- **Vosk STT** — local speech-to-text
- **Multiple conversations** with sidebar list, search, pin, regenerate, edit
- **Morning brief** — daily summary of Tomogichi state + weather + clothing
- **Emergency polling** — auto-responds when Tomogichi triggers emergency
- **Markdown rendering** in AI responses
- **Configurable TTS timeout** (default 60s for slow PinePhone CPU)
- **Persistent config** — saves to disk via bridge, survives browser restarts

## Installation

### Prerequisites
- Python 3 (already on PinePhone/PineTab)
- DeepSeek API key

### Piper TTS (optional, recommended)
```bash
python3 -m venv ~/piper-venv
~/piper-venv/bin/pip install "piper-tts[http]"
~/piper-venv/bin/python3 -m piper.download_voices en_US-lessac-medium
```

### Vosk STT (optional, recommended)
```bash
~/piper-venv/bin/pip install vosk sounddevice
mkdir -p ~/vosk-models && cd ~/vosk-models
wget https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip
unzip vosk-model-small-en-us-0.15.zip
# vosk-server.py is included in this repo
cp ~/teletraan-1/vosk-server.py ~/vosk-server.py
```

## Usage

```bash
# Start everything (Piper + Vosk + bridge + browser)
~/teletraan-1/start.sh

# Skip TTS (no Piper)
~/teletraan-1/start.sh --no-tts

# Skip STT (no Vosk)
~/teletraan-1/start.sh --no-stt

# Custom port
~/teletraan-1/start.sh --port 9192

# Don't auto-open browser
~/teletraan-1/start.sh --no-browser
```

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Enter` | Send message |
| `Ctrl+L` | Clear terminal |
| `Ctrl+,` | Open/close CONFIG |
| `Ctrl+B` | Run morning brief |
| `F11` | Toggle fullscreen |
| `Esc` | Close panels / exit fullscreen |

## Architecture

```
┌─────────────────────────┐         ┌─────────────────────────┐
│  PinePhone / PineTab    │         │  Local services         │
│                         │         │                         │
│  LibreWolf              │ ──HTTP──│  bridge.py :9191        │
│  http://localhost:9191  │         │    ├─ file I/O          │
│                         │         │    ├─ /tts → Piper :5000│
│                         │         │    ├─ /config (persist) │
│                         │         │    └─ serves HTML       │
│  DeepSeek API (remote)  │ ──HTTPS─│  Vosk :2700 (STT)       │
│                         │         │  Tomogichi bridge files │
└─────────────────────────┘         └─────────────────────────┘
```

## Bridge server

```
python3 bridge.py <tomogichi-data-dir> [options]

Options:
  --port PORT       Bridge port (default: 9191)
  --token TOKEN     Bearer auth token
  --tts-url URL     Piper TTS server URL (default: disabled)
```

Endpoints: `/ping`, `/read/`, `/write/`, `/append/`, `/exists/`, `/files`, `/tts`, `/config`

## Troubleshooting

**Buttons don't work:** Hard-refresh browser (Ctrl+Shift+R) after `git pull`.

**TTS unavailable:** Ensure Piper is running (`curl http://localhost:5000/info`). Bridge must be started with `--tts-url http://localhost:5000` (start.sh does this automatically).

**STT unavailable:** Mic access requires `http://localhost` (not `file://`). Use `start.sh` which opens via bridge at `http://localhost:9191`. Ensure Vosk is running (`curl http://localhost:2700`).

**API key lost after restart:** Config auto-saves to `~/.local/share/tomogichi-qt/teletraan-config.json` via bridge. On startup, if localStorage is empty, it recovers from this file.

**Logs:** `cat /tmp/piper.log`, `cat /tmp/vosk.log`, `cat /tmp/bridge.log`

## License

GPL-3.0
