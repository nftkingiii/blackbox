# BlackBox

BlackBox is an AI-native multiplayer mystery guessing game. Players join a room, pick a story pack, watch clues drip in over a timer, submit guesses, and score points for fast correct answers.

V2 sessions run for 20 unique rounds and include responsive phone layouts, timed emoji clues, randomized letter reveals with visible highlights, atmospheric background audio, and gameplay sound cues.

The MVP follows the PDF blueprint while staying dependency-free so it can run immediately:

- `server/index.js` for HTTP routing
- `server/RoomManager.js` for rooms and players
- `server/RoundEngine.js` for phases, timers, guesses, reveal, and scoring
- `server/ModeRegistry.js` plus `server/modes/` for pluggable game modes and code-owned story packs
- `client/src/` for the browser app
- `shared/events.js` for event and phase constants
- Server-sent events for live room updates
- Server-authoritative answer checking
- Code-owned story packs under `server/modes/`
- Local 0G-style adapter that writes story pack/proof JSON records to `data/zero-g`

## Run

```bash
npm run dev
```

Open `http://127.0.0.1:3000`.

## Hackathon Compliance Plan

The current adapter creates deterministic `0g://blackbox/...` URIs and writes proof records locally for development. For the tournament build, replace `server/zeroGStorage.js` with real 0G storage calls while keeping the same app-facing methods:

- `saveStoryPack(pack)`
- `saveRoundProof(proof)`
- `listStoryPacks()`

BlackBox uses 0G for real product state: versioned story packs and completed round proof records.

## 0G Storage

Local storage is the default so backend work can continue without a funded wallet.

To enable real 0G Storage uploads:

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env`.
3. Set `ZERO_G_STORAGE=true`.
4. Add a funded 0G testnet private key as `ZERO_G_PRIVATE_KEY`.
5. Restart the server.

The adapter writes a local mirror first, then uploads JSON records to 0G Storage using `MemData`. If `ZERO_G_STORAGE_STRICT=false`, failed 0G uploads fall back to local storage with a warning. Set `ZERO_G_STORAGE_STRICT=true` when you want failed 0G uploads to fail the request.

## Backend Story Workflow

New stories are added by editing the relevant mode file in `server/modes/` and pushing the update. The frontend is only a testing harness for now; it does not expose a story-builder tab.

See `server/modes/README.md`.

## Solo Mode

Rooms can be created with `soloMode: true`. A solo room:

- Lets one player start immediately.
- Rejects join attempts.
- Uses the same round engine, clue reveal, scoring, and proof storage as multiplayer rooms.
