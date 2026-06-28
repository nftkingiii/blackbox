# BlackBox

BlackBox is an AI-native multiplayer mystery guessing game. Players join a room, pick a story pack, watch clues drip in over a timer, submit guesses, and score points for fast correct answers.

V2 sessions run for 20 unique rounds and include responsive phone layouts, timed emoji clues, randomized letter reveals with visible highlights, atmospheric background audio, and gameplay sound cues.

The application follows the PDF blueprint with a server-authoritative Node backend and a browser client:

- `server/index.js` for HTTP routing
- `server/RoomManager.js` for rooms and players
- `server/RoundEngine.js` for phases, timers, guesses, reveal, and scoring
- `server/ModeRegistry.js` plus `server/modes/` for pluggable game modes and code-owned story packs
- `client/src/` for the browser app
- `shared/events.js` for event and phase constants
- Server-sent events for live room updates
- Server-authoritative answer checking
- Code-owned story packs under `server/modes/`
- Real 0G Storage support for the story manifest and completed-round proofs
- Native 0G Galileo test wallets, sponsored test gas, and multiplayer escrow

## Run

```bash
npm run dev
```

Open `http://127.0.0.1:3000`.

## 0G Storage

Local storage remains available for development. Production can fail closed so gameplay cannot start unless the current story manifest is uploaded to 0G Storage.

To enable real 0G Storage uploads:

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env`.
3. Set `ZERO_G_STORAGE=true`.
4. Add a funded 0G testnet private key as `ZERO_G_PRIVATE_KEY`.
5. Restart the server.

Set `ZERO_G_STORAGE_REQUIRED=true` in Railway to make the story manifest and round proofs fail closed when 0G is unavailable. The server uploads the complete versioned story catalog at startup and blocks the story-pack API until that manifest is ready.

The public story manifest never contains plaintext answers. It stores a salted answer commitment generated with `BLACKBOX_ANSWER_PEPPER`; the server keeps answers authoritative and publishes them only in completed-round proofs.

## Galileo Wallets And Staked Rooms

- Browser-generated wallets display their real native 0G balance.
- The official faucet remains available as an external link.
- Optional welcome gas is sent by a separate, rate-limited testnet treasury configured with `ZERO_G_TREASURY_PRIVATE_KEY`.
- Multiplayer rooms may require an equal native-0G stake from each player.
- Stakes are held in `contracts/BlackBoxEscrow.sol`; two-player rooms pay the winner, rooms of 3-7 pay the top 3, and rooms of 8 or more pay the top 5.

Deploy the escrow contract after funding a dedicated operator wallet:

```bash
npm install
npm run bootstrap:testnet
```

The bootstrap command creates and funds separate operator and welcome-treasury wallets, deploys the escrow, and updates the ignored local `.env`. Copy those three generated values to Railway. Use `npm run deploy:escrow` only when the service wallets already exist. Do not reuse a player wallet or expose either key in browser code.

Stake deposits use operator-signed player authorizations and the contract locks before round one, preventing unrelated wallets from joining or changing the prize pool after the match starts.

## Backend Story Workflow

New stories are added by editing the relevant mode file in `server/modes/` and pushing the update. The frontend is only a testing harness for now; it does not expose a story-builder tab.

See `server/modes/README.md`.

## Solo Mode

Rooms can be created with `soloMode: true`. A solo room:

- Lets one player start immediately.
- Rejects join attempts.
- Uses the same round engine, clue reveal, scoring, and proof storage as multiplayer rooms.
