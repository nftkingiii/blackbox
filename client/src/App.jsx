import { api, openRoomStream } from "./socket.js";
import { setPlayerId, store } from "./store.js";

const app = document.querySelector("#app");

const state = {
  route: "home",
  packs: [],
  selectedPackId: "",
  room: null,
  notice: "",
  error: "",
  loading: false,
  activeClueKey: "",
  clueDisplayText: "",
  clueTargetText: "",
  pendingClue: null
};

let gameTick = null;
let clueTick = null;
let roomSyncTick = null;
let refreshInFlight = false;
let lastRefreshAt = 0;

init();

async function init() {
  window.addEventListener("hashchange", syncRoute);
  document.addEventListener("click", handleClick);
  document.addEventListener("submit", handleSubmit);
  syncRoute();
  await loadPacks();
}

function syncRoute() {
  const route = window.location.hash.replace("#", "") || "home";
  state.route = ["home", "solo", "host", "join", "lobby", "game", "packs"].includes(route) ? route : "home";
  render();
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

function render() {
  if (!app) return;
  syncGameTick();
  app.innerHTML = `
    ${renderTopbar()}
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

function renderTopbar() {
  return `
    <header class="topbar">
      <button class="brand-button" data-route="home" aria-label="Go home">
        <span class="brand-mark">BB</span>
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
      </nav>
    </header>
  `;
}

function renderHome() {
  return `
    <main class="home-screen">
      <section class="desktop-grid reveal">
        <div class="window hero-window">
          <div class="titlebar"><span>BlackBox.exe</span><button aria-hidden="true">_</button></div>
          <div class="window-body hero-copy">
          <p class="eyebrow">Mystery OS / Server authoritative</p>
          <h1>Crack the case before the clock locks.</h1>
          <p>
            BlackBox is a backend-first multiplayer mystery engine with solo runs, private rooms,
            server-side answers, timed clues, scoring, and 0G-ready proof records.
          </p>
          <div class="hero-actions">
            <button class="primary-btn" data-solo-now>Solo Play</button>
            <button class="secondary-btn" data-route="host">Host Multiplayer</button>
          </div>
        </div>
        </div>

        <aside class="window case-window" aria-label="Featured story pack">
          <div class="titlebar"><span>Folder: Featured Case</span><button aria-hidden="true">□</button></div>
          <div class="window-body case-box">
            <span class="case-badge">Official Pack</span>
            <h2>The Missing Seed Word</h2>
            <p>A glitchy hacker is missing one recovery phrase word. The wallet locks when time hits zero.</p>
            <div class="case-controls">
              <span>01</span>
              <span>02</span>
              <span>03</span>
            </div>
          </div>
        </aside>
      </section>

      <section class="mode-strip" aria-label="Game modes">
        <article class="window"><div class="titlebar"><span>Solo</span></div><div class="window-body">
          <span>Solo</span>
          <strong>Instant run</strong>
          <p>Start immediately without waiting for another player.</p>
        </div></article>
        <article class="window"><div class="titlebar"><span>Rooms</span></div><div class="window-body">
          <span>Rooms</span>
          <strong>Private code</strong>
          <p>Invite friends and let the server decide every result.</p>
        </div></article>
        <article class="window"><div class="titlebar"><span>Stories</span></div><div class="window-body">
          <span>Stories</span>
          <strong>Code-owned packs</strong>
          <p>Add stories in the backend and ship them as updates.</p>
        </div></article>
      </section>
    </main>
  `;
}

function renderSoloSetup() {
  return `
    <main class="setup-screen">
      <section class="window setup-card">
        <div class="titlebar"><span>SoloPlay.wnd</span><button aria-hidden="true">□</button></div>
        <div class="window-body">
        <p class="eyebrow">Solo run with backend bots</p>
        <h1>Pick a case and start now.</h1>
        <form id="soloForm" class="form-stack">
          ${renderNameField("name", "Player name", "Detective")}
          ${renderPackSelect()}
          ${renderTimerSelect()}
          <button class="primary-btn" type="submit">${state.loading ? "Starting..." : "Start Solo Play"}</button>
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
        <div class="titlebar"><span>CreateRoom.wnd</span><button aria-hidden="true">□</button></div>
        <div class="window-body">
        <p class="eyebrow">Multiplayer</p>
        <h1>Create a private room.</h1>
        <form id="hostForm" class="form-stack">
          ${renderNameField("name", "Host name", "Room Host")}
          ${renderPackSelect()}
          ${renderTimerSelect()}
          <button class="primary-btn" type="submit">${state.loading ? "Creating..." : "Create Room"}</button>
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
        <div class="titlebar"><span>JoinRoom.wnd</span><button aria-hidden="true">□</button></div>
        <div class="window-body">
        <p class="eyebrow">Join room</p>
        <h1>Enter the room code.</h1>
        <form id="joinForm" class="form-stack">
          <label>
            Room code
            <input name="code" required maxlength="4" autocomplete="off" placeholder="X7K2" />
          </label>
          ${renderNameField("name", "Player name", "Guest")}
          <button class="primary-btn" type="submit">${state.loading ? "Joining..." : "Join Room"}</button>
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
        <div class="titlebar"><span>Lobby: ${escapeHtml(room.code)}</span><button aria-hidden="true">□</button></div>
        <div class="window-body lobby-layout">
        <div>
          <p class="eyebrow">${room.settings.soloMode ? "Solo run" : "Waiting room"}</p>
          <h1>${escapeHtml(pack?.title || "BlackBox Room")}</h1>
          <p>${escapeHtml(pack?.intro || "The case is ready.")}</p>
          <dl class="settings-list">
            <div><dt>Rounds</dt><dd>${room.settings.rounds}</dd></div>
            <div><dt>Timer</dt><dd>${room.settings.roundTimeSec}s</dd></div>
            <div><dt>Mode</dt><dd>${room.settings.soloMode ? "Solo + bots" : "Multiplayer"}</dd></div>
          </dl>
        </div>
        <div>
        ${room.settings.soloMode ? "" : `<div class="join-code"><span>Room Code</span><strong>${escapeHtml(room.code)}</strong></div>`}
        <div class="player-list">
          ${room.players.map((player) => `<span>${escapeHtml(player.name)}${player.bot ? " <em>BOT</em>" : ""} <b>${player.score}</b></span>`).join("")}
        </div>
        ${isHost ? `<button class="primary-btn" data-start-round>Start Round</button>` : `<p class="muted">Waiting for the host to start the round.</p>`}
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

  return `
    <main class="game-screen">
      <section class="window game-window">
        <div class="titlebar"><span>BLACKBOX.EXE - ${escapeHtml(room.code)}</span><button aria-hidden="true">_</button></div>
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
        <div class="masked-word">${escapeHtml(revealed ? result.answer.toUpperCase() : round.maskedAnswer)}</div>
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
      <article class="window clue-panel">
        <div class="titlebar"><span>Clue ${index + 1}</span><button aria-hidden="true">_</button></div>
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
            <button class="secondary-btn" data-pack-id="${escapeHtml(pack.id)}">Use Pack</button>
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
      <button class="primary-btn" type="submit">Guess</button>
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
      ${zeroG ? `<small>${escapeHtml(zeroG.uri)}</small>` : ""}
      ${isFinal ? "" : `<button class="secondary-btn" data-start-round>Next Round</button>`}
    </div>
  `;
}

function renderGameOver(room) {
  const scores = [...room.players].sort((a, b) => b.score - a.score);
  return `
    <main class="game-screen">
      <section class="window game-over-window">
        <div class="titlebar"><span>GameOver.wnd</span><button aria-hidden="true">□</button></div>
        <div class="window-body">
          <p class="eyebrow">Final standings</p>
          <h1>${escapeHtml(room.winner?.name || scores[0]?.name || "No winner")} cracked the box.</h1>
          <h2 class="leaderboard-title">Leaderboard</h2>
          <div class="score-list final">
            ${scores.map((score, index) => `<span>${index + 1}. ${escapeHtml(score.name)} <b>${score.score}</b></span>`).join("")}
          </div>
          <button class="primary-btn" data-route="home">Back to Desktop</button>
        </div>
      </section>
    </main>
  `;
}

function renderNameField(name, label, placeholder) {
  return `
    <label>
      ${label}
      <input name="${name}" required autocomplete="off" placeholder="${placeholder}" />
    </label>
  `;
}

function renderPackSelect() {
  return `
    <label>
      Story pack
      <select name="packId">
        <option value="__random__">Random testing pack</option>
        ${state.packs.map((pack) => `<option value="${escapeHtml(pack.id)}" ${pack.id === state.selectedPackId ? "selected" : ""}>${escapeHtml(pack.title)}</option>`).join("")}
      </select>
    </label>
  `;
}

function renderTimerSelect() {
  return `
    <label>
      Round time
      <select name="roundTimeSec">
        <option value="45">45 seconds</option>
        <option value="60" selected>60 seconds</option>
        <option value="75">75 seconds</option>
      </select>
    </label>
  `;
}

function renderEmptyRoute(title, body) {
  return `
    <main class="setup-screen">
      <section class="window setup-card compact">
        <div class="titlebar"><span>Message.wnd</span><button aria-hidden="true">□</button></div>
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
  const routeTarget = event.target.closest("[data-route]");
  if (routeTarget) {
    navigate(routeTarget.dataset.route);
    return;
  }

  const packTarget = event.target.closest("[data-pack-id]");
  if (packTarget) {
    state.selectedPackId = packTarget.dataset.packId;
    navigate("solo");
    return;
  }

  if (event.target.closest("[data-solo-now]")) {
    await startSoloRun({ name: "Solo Player", packId: state.selectedPackId, roundTimeSec: 60 });
    return;
  }

  if (event.target.closest("[data-start-round]")) {
    await startRound();
  }
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
  await withLoading(async () => {
    const result = await api("/api/rooms", { method: "POST", body: { ...body, soloMode: false } });
    setActiveRoom(result);
    setNotice(`Room ${result.room.code} created.`);
    navigate("lobby");
  });
}

async function joinRoom(body) {
  await withLoading(async () => {
    const result = await api(`/api/rooms/${String(body.code).toUpperCase()}/join`, { method: "POST", body: { name: body.name } });
    setActiveRoom(result);
    navigate(result.room.phase === "LOBBY" ? "lobby" : "game");
  });
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
  render();
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
    if (startsIn <= 0) refreshRoom();
    return;
  }

  const left = Math.max(0, Math.ceil((round.endsAt - Date.now()) / 1000));
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
  if (masked) masked.textContent = round.maskedAnswer;

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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
