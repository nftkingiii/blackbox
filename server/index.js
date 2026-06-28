import "./env.js";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { ModeRegistry } from "./ModeRegistry.js";
import { RoomManager } from "./RoomManager.js";
import { RoundEngine } from "./RoundEngine.js";
import { sanitizeRoom } from "./sanitizers.js";
import {
  cancelRoomStake,
  authorizeStake,
  getChainConfig,
  getWalletBalance,
  sponsorWallet,
  lockRoomStake,
  verifyStake
} from "./chainService.js";
import { getStorageStatus, initializeStoryManifest } from "./zeroGStorage.js";

const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 3000);
const clientRoot = fileURLToPath(new URL("../client/", import.meta.url));
const streams = new Map();
const modeRegistry = new ModeRegistry();
const roomManager = new RoomManager({ modeRegistry });
const roundEngine = new RoundEngine({ modeRegistry, onUpdate: broadcast });
const storyManifestReady = initializeStoryManifest(modeRegistry.storyPacks);
storyManifestReady.catch(() => {});

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jsx": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host}`);

    if (url.pathname === "/api/health") return json(response, { ok: true, name: "BlackBox", chain: getChainConfig(), storage: getStorageStatus() });
    if (url.pathname === "/api/chain/config" && request.method === "GET") return json(response, getChainConfig());
    if (url.pathname.match(/^\/api\/chain\/balance\/0x[0-9a-fA-F]{40}$/) && request.method === "GET") return json(response, await getWalletBalance(url.pathname.split("/").pop()));
    if (url.pathname === "/api/chain/fund" && request.method === "POST") return handleFundWallet(request, response);
    if (url.pathname === "/api/story-packs" && request.method === "GET") {
      await storyManifestReady;
      return json(response, modeRegistry.listPublicPacks());
    }
    if (url.pathname === "/api/solo-runs" && request.method === "POST") return handleCreateSoloRun(request, response);
    if (url.pathname === "/api/rooms" && request.method === "POST") return handleCreateRoom(request, response);
    if (url.pathname.match(/^\/api\/rooms\/[^/]+\/events$/) && request.method === "GET") return handleEvents(url, response);
    if (url.pathname.match(/^\/api\/rooms\/[^/]+\/join$/) && request.method === "POST") return handleJoinRoom(url, request, response);
    if (url.pathname.match(/^\/api\/rooms\/[^/]+\/start$/) && request.method === "POST") return handleStartRound(url, request, response);
    if (url.pathname.match(/^\/api\/rooms\/[^/]+\/guess$/) && request.method === "POST") return handleGuess(url, request, response);
    if (url.pathname.match(/^\/api\/rooms\/[^/]+\/stake$/) && request.method === "POST") return handleStake(url, request, response);
    if (url.pathname.match(/^\/api\/rooms\/[^/]+\/stake-authorization$/) && request.method === "POST") return handleStakeAuthorization(url, request, response);
    if (url.pathname.match(/^\/api\/rooms\/[^/]+\/leave$/) && request.method === "POST") return handleLeave(url, request, response);
    if (url.pathname.startsWith("/api/rooms/") && request.method === "GET") return handleGetRoom(url, response);

    return serveStatic(url, response);
  } catch (error) {
    console.error(error);
    json(response, { error: error.message || "Something went wrong." }, error.status || 500);
  }
});

server.listen(port, host, () => {
  const displayHost = host === "0.0.0.0" ? "127.0.0.1" : host;
  console.log(`BlackBox running on http://${displayHost}:${port}`);
});

async function handleCreateRoom(request, response) {
  await storyManifestReady;
  const body = await readJson(request);
  if (Number(body.stakeAmount || 0) > 0 && !getChainConfig().stakingEnabled) {
    return json(response, { error: "Staked rooms are unavailable until the escrow contract and operator are configured." }, 503);
  }
  const result = roomManager.createRoom(body);
  json(response, { room: sanitizeRoom(result.room), playerId: result.playerId });
}

async function handleCreateSoloRun(request, response) {
  await storyManifestReady;
  const body = await readJson(request);
  const result = roomManager.createRoom({ ...body, soloMode: true });
  roundEngine.startRound(result.room);
  json(response, { room: sanitizeRoom(result.room), playerId: result.playerId });
}

async function handleGetRoom(url, response) {
  const room = getRoomFromUrl(url);
  if (!room) return json(response, { error: "Room not found." }, 404);
  await roundEngine.reconcile(room);
  json(response, sanitizeRoom(room));
}

