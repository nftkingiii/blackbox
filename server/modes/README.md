# Adding Stories

Story packs are code-owned content. Builders do not add stories from the frontend in the current product direction.

To add a new story:

1. Pick the mode file under `server/modes/`.
   - `seedPhrase.js`
   - `rugCoin.js`
   - `wrongNumber.js`
2. Add a new object to that mode's `packs` array.
3. Restart the server.
4. Verify the pack appears from `GET /api/story-packs`.
5. Push the code update.

Each pack needs:

- `id`: stable unique slug
- `modeId`: the matching mode id
- `title`
- `creator`
- `intro`
- `answer`: server-only; stripped from public API responses
- `answerType`
- `maskStyle`
- `timerSec`
- `difficulty`
- `tags`
- `clues`: clue objects with `at`, `type`, and `payload`
- `zeroG.uri`: temporary seed URI until real 0G upload is wired

Example clue timing:

- `at: 0.95` appears near the start
- `at: 0.66` appears around one-third into the round
- `at: 0.33` appears around two-thirds into the round

When real 0G storage is connected, seeded packs can be uploaded during deployment or through a backend script, then their returned 0G URIs can be committed with the pack.
