import { api, openRoomStream } from "./socket.js";
import { saveProfile, setPlayerId, store } from "./store.js";
import { audio } from "./audio.js";

const app = document.querySelector("#app");

const state = {
  route: "landing",
  packs: [],
  chain: null,
  selectedPackId: "",
  room: null,
  notice: "",
  error: "",
  loading: false,
  activeClueKey: "",
  clueDisplayText: "",
  clueTargetText: "",
  pendingClue: null,
  highlightedLetterIndices: [],
  highlightRoundIndex: null,
  showWalletSecret: false,
  formDrafts: {
    soloForm: { roundTimeSec: "60" },
    hostForm: { roundTimeSec: "60", stakeAmount: "0.005" },
    joinForm: {}
  }
};

let gameTick = null;
let clueTick = null;
let roomSyncTick = null;
let refreshInFlight = false;
let lastRefreshAt = 0;
let highlightTimer = null;
let lastCountdownCue = null;

init();

async function init() {
  window.addEventListener("hashchange", syncRoute);
  document.addEventListener("pointerdown", handleControlPointer);
  document.addEventListener("click", handleClick);
  document.addEventListener("input", handleFieldEdit);
  document.addEventListener("change", handleFieldEdit);
  document.addEventListener("submit", handleSubmit);
  syncRoute();
  await loadChainConfig();
  await loadPacks();
}

async function loadChainConfig() {
  try {
    state.chain = await api("/api/chain/config");
    if (store.profile.walletAddress) {
      await refreshWalletBalance(false).catch(() => {});
    }
  } catch (error) {
    state.chain = { error: error.message, stakingEnabled: false, sponsoredFundingEnabled: false };
  }
}

function syncRoute() {
  const route = window.location.hash.replace("#", "") || "landing";
  state.route = ["landing", "home", "solo", "host", "join", "lobby", "game", "packs"].includes(route) ? route : "landing";
  render(true);
}

async function loadPacks() {
  try {
    state.packs = await api("/api/story-packs");
    state.selectedPackId = state.selectedPackId || state.packs[0]?.id || "";
    render();
  } catch (error) {
    setError(error.message);
  }
}

function render(force = false) {
  if (!app) return;
  if (!force && isSetupControlFocused()) return;
  document.body.dataset.route = state.route;
  app.className = `app-shell route-${state.route}`;
  syncGameTick();
  app.innerHTML = `
    ${state.route === "landing" ? "" : renderTopbar()}
    ${state.route === "landing" ? renderLanding() : ""}
    ${state.route === "home" ? renderHome() : ""}
    ${state.route === "solo" ? renderSoloSetup() : ""}
    ${state.route === "host" ? renderHostSetup() : ""}
    ${state.route === "join" ? renderJoinSetup() : ""}
    ${state.route === "lobby" ? renderLobby() : ""}
    ${state.route === "game" ? renderGame() : ""}
    ${state.route === "packs" ? renderPacksPage() : ""}
    ${state.notice ? `<div class="toast notice">${escapeHtml(state.notice)}</div>` : ""}
    ${state.error ? `<div class="toast error">${escapeHtml(state.error)}</div>` : ""}
  `;
  syncClueAnimation();
}


function isSetupControlFocused() {
  return Boolean(document.activeElement?.matches?.("#soloForm input, #soloForm select, #hostForm input, #hostForm select, #joinForm input, #joinForm select"));
}
function renderTopbar() {
  return `
    <header class="topbar">
      <button class="brand-button" data-route="home" aria-label="Go home">
        <span class="brand-mark cube-brand" aria-hidden="true"><img src="./assets/blackbox-cube.svg" alt="" /></span>
        <span>
          <span class="eyebrow">BlackBox</span>
          <strong>Story Guessing Engine</strong>
        </span>
      </button>
      <nav class="nav-links" aria-label="Primary">
        <button data-route="solo">Solo Play</button>
        <button data-route="host">Host Room</button>
        <button data-route="join">Join</button>
        <button data-route="packs">Packs</button>
        ${renderAudioControls()}
      </nav>
    </header>
  `;
}

function renderWindowControl() {
  return `<button class="window-control exit-control" type="button" data-exit aria-label="Exit BlackBox">X</button>`;
}

function renderAudioControls() {
  return `
    <span class="audio-controls" aria-label="Audio controls">
      <button type="button" data-toggle-music aria-pressed="${audio.musicEnabled}">MUSIC ${audio.musicEnabled ? "ON" : "OFF"}</button>
      <button type="button" data-toggle-effects aria-pressed="${audio.effectsEnabled}">SFX ${audio.effectsEnabled ? "ON" : "OFF"}</button>
    </span>
  `;
}

function renderLanding() {
  return `
    <main class="landing-screen">
      <div class="pixel-sky" aria-hidden="true"></div>
      <div class="pixel-stars" aria-hidden="true"></div>
      <div class="contours" aria-hidden="true"></div>
      <div class="scanlines" aria-hidden="true"></div>
      <nav class="landing-nav" aria-label="Landing navigation">
        <span class="landing-brand"><span class="landing-brand-mark"></span>BLACK BOX</span>
        <span class="landing-nav-actions">
          <button class="landing-sound" type="button" data-toggle-music>MUSIC ${audio.musicEnabled ? "ON" : "OFF"}</button>
          <button class="landing-connect" type="button" data-enter-home>ENTER</button>
        </span>
      </nav>
      <section class="landing-hero">
        <div class="landing-copy">
          <p class="landing-kicker">Guess. Reveal. Survive.</p>
          <h1>BLACK<br />BOX</h1>
          <p class="landing-tagline">Decode the signal before the clock locks.</p>
          <button class="landing-action" type="button" data-enter-home>Enter BlackBox</button>
        </div>
        <div class="landing-cube-field" aria-hidden="true">
          <span class="cube-glow"></span>
          ${renderCubeVisual("landing-cube")}
          <span class="landing-orbit orbit-one"></span>
          <span class="landing-orbit orbit-two"></span>
        </div>

      </section>
    </main>
  `;
}

