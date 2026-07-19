#!/bin/bash
# Teletraan-1 — one-command startup
# Starts Piper TTS + Vosk STT (if installed) + bridge.py + opens browser
#
# Usage:
#   ~/teletraan-1/start.sh
#   ~/teletraan-1/start.sh --no-tts        # skip Piper
#   ~/teletraan-1/start.sh --no-stt        # skip Vosk
#   ~/teletraan-1/start.sh --no-browser    # don't auto-open browser
#   ~/teletraan-1/start.sh --port 9191     # custom bridge port

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRIDGE_DIR="${TELETRAAN_BRIDGE_DIR:-$HOME/.local/share/tomogichi-qt}"
BRIDGE_PORT=9191
PIPER_VENV="$HOME/piper-venv"
START_TTS=true
START_STT=true
OPEN_BROWSER=true

# Parse args
for arg in "$@"; do
  case $arg in
    --no-tts)      START_TTS=false ;;
    --no-stt)      START_STT=false ;;
    --no-browser)  OPEN_BROWSER=false ;;
    --port)        shift; BRIDGE_PORT="$1" ;;
    --port=*)      BRIDGE_PORT="${arg#--port=}" ;;
    --help|-h)
      echo "Teletraan-1 startup script"
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --no-tts        Skip Piper TTS server"
      echo "  --no-stt        Skip Vosk STT server"
      echo "  --no-browser    Don't auto-open browser"
      echo "  --port PORT     Bridge port (default: 9191)"
      echo "  --help          Show this help"
      echo ""
      echo "Environment:"
      echo "  TELETRAAN_BRIDGE_DIR  Tomogichi data dir (default: ~/.local/share/tomogichi-qt)"
      exit 0
      ;;
  esac
done

PIDS=()

cleanup() {
  echo ""
  echo -e "${YELLOW}[teletraan] Shutting down...${NC}"
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null || true
  echo -e "${GREEN}[teletraan] All services stopped.${NC}"
  exit 0
}
trap cleanup INT TERM

echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   TELETRAAN-1 — Agora Desktop Web Bridge    ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ── 1. Start Piper TTS ──
if [ "$START_TTS" = true ]; then
  if [ -d "$PIPER_VENV" ]; then
    # Check if Piper is already running
    if curl -s --max-time 1 http://localhost:5000/info >/dev/null 2>&1; then
      echo -e "${GREEN}[piper]  Already running on http://localhost:5000${NC}"
    else
      echo -e "${BLUE}[piper]  Starting Piper TTS server...${NC}"

      # Piper downloads voices to cwd by default — use a fixed directory
      # so we always know where to find them
      PIPER_VOICES_DIR="$HOME/piper-voices"
      mkdir -p "$PIPER_VOICES_DIR"

      # Find the voice model (.onnx file)
      # Search: fixed voices dir, home dir, script dir (voice may have been downloaded elsewhere)
      PIPER_VOICE=""
      for search_dir in \
        "$PIPER_VOICES_DIR" \
        "$HOME" \
        "$SCRIPT_DIR" \
        "$HOME/.local/share/piper" \
        "$HOME/.local/share/piper/voices"; do
        if [ -d "$search_dir" ]; then
          ONNX_FILE=$(find "$search_dir" -maxdepth 2 -name "en_US-lessac-medium*.onnx" -not -name "*.onnx.json" 2>/dev/null | head -1)
          if [ -n "$ONNX_FILE" ]; then
            PIPER_VOICE="$ONNX_FILE"
            # Copy to fixed voices dir if found elsewhere
            if [ "$(dirname "$ONNX_FILE")" != "$PIPER_VOICES_DIR" ]; then
              echo -e "${BLUE}[piper]  Copying voice to $PIPER_VOICES_DIR/${NC}"
              cp "$ONNX_FILE" "$PIPER_VOICES_DIR/" 2>/dev/null || true
              # Also copy the .onnx.json config file
              cp "${ONNX_FILE}.json" "$PIPER_VOICES_DIR/" 2>/dev/null || true
            fi
            break
          fi
        fi
      done

      if [ -z "$PIPER_VOICE" ]; then
        echo -e "${YELLOW}[piper]  Voice model not found. Downloading to $PIPER_VOICES_DIR/...${NC}"
        "$PIPER_VENV/bin/python3" -m piper.download_voices en_US-lessac-medium --download-dir "$PIPER_VOICES_DIR" 2>/tmp/piper-download.log
        # Try again after download
        ONNX_FILE="$PIPER_VOICES_DIR/en_US-lessac-medium.onnx"
        if [ -f "$ONNX_FILE" ]; then
          PIPER_VOICE="$ONNX_FILE"
        fi
      fi

      if [ -z "$PIPER_VOICE" ]; then
        echo -e "${RED}[piper]  Voice model not found anywhere.${NC}"
        echo -e "${YELLOW}        Run manually:${NC}"
        echo -e "${YELLOW}        $PIPER_VENV/bin/python3 -m piper.download_voices en_US-lessac-medium --download-dir $PIPER_VOICES_DIR${NC}"
        START_TTS=false
      else
        echo -e "${BLUE}[piper]  Using voice: $PIPER_VOICE${NC}"
        # Pass --data-dir so Piper knows where to find additional voices
        "$PIPER_VENV/bin/python3" -m piper.http_server -m "$PIPER_VOICE" --data-dir "$PIPER_VOICES_DIR" >/tmp/piper.log 2>&1 &
        PIDS+=($!)
        # Wait for Piper to be ready
        for i in {1..15}; do
          if curl -s --max-time 1 http://localhost:5000/info >/dev/null 2>&1; then
            echo -e "${GREEN}[piper]  Ready on http://localhost:5000${NC}"
            break
          fi
          sleep 1
        done
        if ! curl -s --max-time 1 http://localhost:5000/info >/dev/null 2>&1; then
          echo -e "${RED}[piper]  Failed to start (check /tmp/piper.log)${NC}"
          START_TTS=false
        fi
      fi
    fi
  else
    echo -e "${YELLOW}[piper]  Piper venv not found at $PIPER_VENV — skipping TTS${NC}"
    START_TTS=false
  fi
