import { randomUUID } from "node:crypto";
import { PHASES } from "../shared/events.js";

const BOT_NAMES = ["Mara", "Theo", "Priya", "Dex", "Nova", "Quinn", "Sol", "Ivy"];

export class RoomManager {
  constructor({ modeRegistry }) {
    this.modeRegistry = modeRegistry;
    this.rooms = new Map();
  }

  createRoom({ name = "Host", packId, roundTimeSec = 60, soloMode = false }) {
    const player = this.createPlayer(name);
    const code = this.createRoomCode();
    const players = [player];
    if (soloMode) players.push(...this.createBots(3));

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
      createdAt: new Date().toISOString()
    };
    this.rooms.set(code, room);
    return { room, playerId: player.id };
  }

  joinRoom(code, name = "Player") {
    const room = this.getRoom(code);
    if (!room) return null;
    if (room.settings.soloMode) {
      const error = new Error("This is a solo room.");
      error.status = 403;
      throw error;
    }
    const player = this.createPlayer(name);
    room.players.push(player);
    return { room, playerId: player.id };
  }

  getRoom(code) {
    return this.rooms.get(String(code || "").toUpperCase());
  }

  createPlayer(name) {
    return {
      id: randomUUID(),
      name: String(name).slice(0, 24),
      score: 0,
      hasGuessed: false,
      bot: false
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
}