function renderHome() {
  return `
    <main class="home-screen">
      <section class="desktop-grid reveal">
        <div class="home-cube-stage" aria-hidden="true">
          <span class="cube-glow"></span>
          ${renderCubeVisual("home-cube")}
        </div>
        <div class="window hero-window home-hero-window">
          <div class="titlebar"><span>BlackBox.exe</span>${renderWindowControl()}</div>
          <div class="window-body hero-copy home-hero-copy">
            <p class="eyebrow">Mystery OS / Server authoritative</p>
            <h1>Crack the case before the clock locks.</h1>
            <p>
              BlackBox is a backend-first multiplayer mystery engine with solo runs, private rooms,
              server-side answers, timed clues, scoring, native 0G wallets, staked rooms, and verifiable 0G records.
            </p>
            <div class="hero-actions">
              <button class="primary-btn" data-solo-now>Solo Play</button>
              <button class="secondary-btn" data-route="host">Host Multiplayer</button>
              <button class="secondary-btn" data-route="packs">Case Library</button>
            </div>
            ${renderWalletPanel()}
          </div>
        </div>
      </section>

      <section class="mode-strip" aria-label="Game modes">
        <article class="window"><div class="titlebar"><span>Solo</span></div><div class="window-body">
          <span>Solo</span>
          <strong>Instant run</strong>
          <p>Start immediately without waiting for another player.</p>
        </div></article>
        <article class="window"><div class="titlebar"><span>0G Wallet</span></div><div class="window-body">
          <span>0G</span>
          <strong>Galileo testnet</strong>
          <p>Generate a test wallet, receive sponsored gas when configured, and enter staked rooms.</p>
        </div></article>
        <article class="window"><div class="titlebar"><span>0G Proofs</span></div><div class="window-body">
          <span>0G</span>
          <strong>Verifiable rounds</strong>
          <p>Round proofs expose storage URIs, transaction hashes, and explorer links when available.</p>
        </div></article>
      </section>
    </main>
  `;
}

function renderCubeVisual(extraClass = "") {
  return `
    <span class="cube-wrap ${extraClass}" aria-hidden="true">
      <span class="cube-aura"></span>
      <span class="cube-shadow"></span>
      <span class="fragment" style="--x:-180px;--y:-96px;--r:18deg;--s:18px;--d:9s"></span>
      <span class="fragment" style="--x:168px;--y:-122px;--r:44deg;--s:12px;--d:7s"></span>
      <span class="fragment" style="--x:198px;--y:84px;--r:12deg;--s:20px;--d:10s"></span>
      <span class="fragment" style="--x:-146px;--y:126px;--r:66deg;--s:14px;--d:8s"></span>
      <span class="fragment" style="--x:58px;--y:-190px;--r:30deg;--s:10px;--d:11s"></span>
      <span class="blackbox-cube">
        <span class="cube-face cube-front"></span>
        <span class="cube-face cube-back"></span>
        <span class="cube-face cube-right"></span>
        <span class="cube-face cube-left"></span>
        <span class="cube-face cube-top"></span>
        <span class="cube-face cube-bottom"></span>
      </span>
    </span>
  `;
}

function renderWalletPanel() {
  const profile = store.profile;
  const hasWallet = Boolean(profile.walletAddress);
  return `
    <section class="wallet-panel" aria-label="0G wallet">
      <div>
        <p class="eyebrow">0G Galileo wallet</p>
        <h2>${hasWallet ? "Testnet wallet ready." : "Generate a test wallet."}</h2>
        <p>${hasWallet ? "This balance is read directly from 0G Galileo. Keep the private key secret; this browser wallet is intended for testnet only." : "Create a browser-local test wallet, then request sponsored gas or use the official 0G faucet."}</p>
      </div>
      <div class="wallet-card">
        <span>Balance</span>
        <strong>${escapeHtml(profile.balance || "0")} 0G</strong>
        ${hasWallet ? `<code>${escapeHtml(shortAddress(profile.walletAddress))}</code>` : `<em>No wallet yet</em>`}
      </div>
      <div class="wallet-actions">
        ${hasWallet ? `<button class="secondary-btn" type="button" data-copy-proof="${escapeHtml(profile.walletAddress)}">Copy Address</button>` : `<button class="primary-btn" type="button" data-generate-wallet>Generate 0G Test Wallet</button>`}
        ${hasWallet ? `<button class="secondary-btn" type="button" data-refresh-balance>Refresh Balance</button>` : ""}
        ${hasWallet && state.chain?.sponsoredFundingEnabled ? `<button class="secondary-btn" type="button" data-fund-wallet>Request ${escapeHtml(state.chain.welcomeAmount)} 0G</button>` : ""}
        ${hasWallet && state.chain?.faucetUrl ? `<a class="proof-link" href="${escapeHtml(state.chain.faucetUrl)}" target="_blank" rel="noreferrer">Official Faucet</a>` : ""}
        ${hasWallet && state.chain?.explorerUrl ? `<a class="proof-link" href="${escapeHtml(state.chain.explorerUrl)}/address/${escapeHtml(profile.walletAddress)}" target="_blank" rel="noreferrer">View Wallet</a>` : ""}
        ${hasWallet && profile.lastStakeMatchId && state.chain?.stakingEnabled ? `<button class="secondary-btn" type="button" data-claim-escrow>Claim Prize / Refund</button>` : ""}
        ${hasWallet ? `<button class="secondary-btn" type="button" data-toggle-wallet-secret>${state.showWalletSecret ? "Hide Secret" : "Show Secret"}</button>` : ""}
      </div>
      ${hasWallet && state.showWalletSecret ? `
        <div class="wallet-secret">
          <span>Private key. Keep this secret.</span>
          <code>${escapeHtml(profile.walletPrivateKey)}</code>
          <button class="secondary-btn" type="button" data-copy-proof="${escapeHtml(profile.walletPrivateKey)}">Copy Private Key</button>
        </div>
      ` : ""}
    </section>
  `;
}