fi

# ── 2. Start Vosk STT ──
if [ "$START_STT" = true ]; then
  VOSK_SCRIPT="$HOME/vosk-server.py"
  if [ -f "$VOSK_SCRIPT" ] && [ -d "$HOME/vosk-models/vosk-model-small-en-us-0.15" ]; then
    # Check if Vosk is already running
    if curl -s --max-time 1 http://localhost:2700/ >/dev/null 2>&1; then
      echo -e "${GREEN}[vosk]   Already running on http://localhost:2700${NC}"
    else
      echo -e "${BLUE}[vosk]   Starting Vosk STT server...${NC}"
      "$PIPER_VENV/bin/python3" "$VOSK_SCRIPT" >/tmp/vosk.log 2>&1 &
      PIDS+=($!)
      # Wait for Vosk to be ready
      for i in {1..10}; do
        if curl -s --max-time 1 http://localhost:2700/ >/dev/null 2>&1; then
          echo -e "${GREEN}[vosk]   Ready on http://localhost:2700${NC}"
          break
        fi
        sleep 1
      done
      if ! curl -s --max-time 1 http://localhost:2700/ >/dev/null 2>&1; then
        echo -e "${YELLOW}[vosk]   Not ready yet (check /tmp/vosk.log) — STT may not work${NC}"
      fi
    fi
  else
    echo -e "${YELLOW}[vosk]   Vosk not installed (missing ~/vosk-server.py or model) — skipping STT${NC}"
    echo -e "${YELLOW}        Install: see README.md → STT section${NC}"
  fi
fi

# ── 3. Start bridge.py ──
TTS_FLAG=""
if [ "$START_TTS" = true ]; then
  TTS_FLAG="--tts-url http://localhost:5000"
fi

echo -e "${BLUE}[bridge] Starting bridge.py (port $BRIDGE_PORT)...${NC}"
cd "$SCRIPT_DIR"
python3 bridge.py "$BRIDGE_DIR" --port "$BRIDGE_PORT" $TTS_FLAG >/tmp/bridge.log 2>&1 &
PIDS+=($!)
# Wait for bridge to be ready
for i in {1..10}; do
  if curl -s --max-time 1 "http://localhost:$BRIDGE_PORT/ping" >/dev/null 2>&1; then
    echo -e "${GREEN}[bridge] Ready on http://localhost:$BRIDGE_PORT${NC}"
    break
  fi
  sleep 1
done
if ! curl -s --max-time 1 "http://localhost:$BRIDGE_PORT/ping" >/dev/null 2>&1; then
  echo -e "${RED}[bridge] Failed to start (check /tmp/bridge.log)${NC}"
  exit 1
fi

# Show bridge info
PING_INFO=$(curl -s "http://localhost:$BRIDGE_PORT/ping" 2>/dev/null)
echo -e "${BLUE}[bridge] Bridge dir: $(echo "$PING_INFO" | python3 -c "import json,sys; print(json.load(sys.stdin).get('dir','?'))" 2>/dev/null || echo '?')${NC}"
echo -e "${BLUE}[bridge] TTS proxy: $(echo "$PING_INFO" | python3 -c "import json,sys; print('active' if json.load(sys.stdin).get('tts_proxy') else 'disabled')" 2>/dev/null || echo '?')${NC}"

# ── 4. Open browser ──
URL="http://localhost:$BRIDGE_PORT"
if [ "$OPEN_BROWSER" = true ]; then
  echo -e "${BLUE}[browser] Opening $URL ...${NC}"
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" 2>/dev/null || true
  elif command -v firefox >/dev/null 2>&1; then
    firefox "$URL" 2>/dev/null || true
  else
    echo -e "${YELLOW}[browser] Can't auto-open — open $URL manually${NC}"
  fi
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  TELETRAAN-1 IS RUNNING                      ║${NC}"
echo -e "${GREEN}║  URL: $URL                       ║${NC}"
echo -e "${GREEN}║  Press Ctrl+C to stop all services           ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}First-time setup (do once in CONFIG):${NC}"
echo -e "  1. Click CONFIG → DeepSeek Flash preset → enter API key → APPLY"
echo -e "  2. TTS Provider: piper"
echo -e "  3. STT Provider: custom, Endpoint: http://localhost:2700"
echo -e "  4. APPLY → click SELECT to connect bridge"
echo -e "  5. Toggle 🔊 ON for voice output"
echo ""

# Wait for Ctrl+C
wait
