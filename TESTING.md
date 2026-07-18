# Teletraan-1 Testing Checklist

After each `git pull`, run through the relevant section. Each item takes ~10 seconds unless noted.

## Pre-flight (always check first)

- [ ] Open `teletraan.html` in LibreWolf — no white screen
- [ ] Terminal shows "Teletraan-1 online. Agora bridge active."
- [ ] No errors in terminal on startup
- [ ] Hex grid background animating (pulses every 2-5s)
- [ ] Clock in sidebar shows current time + date

## Tier 1 — Multiple conversations + per-message actions

### Conversations
- [ ] Sidebar shows conversation list (not just status panel)
- [ ] Existing conversation migrated as "Imported" (or similar) — no data loss
- [ ] "NEW" button starts fresh conversation
- [ ] Switching between conversations preserves history
- [ ] Conversation title auto-generated after first AI response
- [ ] Click title to edit → type new title → press Enter → saved
- [ ] Relative timestamps shown ("2m ago", "1h ago") in list

### Per-message hover actions
- [ ] Hover over AI message → shows "↻" (regenerate) button
- [ ] Click ↻ → drops that message, re-sends previous user message
- [ ] Hover over user message → shows "✎" (edit) button
- [ ] Click ✎ → message becomes editable → save → re-sends
- [ ] Hover over any message → shows "☆" (pin) button
- [ ] Click ☆ → becomes "★" (pinned)
- [ ] Hover over AI message → shows "📋" (copy) button
- [ ] Click 📋 → text copied to clipboard (paste elsewhere to verify)

### Message status indicators
- [ ] Sending message → shows ⏳ icon next to user message
- [ ] AI thinking → shows 🤔 icon next to AI message (if thinking mode on)
- [ ] Tool call → shows 🔧 icon
- [ ] Success → shows ✓ icon
- [ ] Error → shows ⚠ icon
- [ ] Stopped (via STOP button) → shows ⏹ icon

### Configurable TTS timeout
- [ ] CONFIG panel shows "TTS Timeout (seconds)" field, default 60
- [ ] Set to 10 → APPLY → send long message → TTS times out in ~10s (not 30s)
- [ ] Set to 120 → APPLY → long messages don't time out

## Tier 2 — Memory + search + export

### Memory browser
- [ ] Sidebar shows "🧠 MEMORY" button
- [ ] Click → slide-out panel from right
- [ ] Shows active memory (current morning brief if generated)
- [ ] Shows saved memory files (if AI created any)
- [ ] Click file → view content
- [ ] Delete button removes file
- [ ] Close button or Escape closes panel

### Search
- [ ] Search box above conversation list
- [ ] Type "hello" → conversations containing "hello" filter
- [ ] Matches highlighted in blue
- [ ] Clear search → all conversations visible again

### Export/import
- [ ] "⬇ EXPORT" button downloads `teletraan-export.json`
- [ ] Open the JSON file → contains conversations, memory, config
- [ ] API key NOT in the export (search for "sk-" — should not find)
- [ ] "⬆ IMPORT" button → select exported JSON → conversations merge in
- [ ] Imported conversations appear in sidebar

### Drop-in provisioning
- [ ] Create `teletraan-providers.json` in Tomogichi bridge dir:
      `{"endpoint":"https://api.deepseek.com","model":"deepseek-v4-flash","apikey":"sk-..."}`
- [ ] Start bridge → reload teletraan.html
- [ ] Config auto-applies (provider/model/key set from file)
- [ ] Sentinel file `teletraan-providers.imported` created in bridge dir
- [ ] Delete sentinel → reload → re-imports (updates config)

## Tier 3 — Polish

### Markdown rendering
- [ ] Send "Show me a code block with `inline code` and **bold** text"
- [ ] AI response renders code blocks in bordered box
- [ ] Inline code styled differently (background highlight)
- [ ] Bold text actually bold
- [ ] Lists render with bullet points
- [ ] HTML in user input is escaped (send `<script>alert(1)</script>` — should NOT execute)

### Timestamps
- [ ] Messages do NOT show timestamps by default
- [ ] Click a message → timestamp appears (HH:MM format)
- [ ] Click again → timestamp hides
- [ ] CONFIG → enable "Always show timestamps" → APPLY
- [ ] All messages now show timestamps without clicking
- [ ] Disable → APPLY → timestamps hidden again

### Connection health
- [ ] Green/red dot next to "LLM" in sidebar
- [ ] After sending message, dot stays green
- [ ] LLM endpoint unreachable → dot turns red
- [ ] Response time shown (e.g. "~1.2s") after each message

## Regression tests (existing features still work)

- [ ] Provider presets work (click "DeepSeek Flash" → endpoint/model update, API key preserved)
- [ ] API key password field with SHOW/HIDE toggle
- [ ] Streaming responses (token-by-token, not all-at-once)
- [ ] STOP button mid-generation works (click during streaming)
- [ ] Thinking mode (DeepSeek Pro preset) shows collapsible reasoning block
- [ ] Tool calls show as collapsible cards (send "what's my tomogichi state?")
- [ ] Emergency flag polling (create `agora-emergency.flag` in bridge dir → auto-responds once, not repeatedly)
- [ ] Morning brief (Ctrl+B) generates + updates active memory
- [ ] CONFIG → SELECT → bridge auto-connects (no path entry needed)
- [ ] TTS: toggle 🔊 ON → send message → spoken via Piper
- [ ] TTS: toggle 🔊 ON without bridge → shows setup help (not silent failure)
- [ ] STT: click 🎤 → speak → text appears → auto-sends
- [ ] Ctrl+Enter sends message
- [ ] Ctrl+L clears terminal
- [ ] Ctrl+, opens/closes CONFIG
- [ ] Ctrl+B runs morning brief
- [ ] Escape closes CONFIG panel
- [ ] Conversation restored on page reload (no data loss)
- [ ] Memory files persist on page reload
- [ ] Active memory persists on page reload

## Network setup (when PC is ready)

- [ ] On PC: `~/piper-venv/bin/python3 -m piper.http_server -m en_US-lessac-medium --host 0.0.0.0`
- [ ] On PC: find IP with `ip addr` (look for 192.168.x.x)
- [ ] On PinePhone: `python3 bridge.py ~/.local/share/tomogichi-qt/ --tts-url http://<PC-IP>:5000`
- [ ] In teletraan: CONFIG → SELECT → bridge connects
- [ ] Toggle 🔊 ON → send message → TTS plays fast (faster than PinePhone local Piper)
- [ ] Test timeout: set TTS Timeout to 60s → long messages complete

## Quick smoke test (30 seconds — do this after every commit)

1. Reload `teletraan.html`
2. Send "hello" — should get streaming AI response
3. Toggle 🔊 ON → send "test voice" — should hear Piper audio
4. Click CONFIG → verify settings saved
5. Reload page → conversation restored