function renderProofPanel(zeroG) {
  if (!zeroG) return "";
  const isRealProof = zeroG.provider === "0g-storage";
  const label = isRealProof ? "0G proof saved" : "Local proof saved";
  return `
    <div class="proof-panel">
      <span>${escapeHtml(label)}</span>
      <code>${escapeHtml(zeroG.uri || zeroG.id || "proof pending")}</code>
      <div class="proof-actions">
        ${zeroG.explorerUrl ? `<a class="proof-link" href="${escapeHtml(zeroG.explorerUrl)}" target="_blank" rel="noreferrer">View Transaction</a>` : ""}
        ${zeroG.storageExplorerUrl ? `<a class="proof-link" href="${escapeHtml(zeroG.storageExplorerUrl)}" target="_blank" rel="noreferrer">Open StorageScan</a>` : ""}
        ${zeroG.txHash ? `<button class="secondary-btn" type="button" data-copy-proof="${escapeHtml(zeroG.txHash)}">Copy Tx</button>` : ""}
        ${zeroG.uri ? `<button class="secondary-btn" type="button" data-copy-proof="${escapeHtml(zeroG.uri)}">Copy URI</button>` : ""}
      </div>
      ${zeroG.warning ? `<small>${escapeHtml(zeroG.warning)}</small>` : ""}
      ${zeroG.error ? `<small>${escapeHtml(zeroG.error)}</small>` : ""}
    </div>
  `;
}
function renderSoloSetup() {
  return `
    <main class="setup-screen">
      <section class="window setup-card">
        <div class="titlebar"><span>SoloPlay.wnd</span>${renderWindowControl()}</div>
        <div class="window-body">
        <p class="eyebrow">Solo run with backend bots</p>
        <h1>Pick a case and start now.</h1>
        <form id="soloForm" class="form-stack">
          ${renderNameField("name", "Player name", "Detective")}
          ${renderPackSelect()}
          ${renderTimerSelect()}
          <button class="primary-btn" type="button" data-submit-setup="soloForm">${state.loading ? "Starting..." : "Start Solo Play"}</button>
        </form>
        </div>
      </section>
    </main>
  `;
}

function renderHostSetup() {
  return `
    <main class="setup-screen">
      <section class="window setup-card">
        <div class="titlebar"><span>CreateRoom.wnd</span>${renderWindowControl()}</div>
        <div class="window-body">
        <p class="eyebrow">Multiplayer</p>
        <h1>Create a private room.</h1>
        <form id="hostForm" class="form-stack">
          ${renderNameField("name", "Host name", "Room Host")}
          ${renderPackSelect()}
          ${renderTimerSelect()}
          ${renderStakeField()}
          ${renderWalletRequirement()}
          <button class="primary-btn" type="button" data-submit-setup="hostForm">${state.loading ? "Creating..." : "Create Room"}</button>
        </form>
        </div>
      </section>
    </main>
  `;
}

function renderJoinSetup() {
  return `
    <main class="setup-screen">
      <section class="window setup-card compact">
        <div class="titlebar"><span>JoinRoom.wnd</span>${renderWindowControl()}</div>
        <div class="window-body">
        <p class="eyebrow">Join room</p>
        <h1>Enter the room code.</h1>
        <form id="joinForm" class="form-stack">
          <label>
            Room code
            <input name="code" required maxlength="4" autocomplete="off" placeholder="X7K2" />
          </label>
          ${renderNameField("name", "Player name", "Guest")}
          ${renderWalletRequirement()}
          <button class="primary-btn" type="button" data-submit-setup="joinForm">${state.loading ? "Joining..." : "Join Room"}</button>
        </form>
        </div>
      </section>
    </main>
  `;
}

function renderLobby() {
  const room = state.room;
  if (!room) return renderEmptyRoute("No active room", "Create or join a room first.");

  const isHost = room.hostId === store.playerId;
  const pack = getActivePack(room.settings.packId);

  return `
    <main class="lobby-screen">
      <section class="window lobby-card">
        <div class="titlebar"><span>Lobby: ${escapeHtml(room.code)}</span>${renderWindowControl()}</div>
        <div class="window-body lobby-layout">
        <div>
          <p class="eyebrow">${room.settings.soloMode ? "Solo run" : "Waiting room"}</p>
          <h1>${escapeHtml(pack?.title || "BlackBox Room")}</h1>
          <p>${escapeHtml(pack?.intro || "The case is ready.")}</p>
          <dl class="settings-list">
            <div><dt>Rounds</dt><dd>${room.settings.rounds}</dd></div>
            <div><dt>Timer</dt><dd>${room.settings.roundTimeSec}s</dd></div>
            <div><dt>Mode</dt><dd>${room.settings.soloMode ? "Solo + bots" : "Multiplayer"}</dd></div>
            ${room.stake?.enabled ? `<div><dt>Stake</dt><dd>${escapeHtml(room.stake.amount)} 0G</dd></div>` : ""}
          </dl>
        </div>
        <div>
        ${room.settings.soloMode ? "" : `<div class="join-code"><span>Room Code</span><strong>${escapeHtml(room.code)}</strong></div>`}
        <div class="player-list">
          ${room.players.map((player) => `<span>${escapeHtml(player.name)}${player.bot ? " <em>BOT</em>" : ""}${room.stake?.enabled ? ` <em>${player.stakeConfirmed ? "STAKED" : "PENDING"}</em>` : ""} <b>${player.score}</b></span>`).join("")}
        </div>
        ${room.stake?.enabled && !room.players.find((player) => player.id === store.playerId)?.stakeConfirmed ? `<button class="primary-btn" type="button" data-deposit-stake>Deposit ${escapeHtml(room.stake.amount)} 0G Stake</button>` : ""}
        ${isHost ? `<button class="primary-btn" type="button" data-start-round>Start Match</button>` : `<p class="muted">Waiting for the host to start the match.</p>`}
        </div>
        </div>
      </section>
    </main>
  `;
}