async function handleJoinRoom(url, request, response) {
  const body = await readJson(request);
  try {
    const result = roomManager.joinRoom(url.pathname.split("/")[3], body.name || "Player", body.walletAddress);
    if (!result) return json(response, { error: "Room not found." }, 404);
    broadcast(result.room.code);
    json(response, { room: sanitizeRoom(result.room), playerId: result.playerId });
  } catch (error) {
    json(response, { error: error.message }, error.status || 400);
  }
}

async function handleStartRound(url, request, response) {
  await storyManifestReady;
  const room = getRoomFromUrl(url);
  if (!room) return json(response, { error: "Room not found." }, 404);
  await roundEngine.reconcile(room);
  const body = await readJson(request);
  if (body.playerId !== room.hostId) return json(response, { error: "Only the host can start rounds." }, 403);
  if (!room.settings.soloMode && room.players.filter((player) => !player.bot && player.connected !== false).length < 2) {
    return json(response, { error: "At least two connected players are required." }, 409);
  }
  if (room.stake?.enabled && room.players.some((player) => !player.bot && !player.stakeConfirmed)) {
    return json(response, { error: "Every player must confirm the room stake before the match starts." }, 409);
  }
  if (room.stake?.enabled && !room.stake.lock?.txHash) {
    room.stake.lock = await lockRoomStake(room);
  }
  roundEngine.startRound(room);
  json(response, sanitizeRoom(room));
}

async function handleFundWallet(request, response) {
  const body = await readJson(request);
  json(response, await sponsorWallet(body.address, request.socket.remoteAddress || ""));
}

async function handleStake(url, request, response) {
  const room = getRoomFromUrl(url);
  if (!room) return json(response, { error: "Room not found." }, 404);
  const body = await readJson(request);
  const player = room.players.find((item) => item.id === body.playerId);
  if (!player?.walletAddress) return json(response, { error: "Player wallet is missing." }, 400);
  const stake = await verifyStake({ room, player, txHash: body.txHash });
  player.stakeConfirmed = true;
  player.stakeTxHash = stake.txHash;
  broadcast(room.code);
  json(response, sanitizeRoom(room));
}

async function handleStakeAuthorization(url, request, response) {
  const room = getRoomFromUrl(url);
  if (!room) return json(response, { error: "Room not found." }, 404);
  const body = await readJson(request);
  const player = room.players.find((item) => item.id === body.playerId);
  if (!player) return json(response, { error: "Player not found." }, 404);
  json(response, await authorizeStake({ room, player }));
}

async function handleLeave(url, request, response) {
  const room = getRoomFromUrl(url);
  if (!room) return json(response, { ok: true });
  const body = await readJson(request);
  const wasHost = room.hostId === body.playerId;
  roomManager.leaveRoom(room, body.playerId);
  if (wasHost && room.phase === "LOBBY") {
    if (room.stake?.enabled) {
      room.stake.cancellation = await cancelRoomStake(room).catch((error) => ({ error: error.message }));
    }
    room.cancelled = true;
    room.phase = "GAME_OVER";
  }
  broadcast(room.code);
  json(response, { ok: true, room: sanitizeRoom(room) });
}

async function handleGuess(url, request, response) {
  const room = getRoomFromUrl(url);
  const body = await readJson(request);
  try {
    const result = await roundEngine.submitGuess(room, body.playerId, body.text);
    json(response, { correct: result.correct, points: result.points, room: sanitizeRoom(result.room) });
  } catch (error) {
    json(response, { error: error.message }, error.status || 400);
  }
}

async function handleEvents(url, response) {
  const room = getRoomFromUrl(url);
  if (!room) return json(response, { error: "Room not found." }, 404);
  await roundEngine.reconcile(room);

  response.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });
  response.write(`data: ${JSON.stringify(sanitizeRoom(room))}\n\n`);

  const list = streams.get(room.code) || new Set();
  list.add(response);
  streams.set(room.code, list);
  response.on("close", () => list.delete(response));
}

function broadcast(code) {
  const room = roomManager.getRoom(code);
  const list = streams.get(code);
  if (!room || !list) return;
  const payload = `data: ${JSON.stringify(sanitizeRoom(room))}\n\n`;
  for (const response of list) response.write(payload);
}

function getRoomFromUrl(url) {
  return roomManager.getRoom(url.pathname.split("/")[3]);
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

function json(response, body, status = 200) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function serveStatic(url, response) {
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = normalize(join(clientRoot, requested));
  if (!filePath.startsWith(normalize(clientRoot))) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mime[extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
      Expires: "0"
    });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}
