import { randomUUID } from "node:crypto";
import { PHASES } from "../shared/events.js";
import { ethers } from "ethers";
import { matchIdForCode } from "./chainService.js";

const BOT_NAMES = ["Mara", "Theo", "Priya", "Dex", "Nova", "Quinn", "Sol", "Ivy"];

export class RoomManager {
  constructor({ modeRegistry }) {
    this.modeRegistry = modeRegistry;
    this.rooms = new Map();
  }

  createRoom({ name = "Host", packId, roundTimeSec = 60, soloMode = false, walletAddress = "", stakeAmount = "0" }) {
    const player = this.createPlayer(name, walletAddress);
    const code = this.createRoomCode();
    const players = [player];
    if (soloMode) players.push(...this.createBots(3));
    const amountWei = soloMode ? 0n : parseStake(stakeAmount);

    const room = {
      code,
      hostId: player.id,
      settings: {
        packId: packId || this.modeRegistry.listPublicPacks()[0]?.id,
        roundTimeSec: Number(roundTimeSec || 60),
        rounds: 20,
        soloMode: Boolean(soloMode)
      },
      players,
      phase: PHASES.LOBBY,
      currentRoundIndex: 0,
      currentRound: null,
      usedPackIds: [],
      usedAnswers: [],
      roundHistory: [],
      winner: null,
      stake: {
        enabled: !soloMode && amountWei > 0n,
        amount: ethers.formatEther(amountWei),
        amountWei: amountWei.toString(),
        matchId: matchIdForCode(code),
        settlement: null,
        cancellation: null,
        lock: null
      },
      createdAt: new Date().toISOString()
    };
    this.rooms.set(code, room);
    return { room, playerId: player.id };
  }

  joinRoom(code, name = "Player", walletAddress = "") {
    const room = this.getRoom(code);
    if (!room) return null;
    if (room.settings.soloMode) {
      const error = new Error("This is a solo room.");
      error.status = 403;
      throw error;
    }
    if (room.phase !== PHASES.LOBBY) {
      const error = new Error("This match has already started.");
      error.status = 409;
      throw error;
    }
    if (walletAddress && room.players.some((player) => player.walletAddress?.toLowerCase() === walletAddress.toLowerCase())) {
      const error = new Error("This wallet is already in the room.");
      error.status = 409;
      throw error;
    }
    const player = this.createPlayer(name, walletAddress);
    room.players.push(player);
    return { room, playerId: player.id };
  }

  getRoom(code) {
    return this.rooms.get(String(code || "").toUpperCase());
  }

  createPlayer(name, walletAddress = "") {
    return {
      id: randomUUID(),
      name: String(name).slice(0, 24),
      score: 0,
      hasGuessed: false,
      bot: false,
      walletAddress: ethers.isAddress(walletAddress) ? ethers.getAddress(walletAddress) : "",
      stakeConfirmed: false,
      stakeTxHash: "",
      connected: true
    };
  }

  createBots(count) {
    return BOT_NAMES.slice(0, count).map((name, index) => ({
      id: `bot-${randomUUID()}`,
      name,
      score: 0,
      hasGuessed: false,
      bot: true,
      skill: 0.45 + index * 0.12
    }));
  }

  createRoomCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    do {
      code = Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
    } while (this.rooms.has(code));
    return code;
  }

  leaveRoom(room, playerId) {
    const player = room?.players.find((item) => item.id === playerId);
    if (!player) return null;
    player.connected = false;
    player.hasGuessed = true;
    if (room.phase === PHASES.LOBBY) room.players = room.players.filter((item) => item.id !== playerId);
    return player;
  }
}

function parseStake(value) {
  try {
    const amount = ethers.parseEther(String(value || "0"));
    if (amount < 0n) throw new Error("negative");
    return amount;
  } catch {
    const error = new Error("Invalid 0G stake amount.");
    error.status = 400;
    throw error;
  }
}