function renderGame() {
  const room = state.room;
  const round = room?.currentRound;
  if (!room || !round) return renderEmptyRoute("No active round", "Start a case from the home screen.");

  const now = Date.now();
  const total = round.timerSec || 60;
  const left = room.phase === "PLAYING" ? Math.max(0, Math.ceil((round.endsAt - now) / 1000)) : 0;
  const progress = Math.max(0, Math.min(100, (left / total) * 100));
  const me = room.players.find((player) => player.id === store.playerId);
  const guessed = Boolean(me?.hasGuessed);
  const result = round.result;
  const revealed = room.phase === "REVEAL" || room.phase === "GAME_OVER";
  const currentClue = round.clues[0];
  const clueKey = `${round.index}:${round.currentClueIndex ?? 0}:${formatCluePayload(currentClue?.payload || "")}`;
  const clueText = formatCluePayload(currentClue?.payload || "Case opens in a moment.");
  state.pendingClue = { key: clueKey, text: clueText };

  if (room.phase === "GAME_OVER") return renderGameOver(room);

  const windowTitle = room.settings.soloMode ? "BLACKBOX.EXE - SOLO RUN" : `BLACKBOX.EXE - ${room.code}`;

  return `
    <main class="game-screen">
      <section class="window game-window">
        <div class="titlebar"><span>${escapeHtml(windowTitle)}</span>${renderWindowControl()}</div>
        <div class="window-body game-scene">
        <div class="game-header">
          <div>
            <p class="eyebrow">Case ${round.index} / ${room.settings.rounds}</p>
            <h1>${escapeHtml(round.title)}</h1>
          </div>
          <div class="timer-paper">
            <span class="timer-label" data-ends-at="${round.endsAt || ""}" data-total="${total}" data-phase="${room.phase}">${getTimerLabel(room, left)}</span>
            <div class="timer-track" style="--progress:${progress}%"><i></i></div>
          </div>
        </div>
        <div class="case-status">${escapeHtml(round.status || "SEALED")}</div>
        <div class="masked-word">${renderMaskedWord(round, revealed ? result.answer.toUpperCase() : round.maskedAnswer, revealed)}</div>
        ${renderClueSlideshow(currentClue, round.currentClueIndex || 0, clueKey, clueText)}
        <div class="guess-panel">
          ${room.phase === "STARTING" ? renderCountdown(round) : room.phase === "PLAYING" ? renderGuessForm(guessed) : renderReveal(result, round.zeroG)}
        </div>
        <div class="score-paper">
          <span>${room.settings.soloMode ? "Solo score" : "Players"}</span>
          <strong>${room.players.map((player) => `${escapeHtml(player.name)} ${player.score}`).join(" / ")}</strong>
        </div>
        </div>
      </section>
    </main>
  `;
}

function renderClueSlideshow(clue, index, clueKey, clueText) {
  const displayText = state.activeClueKey === clueKey ? state.clueDisplayText : state.clueDisplayText || clueText;
  return `
    <div class="clue-grid">
      <article class="window clue-panel ${clue?.type === "emoji" ? "emoji-clue" : ""}">
        <div class="titlebar"><span>Clue ${index + 1}</span>${renderWindowControl()}</div>
        <div class="window-body">
          <span>${escapeHtml(clue?.type || "text")}</span>
          <div class="terminal-clue">
            <p class="clue-copy" data-clue-key="${escapeHtml(clueKey)}">${escapeHtml(displayText)}</p>
          </div>
        </div>
      </article>
    </div>
  `;
}

function renderMaskedWord(round, value, revealed = false) {
  const active = !revealed && state.highlightRoundIndex === round.index
    ? new Set(state.highlightedLetterIndices)
    : new Set();
  return [...String(value || "")].map((character, index) => {
    const className = active.has(index) ? "letter-cell newly-revealed" : "letter-cell";
    return `<span class="${className}" data-letter-index="${index}">${escapeHtml(character)}</span>`;
  }).join("");
}

function renderPacksPage() {
  return `
    <main class="packs-screen">
      <section class="section-heading">
        <p class="eyebrow">Case library</p>
        <h1>Choose a sealed case.</h1>
      </section>
      <section class="pack-grid">
        ${state.packs.map((pack) => `
          <article class="window pack-card">
            <div class="titlebar"><span>${escapeHtml(pack.modeId)}</span></div>
            <div class="window-body">
            <span>${escapeHtml(pack.modeId)}</span>
            <h2>${escapeHtml(pack.title)}</h2>
            <p>${escapeHtml(pack.intro)}</p>
            <button class="secondary-btn" type="button" data-pack-id="${escapeHtml(pack.id)}">Use Pack</button>
            </div>
          </article>
        `).join("")}
      </section>
    </main>
  `;
}

function renderGuessForm(guessed) {
  if (guessed) return `<div class="locked-note">Guess locked. Waiting for reveal.</div>`;
  return `
    <form id="guessForm" class="guess-form">
      <input name="guess" required autocomplete="off" placeholder="Type your guess" aria-label="Guess" />
      <button class="primary-btn" type="button" data-submit-guess>Guess</button>
    </form>
  `;
}

function renderCountdown(round) {
  const seconds = Math.max(0, Math.ceil(((round.startsAt || Date.now()) - Date.now()) / 1000));
  return `<div class="locked-note">Round boots in ${seconds}s...</div>`;
}

function renderReveal(result, zeroG) {
  const scores = [...(result?.scores || [])].sort((a, b) => b.score - a.score);
  const isFinal = result?.nextAction === "GAME_OVER";
  return `
    <div class="reveal-card">
      <strong>${result?.timedOut ? "Time expired" : "Round complete"}</strong>
      <span>Answer: ${escapeHtml(result?.answer || "")}</span>
      <span>${result?.solvers?.length ? `${result.solvers.length} player(s) cracked it.` : "Nobody cracked the box."}</span>
      <div class="score-list">
        ${scores.map((score, index) => `<span>${index + 1}. ${escapeHtml(score.name)} <b>${score.score}</b></span>`).join("")}
      </div>
      ${renderProofPanel(zeroG)}
      ${isFinal ? "" : state.room?.settings?.soloMode ? `<button class="secondary-btn" type="button" data-start-round>Next Round</button>` : `<span class="auto-next">Next round starts in 2 seconds...</span>`}
    </div>
  `;
}

