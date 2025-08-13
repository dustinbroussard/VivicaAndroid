# AGENTS.md

## Project Name
Vivica: Local-First AI Assistant with Deep Memory

## Purpose
Vivica is a local-first AI assistant web app focused on text chat. It supports customizable AI personas, memory management, offline PWA usage, and Android WebView integration.

Users can chat with Vivica using multiple AI personas (e.g., snarky roaster, helpful assistant). Conversations, memory snippets, and settings are stored in IndexedDB for persistence. personas define LLM behavior (model, system prompt, temperature, etc.).

## Key Features
- Chat mode with shared memory across personas
- Local-only memory system (editable, taggable, infinite)
- AI persona system with persistent config per persona
- IndexedDB for conversations, messages, memory, personas
- Theme switching (dark/light + color themes)
- Android bridge for native logs and toasts
- Fully installable PWA

## Vivica App Polish TODOs

- [ ] Fix/clarify persona switching (no refresh required, always updates current chat)
- [ ] Investigate/tweak scroll-to-bottom button logic or just remove if not needed
- [ ] Always show sidebar conversation action buttons (desktop & mobile)
      - Or: Implement long-press (mobile) and right-click (desktop) for action menu
- [ ] Move "Summarize & Save" to a persistent, obvious location in chat UI
- [ ] Remove Quick Actions from welcome screen; replace with something useful:
      - Welcome home, stats, recent activity, Vivica’s sassy message, etc.
      - Make Vivica logo/name in sidebar always return to welcome
- [ ] (Optional) Enhance the welcome screen with per-persona stats/snark
- [ ] Keep orb, keep logo handling as-is—no change needed