function renderGameOver(room) {
  const scores = [...room.players].sort((a, b) => b.score - a.score);
  return `
    <main class="game-screen">
      <section class="window game-over-window">
        <div class="titlebar"><span>GameOver.wnd</span>${renderWindowControl()}</div>
        <div class="window-body">
          <p class="eyebrow">Final standings</p>
          <h1>${escapeHtml(room.winner?.name || scores[0]?.name || "No winner")} cracked the box.</h1>
          <h2 class="leaderboard-title">Leaderboard</h2>
          <div class="score-list final">
            ${scores.map((score, index) => `<span>${index + 1}. ${escapeHtml(score.name)} <b>${score.score}</b></span>`).join("")}
          </div>
          ${room.stake?.enabled ? renderSettlement(room.stake) : ""}
          ${room.stake?.enabled ? `<button class="primary-btn" type="button" data-claim-escrow>Claim Prize</button>` : ""}
          <button class="primary-btn" data-route="home">Back to Desktop</button>
        </div>
      </section>
    </main>
  `;
}

function renderNameField(name, label, placeholder) {
  const value = getDraftValue(name);
  return `
    <label>
      ${label}
      <input name="${name}" required autocomplete="off" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(value)}" />
    </label>
  `;
}

function renderPackSelect() {
  const selectedPackId = getDraftValue("packId", state.selectedPackId || state.packs[0]?.id || "__random__");
  return `
    <label>
      Story pack
      <select name="packId">
        <option value="__random__" ${selectedPackId === "__random__" ? "selected" : ""}>Random testing pack</option>
        ${state.packs.map((pack) => `<option value="${escapeHtml(pack.id)}" ${pack.id === selectedPackId ? "selected" : ""}>${escapeHtml(pack.title)}</option>`).join("")}
      </select>
    </label>
  `;
}

function renderTimerSelect() {
  const roundTimeSec = getDraftValue("roundTimeSec", "60");
  return `
    <label>
      Round time
      <select name="roundTimeSec">
        <option value="45" ${roundTimeSec === "45" ? "selected" : ""}>45 seconds</option>
        <option value="60" ${roundTimeSec === "60" ? "selected" : ""}>60 seconds</option>
        <option value="75" ${roundTimeSec === "75" ? "selected" : ""}>75 seconds</option>
      </select>
    </label>
  `;
}

function renderStakeField() {
  const value = getDraftValue("stakeAmount", "0.005");
  return `
    <label>
      Entry stake per player
      <input name="stakeAmount" type="number" min="0.0001" step="0.0001" value="${escapeHtml(value)}" ${state.chain?.stakingEnabled ? "" : "disabled"} />
      <small>${state.chain?.stakingEnabled ? "Held by the BlackBox escrow contract on Galileo." : "Escrow is not deployed yet; configure BLACKBOX_ESCROW_ADDRESS."}</small>
    </label>
  `;
}

function renderWalletRequirement() {
  return `<p class="wallet-requirement">${store.profile.walletAddress ? `Wallet: ${escapeHtml(shortAddress(store.profile.walletAddress))}` : "Generate a 0G test wallet from the home screen before entering multiplayer."}</p>`;
}

function renderSettlement(stake) {
  if (stake.settlement?.error) return `<p class="error-copy">Settlement pending: ${escapeHtml(stake.settlement.error)}</p>`;
  if (!stake.settlement?.txHash) return `<p class="muted">Prize settlement is being submitted to 0G.</p>`;
  return `<a class="proof-link" href="${escapeHtml(stake.settlement.explorerUrl)}" target="_blank" rel="noreferrer">View Prize Settlement</a>`;
}

function getDraftValue(name, fallback = "") {
  const formId = state.route === "host" ? "hostForm" : state.route === "join" ? "joinForm" : "soloForm";
  return state.formDrafts[formId]?.[name] ?? fallback;
}

function renderEmptyRoute(title, body) {
  return `
    <main class="setup-screen">
      <section class="window setup-card compact">
        <div class="titlebar"><span>Message.wnd</span>${renderWindowControl()}</div>
        <div class="window-body">
        <p class="eyebrow">BlackBox</p>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(body)}</p>
        <button class="primary-btn" data-route="home">Back Home</button>
        </div>
      </section>
    </main>
  `;
}

async function handleClick(event) {
  const button = event.target.closest?.("button");
  if (!button) {
    if (event.target.closest?.("input, select, textarea, option, label")) return;
    return;
  }

  audio.unlock().catch(() => {});
  audio.cue("click");

  if (button.hasAttribute("data-toggle-music")) {
    audio.toggleMusic();
    render(true);
    return;
  }

  if (button.hasAttribute("data-toggle-effects")) {
    audio.toggleEffects();
    render(true);
    return;
  }

  if (button.hasAttribute("data-exit")) {
    await exitBlackBox();
    return;
  }

  if (button.hasAttribute("data-enter-home")) {
    navigate("home");
    return;
  }

  if (button.hasAttribute("data-generate-wallet")) {
    await generateWalletProfile();
    return;
  }

  if (button.hasAttribute("data-refresh-balance")) {
    await refreshWalletBalance();
    return;
  }

  if (button.hasAttribute("data-fund-wallet")) {
    await fundWallet();
    return;
  }

  if (button.hasAttribute("data-deposit-stake")) {
    await depositStake();
    return;
  }

  if (button.hasAttribute("data-claim-escrow")) {
    await claimEscrow();
    return;
  }

  if (button.hasAttribute("data-toggle-wallet-secret")) {
    state.showWalletSecret = !state.showWalletSecret;
    render(true);
    return;
  }

  if (button.dataset.copyProof) {
    await copyText(button.dataset.copyProof);
    return;
  }

  if (button.dataset.submitSetup) {
    await submitSetupForm(button.dataset.submitSetup);
    return;
  }

  if (button.hasAttribute("data-submit-guess")) {
    await submitGuessForm();
    return;
  }

  if (button.dataset.packId) {
    state.selectedPackId = button.dataset.packId;
    navigate("solo");
    return;
  }

  if (button.hasAttribute("data-solo-now")) {
    await startSoloRun({ name: "Solo Player", packId: state.selectedPackId, roundTimeSec: 60 });
    return;
  }

  if (button.hasAttribute("data-start-round")) {
    await startRound();
    return;
  }

  if (button.dataset.route) {
    navigate(button.dataset.route);
  }
}

async function generateWalletProfile() {
  if (store.profile.walletAddress) return;
  await withLoading(async () => {
    const ethers = await loadEthers();
    const wallet = ethers.Wallet.createRandom();
    saveProfile({
      walletAddress: wallet.address,
      walletPrivateKey: wallet.privateKey,
      walletMnemonic: wallet.mnemonic?.phrase || "",
      balance: "0",
      walletCreatedAt: new Date().toISOString()
    });
    setNotice("0G test wallet generated.");
    if (state.chain?.sponsoredFundingEnabled) await fundWallet();
    else await refreshWalletBalance(false).catch(() => {});
  });
}

async function loadEthers() {
  if (window.ethers?.Wallet) return window.ethers;
  await new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-ethers-vendor]');
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "./vendor/ethers.umd.min.js";
    script.async = true;
    script.dataset.ethersVendor = "true";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Unable to load local wallet library."));
    document.head.appendChild(script);
  });
  if (!window.ethers?.Wallet) throw new Error("Wallet library loaded without Wallet support.");
  return window.ethers;
}

async function copyText(value) {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    setNotice("Copied.");
  } catch {
    setError("Clipboard copy failed.");
  }
}

function shortAddress(value) {
  const text = String(value || "");
  return text.length > 14 ? `${text.slice(0, 6)}...${text.slice(-4)}` : text;
}
async function submitGuessForm() {
  const form = document.getElementById("guessForm");
  if (!form) return;

  const guess = new FormData(form).get("guess");
  await submitGuess(guess);
  form.reset();
}

async function submitSetupForm(formId) {
  const form = document.getElementById(formId);
  if (!form) return;

  const body = Object.fromEntries(new FormData(form));
  if (formId === "soloForm") {
    await startSoloRun(body);
    return;
  }
  if (formId === "hostForm") {
    await createRoom(body);
    return;
  }
  if (formId === "joinForm") {
    await joinRoom(body);
  }
}

function handleFieldEdit(event) {
  const field = event.target;
  if (!field?.matches?.("input[name], select[name]")) return;

  const form = field.closest("form");
  if (!form?.id || !state.formDrafts[form.id]) return;

  state.formDrafts[form.id][field.name] = field.value;
  if (field.name === "packId") state.selectedPackId = field.value;
}

function handleControlPointer(event) {
  const field = event.target.closest("input, select, textarea");
  if (!field) return;

  field.dataset.userEditing = "true";
  window.clearTimeout(field._blackboxEditingTimer);
  field._blackboxEditingTimer = window.setTimeout(() => {
    delete field.dataset.userEditing;
  }, 1200);
}

async function handleSubmit(event) {
  if (event.target.matches("#soloForm")) {
    event.preventDefault();
    await startSoloRun(Object.fromEntries(new FormData(event.target)));
    return;
  }

  if (event.target.matches("#hostForm")) {
    event.preventDefault();
    await createRoom(Object.fromEntries(new FormData(event.target)));
    return;
  }

  if (event.target.matches("#joinForm")) {
    event.preventDefault();
    await joinRoom(Object.fromEntries(new FormData(event.target)));
    return;
  }

  if (event.target.matches("#guessForm")) {
    event.preventDefault();
    await submitGuess(new FormData(event.target).get("guess"));
    event.target.reset();
  }
}

async function startSoloRun(body) {
  await withLoading(async () => {
    const result = await api("/api/solo-runs", { method: "POST", body });
    setActiveRoom(result);
    navigate("game");
  });
}

async function createRoom(body) {
  if (!requireMultiplayerWallet()) return;
  await withLoading(async () => {
    const result = await api("/api/rooms", { method: "POST", body: { ...body, walletAddress: store.profile.walletAddress, soloMode: false } });
    setActiveRoom(result);
    setNotice(`Room ${result.room.code} created.`);
    navigate("lobby");
  });
}

async function joinRoom(body) {
  if (!requireMultiplayerWallet()) return;
  await withLoading(async () => {
    const result = await api(`/api/rooms/${String(body.code).toUpperCase()}/join`, { method: "POST", body: { name: body.name, walletAddress: store.profile.walletAddress } });
    setActiveRoom(result);
    navigate(result.room.phase === "LOBBY" ? "lobby" : "game");
  });
}

function requireMultiplayerWallet() {
  if (!store.profile.walletAddress || !store.profile.walletPrivateKey) {
    setError("Generate a 0G test wallet before entering multiplayer.");
    return false;
  }
  return true;
}

async function refreshWalletBalance(showNotice = true) {
  if (!store.profile.walletAddress) return;
  const balance = await api(`/api/chain/balance/${store.profile.walletAddress}`);
  saveProfile({ balance: balance.balance });
  if (showNotice) setNotice(`Balance: ${balance.balance} 0G`);
  else render();
}

async function fundWallet() {
  if (!store.profile.walletAddress) return;
  await withLoading(async () => {
    const result = await api("/api/chain/fund", { method: "POST", body: { address: store.profile.walletAddress } });
    saveProfile({ fundingTxHash: result.txHash });
    await refreshWalletBalance(false);
    setNotice(`${result.amount} 0G welcome gas received.`);
  });
}

async function depositStake() {
  if (!state.room?.stake?.enabled) return;
  if (!requireMultiplayerWallet()) return;
  await withLoading(async () => {
    const ethers = await loadEthers();
    const provider = createGalileoProvider(ethers);
    const wallet = new ethers.Wallet(store.profile.walletPrivateKey, provider);
    const authorization = await api(`/api/rooms/${state.room.code}/stake-authorization`, {
      method: "POST",
      body: { playerId: store.playerId }
    });
    const abi = ["function joinMatch(bytes32 matchId,uint256 stake,bytes authorization) payable"];
    const contract = new ethers.Contract(state.chain.escrowAddress, abi, wallet);
    const amount = BigInt(state.room.stake.amountWei);
    const tx = await contract.joinMatch(state.room.stake.matchId, amount, authorization.signature, { value: amount });
    await waitForGalileoReceipt(provider, tx.hash);
    state.room = await api(`/api/rooms/${state.room.code}/stake`, {
      method: "POST",
      body: { playerId: store.playerId, txHash: tx.hash }
    });
    saveProfile({ lastStakeMatchId: state.room.stake.matchId });
    await refreshWalletBalance(false);
    setNotice("Stake confirmed on 0G.");
  });
}

async function claimEscrow() {
  const matchId = state.room?.stake?.matchId || store.profile.lastStakeMatchId;
  if (!matchId || !state.chain?.escrowAddress) return setError("No escrow match is available to claim.");
  if (!requireMultiplayerWallet()) return;
  await withLoading(async () => {
    const ethers = await loadEthers();
    const provider = createGalileoProvider(ethers);
    const wallet = new ethers.Wallet(store.profile.walletPrivateKey, provider);
    const abi = [
      "function claimable(bytes32 matchId,address player) view returns (uint256)",
      "function claim(bytes32 matchId)",
      "function claimRefund(bytes32 matchId)"
    ];
    const contract = new ethers.Contract(state.chain.escrowAddress, abi, wallet);
    const prize = await contract.claimable(matchId, wallet.address);
    let tx;
    if (prize > 0n) tx = await contract.claim(matchId);
    else tx = await contract.claimRefund(matchId);
    await waitForGalileoReceipt(provider, tx.hash);
    await refreshWalletBalance(false);
    setNotice("Escrow funds claimed.");
  });
}

async function waitForGalileoReceipt(provider, txHash, timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      if (receipt) {
        if (receipt.status !== 1) throw new Error("Transaction reverted.");
        return receipt;
      }
    } catch (error) {
      if (!String(error.message).includes("no matching receipts found")) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error("Timed out waiting for Galileo transaction confirmation.");
}

function createGalileoProvider(ethers) {
  return new ethers.JsonRpcProvider(
    state.chain.rpcUrl,
    { chainId: state.chain.chainId, name: "0g-galileo" },
    { staticNetwork: true }
  );
}

async function exitBlackBox() {
  if (state.room && ["lobby", "game"].includes(state.route)) {
    const activeStaked = state.room.stake?.enabled && state.room.phase !== "LOBBY" && state.room.phase !== "GAME_OVER";
    if (activeStaked && !window.confirm("Leaving an active staked match forfeits participation. Exit anyway?")) return;
    await api(`/api/rooms/${state.room.code}/leave`, { method: "POST", body: { playerId: store.playerId } }).catch(() => {});
    if (store.events) store.events.close();
    store.events = null;
    state.room = null;
  }
  navigate("landing");
}

async function startRound() {
  if (!state.room) return;
  await withLoading(async () => {
    const room = await api(`/api/rooms/${state.room.code}/start`, { method: "POST", body: { playerId: store.playerId } });
    state.room = room;
    navigate("game");
  });
}

async function submitGuess(text) {
  if (!state.room) return;
  await withLoading(async () => {
    const result = await api(`/api/rooms/${state.room.code}/guess`, {
      method: "POST",
      body: { playerId: store.playerId, text }
    });
    state.room = result.room;
    audio.cue(result.correct ? "correct" : "wrong");
    setNotice(result.correct ? `Correct. ${result.points} points.` : "Guess locked.");
    render();
  });
}

function setActiveRoom(result) {
  state.room = result.room;
  state.activeClueKey = "";
  state.clueDisplayText = "";
  state.clueTargetText = "";
  state.pendingClue = null;
  lastRefreshAt = 0;
  refreshInFlight = false;
  if (clueTick) clearInterval(clueTick);
  clueTick = null;
  setPlayerId(result.playerId || store.playerId);
  if (store.events) store.events.close();
  store.events = openRoomStream(state.room.code, (room) => {
    trackRoomEffects(state.room, room);
    state.room = room;
    if (["STARTING", "PLAYING", "REVEAL", "GAME_OVER"].includes(room.phase)) state.route = "game";
    renderOrPatchGame(room);
  });
}

async function withLoading(action) {
  state.loading = true;
  state.error = "";
  render();
  try {
    await action();
  } catch (error) {
    setError(error.message);
  } finally {
    state.loading = false;
    render();
  }
}

function navigate(route) {
  window.location.hash = route;
  state.route = route;
  render(true);
}

function getActivePack(packId) {
  return state.packs.find((pack) => pack.id === packId);
}

function setNotice(message) {
  state.notice = message;
  state.error = "";
  render();
  setTimeout(() => {
    state.notice = "";
    render();
  }, 2000);
}

function setError(message) {
  state.error = message;
  state.notice = "";
  render();
  setTimeout(() => {
    state.error = "";
    render();
  }, 2000);
}

function syncGameTick() {
  const shouldTick = state.route === "game" && ["STARTING", "PLAYING"].includes(state.room?.phase);
  if (shouldTick && !gameTick) {
    gameTick = setInterval(updateTimerDom, 1000);
  }
  if (shouldTick && !roomSyncTick) {
    roomSyncTick = setInterval(syncRoomMilestones, 1000);
  }
  if (!shouldTick && gameTick) {
    clearInterval(gameTick);
    gameTick = null;
  }
  if (!shouldTick && roomSyncTick) {
    clearInterval(roomSyncTick);
    roomSyncTick = null;
  }
}

function updateTimerDom() {
  const round = state.room?.currentRound;
  if (!round || !["STARTING", "PLAYING"].includes(state.room?.phase)) {
    syncGameTick();
    return;
  }

  if (state.room.phase === "STARTING") {
    const startsIn = Math.max(0, Math.ceil(((round.startsAt || Date.now()) - Date.now()) / 1000));
    const label = document.querySelector(".locked-note");
    const timer = document.querySelector(".timer-label");
    if (label) label.textContent = `Round boots in ${startsIn}s...`;
    if (timer) timer.textContent = startsIn ? `Booting ${startsIn}s` : "Starting...";
    if (startsIn > 0 && startsIn <= 3 && startsIn !== lastCountdownCue) {
      lastCountdownCue = startsIn;
      audio.cue("countdown");
    }
    if (startsIn <= 0) refreshRoom();
    return;
  }

  const left = Math.max(0, Math.ceil((round.endsAt - Date.now()) / 1000));
  lastCountdownCue = null;
  const total = round.timerSec || 60;
  const progress = Math.max(0, Math.min(100, (left / total) * 100));
  const label = document.querySelector(".timer-label");
  const track = document.querySelector(".timer-track");
  if (label) label.textContent = `${left}s left`;
  if (track) track.style.setProperty("--progress", `${progress}%`);
  if (left <= 0) refreshRoom();
}

function syncRoomMilestones() {
  const round = state.room?.currentRound;
  if (!round) return;

  const now = Date.now();
  if (state.room.phase === "STARTING" && round.startsAt && now >= round.startsAt + 150) {
    refreshRoom();
    return;
  }

  if (state.room.phase !== "PLAYING") return;

  const dueClue = round.nextClueAt && now >= round.nextClueAt + 150;
  const dueLetter = round.nextLetterAt && now >= round.nextLetterAt + 150;
  const periodicSafetySync = now - lastRefreshAt > 5000;
  if (dueClue || dueLetter || periodicSafetySync) refreshRoom();
}

function syncClueAnimation() {
  const pending = state.pendingClue;
  const output = document.querySelector("[data-clue-key]");
  if (!pending || !output) return;

  if (state.activeClueKey === pending.key && state.clueTargetText === pending.text) {
    output.textContent = state.clueDisplayText || pending.text;
    return;
  }

  if (clueTick) clearInterval(clueTick);
  const previous = state.clueDisplayText || output.textContent || "";
  state.activeClueKey = pending.key;
  state.clueTargetText = pending.text;

  if (!previous || previous === pending.text) {
    state.clueDisplayText = pending.text;
    output.textContent = pending.text;
    return;
  }

  let phase = "delete";
  let cursor = previous.length;
  let typed = 0;
  output.textContent = previous;

  clueTick = setInterval(() => {
    const currentOutput = document.querySelector("[data-clue-key]");
    if (!currentOutput) return;

    if (phase === "delete") {
      cursor = Math.max(0, cursor - 2);
      state.clueDisplayText = previous.slice(0, cursor);
      currentOutput.textContent = state.clueDisplayText;
      if (cursor === 0) phase = "type";
      return;
    }

    typed = Math.min(state.clueTargetText.length, typed + 2);
    state.clueDisplayText = state.clueTargetText.slice(0, typed);
    currentOutput.textContent = state.clueDisplayText;
    if (typed >= state.clueTargetText.length) {
      clearInterval(clueTick);
      clueTick = null;
    }
  }, 35);
}

function getTimerLabel(room, left) {
  if (room.phase === "STARTING") return "Booting...";
  if (room.phase === "GAME_OVER") return "Game over";
  if (room.phase !== "REVEAL") return `${left}s left`;
  return room.currentRound?.result?.timedOut ? "Time expired" : "Round revealed";
}

function formatCluePayload(payload) {
  if (Array.isArray(payload)) return payload.join(" / ");
  return payload;
}

async function refreshRoom() {
  if (!state.room?.code || state.loading || refreshInFlight || Date.now() - lastRefreshAt < 750) return;
  refreshInFlight = true;
  lastRefreshAt = Date.now();
  try {
    const room = await api(`/api/rooms/${state.room.code}`);
    trackRoomEffects(state.room, room);
    state.room = room;
    renderOrPatchGame(room);
  } catch {
    // SSE is still the primary sync path; polling is only a small recovery net.
  } finally {
    refreshInFlight = false;
  }
}

function renderOrPatchGame(room) {
  if (shouldPatchPlayingRoom(room)) {
    patchPlayingRoom(room);
    return;
  }
  render();
}

function shouldPatchPlayingRoom(room) {
  return state.route === "game" && room?.phase === "PLAYING" && document.activeElement?.matches?.("#guessForm input");
}

function patchPlayingRoom(room) {
  const round = room.currentRound;
  if (!round) return;

  const masked = document.querySelector(".masked-word");
  if (masked) masked.innerHTML = renderMaskedWord(round, round.maskedAnswer);

  const score = document.querySelector(".score-paper strong");
  if (score) score.textContent = room.players.map((player) => `${player.name} ${player.score}`).join(" / ");

  const currentClue = round.clues[0];
  const clueText = formatCluePayload(currentClue?.payload || "Case opens in a moment.");
  const clueKey = `${round.index}:${round.currentClueIndex ?? 0}:${clueText}`;
  state.pendingClue = { key: clueKey, text: clueText };

  const clueTitle = document.querySelector(".clue-panel .titlebar span");
  if (clueTitle) clueTitle.textContent = `Clue ${(round.currentClueIndex || 0) + 1}`;

  const clueType = document.querySelector(".clue-panel .window-body > span");
  if (clueType) clueType.textContent = currentClue?.type || "text";

  syncClueAnimation();
}

function trackRoomEffects(previousRoom, nextRoom) {
  const previousRound = previousRoom?.currentRound;
  const nextRound = nextRoom?.currentRound;
  if (!nextRound) return;

  if (!previousRound || previousRound.index !== nextRound.index) {
    state.highlightedLetterIndices = [];
    state.highlightRoundIndex = nextRound.index;
    audio.cue("boot");
    return;
  }

  if (nextRound.currentClueIndex > (previousRound.currentClueIndex ?? 0)) audio.cue("clue");

  if (nextRound.revealedLetterCount > (previousRound.revealedLetterCount || 0)) {
    state.highlightRoundIndex = nextRound.index;
    state.highlightedLetterIndices = nextRound.latestRevealIndices || [];
    audio.cue("reveal");
    window.clearTimeout(highlightTimer);
    highlightTimer = window.setTimeout(() => {
      state.highlightedLetterIndices = [];
      if (state.route === "game") {
        const masked = document.querySelector(".masked-word");
        if (masked && state.room?.currentRound) {
          masked.innerHTML = renderMaskedWord(state.room.currentRound, state.room.currentRound.maskedAnswer);
        }
      }
    }, 1800);
  }

  if (previousRoom.phase !== nextRoom.phase && nextRoom.phase === "REVEAL") audio.cue("roundEnd");
  if (previousRoom.phase !== nextRoom.phase && nextRoom.phase === "GAME_OVER") audio.cue("gameOver");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
