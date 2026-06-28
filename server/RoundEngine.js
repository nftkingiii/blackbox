import { PHASES } from "../shared/events.js";
import { saveRoundProof } from "./zeroGStorage.js";
import { settleRoomStake } from "./chainService.js";

const SYMBOLS = ["@", "#", "$", "%", "&", "+", "*", "!", ")", "("];
const VOWELS = "aeiou";
const COUNTDOWN_MS = 3000;
const CLUE_INTERVAL_SEC = 20;
const LETTER_REVEAL_INTERVAL_SEC = 20;
const MULTIPLAYER_TRANSITION_MS = 2000;

export class RoundEngine {
  constructor({ modeRegistry, onUpdate }) {
    this.modeRegistry = modeRegistry;
    this.onUpdate = onUpdate;
    this.timers = new Map();
  }

  startRound(room) {
    if (!room) throw httpError("Room not found.", 404);
    if (room.phase === PHASES.PLAYING || room.phase === PHASES.STARTING) {
      throw httpError("A round is already running.", 400);
    }

    if (room.currentRoundIndex >= room.settings.rounds) {
      this.finishGame(room);
      return room;
    }

    const pack = this.modeRegistry.getPackForRoom(room);
    room.usedPackIds.push(pack.id);
    room.usedAnswers.push(normalize(pack.answer));
    room.currentRoundIndex += 1;
    room.currentRound = this.createRound({ ...pack, timerSec: room.settings.roundTimeSec || pack.timerSec }, room.currentRoundIndex);
    room.phase = PHASES.STARTING;
    room.players.forEach((player) => {
      player.hasGuessed = player.connected === false;
    });

    this.scheduleCountdown(room);
    this.onUpdate(room.code);
    return room;
  }

  async submitGuess(room, playerId, text) {
    if (!room?.currentRound) throw httpError("No active round.", 404);
    if (room.phase !== PHASES.PLAYING) throw httpError("Round is not accepting guesses.", 400);

    const player = room.players.find((item) => item.id === playerId);
    if (!player) throw httpError("Player not found.", 404);
    if (player.hasGuessed) throw httpError("You already guessed this round.", 400);

    const result = await this.recordGuess(room, player, text);
    if (room.players.every((item) => item.hasGuessed)) await this.revealRound(room, { reason: "all-guessed" });
    this.onUpdate(room.code);
    return { ...result, room };
  }

  async reconcile(room) {
    if (!room?.currentRound) return room;

    if (room.phase === PHASES.STARTING) {
      if (Date.now() >= room.currentRound.startsAt) {
        this.beginPlaying(room);
      } else if (!this.timers.has(room.code)) {
        this.scheduleCountdown(room);
      }
      return room;
    }

    if (room.phase !== PHASES.PLAYING) return room;

    const timeLeft = this.updateRoundReveal(room.currentRound);
    await this.runBotGuesses(room, timeLeft);

    if (room.players.every((item) => item.hasGuessed)) {
      await this.revealRound(room, { reason: "all-guessed" });
      return room;
    }

    if (timeLeft <= 0) {
      await this.revealRound(room, { reason: "timer" });
      return room;
    }

    if (!this.timers.has(room.code)) this.scheduleRound(room);
    return room;
  }

  createRound(pack, index) {
    const now = Date.now();
    const timerSec = Number(pack.timerSec || 60);
    const mask = buildMask(pack.answer, pack.maskStyle, `${pack.id}:${index}`);
    const round = {
      index,
      packId: pack.id,
      modeId: pack.modeId,
      title: pack.title,
      intro: pack.intro,
      speaker: pack.speaker || pack.creator || "BlackBox",
      answer: pack.answer,
      maskedAnswer: maskState(mask, 0),
      clues: [],
      allClues: pack.clues || [],
      currentClueIndex: 0,
      clueIntervalSec: CLUE_INTERVAL_SEC,
      letterRevealIntervalSec: LETTER_REVEAL_INTERVAL_SEC,
      revealedLetterCount: 0,
      revealedIndices: [...mask.forced],
      latestRevealIndices: [],
      latestRevealAt: null,
      nextClueAt: null,
      nextLetterAt: null,
      guesses: [],
      botPlan: {},
      startedAt: null,
      startsAt: now + COUNTDOWN_MS,
      endsAt: null,
      timerSec,
      result: null,
      zeroG: null,
      status: "SEALED",
      mask
    };

    round.clues = this.visibleClues(round, timerSec);
    return round;
  }

  beginPlaying(room) {
    if (!room.currentRound || room.phase !== PHASES.STARTING) return;
    const now = Date.now();
    room.phase = PHASES.PLAYING;
    room.currentRound.startedAt = now;
    room.currentRound.endsAt = now + room.currentRound.timerSec * 1000;
    room.currentRound.botPlan = this.planBots(room.players, room.currentRound.timerSec);
    this.updateRoundReveal(room.currentRound);
    this.scheduleRound(room);
    this.onUpdate(room.code);
  }

  updateRoundReveal(round) {
    const timeLeft = this.getTimeLeft(round);
    const ratio = round.timerSec ? 1 - timeLeft / round.timerSec : 1;
    round.status = ratio > 0.72 ? "CRACKING" : "SEALED";
    const previousRevealCount = round.revealedLetterCount;
    round.revealedLetterCount = letterRevealCount(timeLeft, round.timerSec);
    round.revealedIndices = [
      ...round.mask.forced,
      ...round.mask.revealOrder.slice(0, round.revealedLetterCount)
    ];
    if (round.revealedLetterCount > previousRevealCount) {
      round.latestRevealIndices = round.mask.revealOrder.slice(previousRevealCount, round.revealedLetterCount);
      round.latestRevealAt = Date.now();
    }
    round.maskedAnswer = maskState(round.mask, round.revealedLetterCount);
    round.clues = this.visibleClues(round, timeLeft);
    this.updateMilestones(round, timeLeft);
    return timeLeft;
  }

  visibleClues(round, timeLeft) {
    const total = round.allClues.length;
    if (!total) return [];
    const elapsed = round.timerSec - timeLeft;
    const index = Math.min(total - 1, Math.floor(elapsed / CLUE_INTERVAL_SEC));
    round.currentClueIndex = index;
    return [round.allClues[index]];
  }

  updateMilestones(round, timeLeft) {
    if (!round.startedAt || !round.endsAt) return;
    const nextClueIndex = round.currentClueIndex + 1;
    const nextClueOffset = nextClueIndex * CLUE_INTERVAL_SEC * 1000;
    round.nextClueAt = nextClueIndex < round.allClues.length ? round.startedAt + nextClueOffset : null;

    const nextLetterOffset = (round.revealedLetterCount + 1) * LETTER_REVEAL_INTERVAL_SEC * 1000;
    const nextLetterAt = round.startedAt + nextLetterOffset;
    round.nextLetterAt = nextLetterAt < round.endsAt && timeLeft > 0 ? nextLetterAt : null;
  }

  async revealRound(room, { reason = "manual" } = {}) {
    if (!room.currentRound || room.phase !== PHASES.PLAYING) return;
    this.clearTimer(room.code);
    const revealedRound = room.currentRound;
    room.phase = PHASES.REVEAL;
    revealedRound.status = "CRACKED";
    revealedRound.maskedAnswer = revealedRound.answer;

    const solvers = revealedRound.guesses.filter((guess) => guess.correct);
    const scores = this.getScores(room);
    const isFinalRound = revealedRound.index >= room.settings.rounds;
    revealedRound.result = {
      roundIndex: revealedRound.index,
      totalRounds: room.settings.rounds,
      answer: revealedRound.answer,
      reason,
      timedOut: reason === "timer",
      solvers,
      guesses: revealedRound.guesses,
      scores,
      nextAction: isFinalRound ? "GAME_OVER" : "NEXT_ROUND"
    };

    if (isFinalRound) {
      room.phase = PHASES.GAME_OVER;
      room.winner = scores[0] || null;
      revealedRound.result.nextAction = "COMPLETE";
    }

    this.onUpdate(room.code);

    saveRoundProof({
      roomCode: room.code,
      round: revealedRound.index,
      packId: revealedRound.packId,
      answer: revealedRound.answer,
      reason,
      solvers,
      guesses: revealedRound.guesses,
      scores
    }).then((proof) => {
      revealedRound.zeroG = proof;
      if (revealedRound.result) revealedRound.result.zeroGProof = proof;
      if (isFinalRound && room.stake?.enabled) {
        settleRoomStake(room, proof.rootHash).then((settlement) => {
          room.stake.settlement = settlement;
          this.onUpdate(room.code);
        }).catch((error) => {
          room.stake.settlement = { error: error.message || "Prize settlement failed." };
          this.onUpdate(room.code);
        });
      }
      this.onUpdate(room.code);
    }).catch((error) => {
      revealedRound.zeroG = {
        provider: "0g-storage",
        error: error.message || "0G proof upload failed"
      };
      if (revealedRound.result) revealedRound.result.zeroGProof = revealedRound.zeroG;
      this.onUpdate(room.code);
    });

    room.roundHistory.push(revealedRound.result);

    if (!isFinalRound && !room.settings.soloMode) {
      this.scheduleNextRound(room);
    }
  }

  finishGame(room) {
    this.clearTimer(room.code);
    room.phase = PHASES.GAME_OVER;
    room.winner = this.getScores(room)[0] || null;
    if (room.currentRound?.result) room.currentRound.result.nextAction = "COMPLETE";
    this.onUpdate(room.code);
  }

  scoreGuess(timeLeft, timerSec) {
    return Math.max(0, Math.floor((timeLeft / timerSec) * 1000));
  }

  scheduleCountdown(room) {
    this.clearTimer(room.code);
    const timeout = setTimeout(() => this.beginPlaying(room), COUNTDOWN_MS);
    this.timers.set(room.code, timeout);
  }

  scheduleRound(room) {
    this.clearTimer(room.code);
    const tick = setInterval(async () => {
      if (!room.currentRound || room.phase !== PHASES.PLAYING) {
        this.clearTimer(room.code);
        return;
      }
      const timeLeft = this.updateRoundReveal(room.currentRound);
      await this.runBotGuesses(room, timeLeft);
      if (room.players.every((item) => item.hasGuessed)) {
        await this.revealRound(room, { reason: "all-guessed" });
        this.onUpdate(room.code);
        return;
      }
      if (timeLeft <= 0) {
        await this.revealRound(room, { reason: "timer" });
        this.onUpdate(room.code);
        return;
      }
      this.onUpdate(room.code);
    }, 1000);
    this.timers.set(room.code, tick);
  }

  scheduleNextRound(room) {
    this.clearTimer(room.code);
    const timeout = setTimeout(() => {
      if (room.phase !== PHASES.REVEAL) return;
      this.startRound(room);
    }, MULTIPLAYER_TRANSITION_MS);
    this.timers.set(room.code, timeout);
  }

  clearTimer(code) {
    const timer = this.timers.get(code);
    if (!timer) return;
    clearTimeout(timer);
    clearInterval(timer);
    this.timers.delete(code);
  }

  async runBotGuesses(room, timeLeft) {
    if (!room.settings.soloMode) return;
    const elapsed = room.currentRound.timerSec - timeLeft;
    const bots = room.players.filter((player) => player.bot && !player.hasGuessed);
    for (const bot of bots) {
      const plan = room.currentRound.botPlan[bot.id];
      if (!plan || plan.done || elapsed < plan.at) continue;
      plan.done = true;
      const guess = plan.correct ? room.currentRound.answer : this.botMiss(room.currentRound.answer);
      await this.recordGuess(room, bot, guess);
    }
  }

  async recordGuess(room, player, text) {
    const pack = this.modeRegistry.getPack(room.currentRound.packId);
    const mode = this.modeRegistry.getMode(pack.modeId);
    const timeLeft = this.updateRoundReveal(room.currentRound);
    const correct = mode.checkGuess(text || "", room.currentRound.answer);
    const points = correct ? this.scoreGuess(timeLeft, room.currentRound.timerSec) : 0;

    player.score += points;
    player.hasGuessed = true;
    const guess = {
      playerId: player.id,
      playerName: player.name,
      bot: Boolean(player.bot),
      text,
      correct,
      points,
      timeLeft
    };
    room.currentRound.guesses.push(guess);
    return { correct, points, guess };
  }

  planBots(players, roundTime) {
    const plan = {};
    players.filter((player) => player.bot).forEach((player) => {
      plan[player.id] = {
        at: Math.round(roundTime * (0.24 + Math.random() * 0.56)),
        correct: Math.random() < Number(player.skill || 0.64),
        done: false
      };
    });
    return plan;
  }

  botMiss(answer) {
    const misses = ["shadow", "wallet", "signal", "memory", "locked", "vanish"];
    return misses.find((miss) => normalize(miss) !== normalize(answer)) || "unknown";
  }

  getTimeLeft(round) {
    if (!round.endsAt) return round.timerSec;
    return Math.max(0, Math.ceil((round.endsAt - Date.now()) / 1000));
  }

  getScores(room) {
    return room.players
      .map(({ id, name, score, bot }) => ({ id, name, score, bot: Boolean(bot) }))
      .sort((a, b) => b.score - a.score);
  }
}

function buildMask(answer, style = "symbol-heavy", seed = answer) {
  const letters = String(answer).split("");
  const symbols = letters.map((char, index) => (isMaskable(char) ? SYMBOLS[hash(`${answer}:${index}`, SYMBOLS.length)] : char));
  const maskable = letters.map((_, index) => index).filter((index) => isMaskable(letters[index]));
  const forced = new Set();

  if (style === "soft" && maskable.length) {
    forced.add(maskable[0]);
    const vowelIndex = maskable.find((index) => VOWELS.includes(letters[index].toLowerCase()));
    if (vowelIndex != null) forced.add(vowelIndex);
  }

  if (style === "caps-symbol" && maskable.length) forced.add(maskable[maskable.length - 1]);

  const revealOrder = stableShuffle(maskable.filter((index) => !forced.has(index)), seed);
  if (revealOrder.length > 1 && revealOrder[0] === maskable[0]) revealOrder.push(revealOrder.shift());
  return { letters, symbols, forced: [...forced], revealOrder };
}

function maskState(mask, revealCount) {
  const count = Math.max(0, Math.min(mask.revealOrder.length, Number(revealCount || 0)));
  const visible = new Set(mask.forced);
  for (let index = 0; index < count; index += 1) visible.add(mask.revealOrder[index]);

  return mask.letters
    .map((char, index) => {
      if (!isMaskable(char)) return char;
      return visible.has(index) ? char : mask.symbols[index];
    })
    .join("");
}

function letterRevealCount(timeLeft, roundTime) {
  if (!roundTime) return 0;
  const elapsed = Math.max(0, roundTime - timeLeft);
  return Math.floor(elapsed / LETTER_REVEAL_INTERVAL_SEC);
}

function stableShuffle(values, seed) {
  return values
    .map((value) => ({ value, weight: hash(`${seed}:${value}`, 100000) }))
    .sort((a, b) => a.weight - b.weight)
    .map((item) => item.value);
}

function hash(seed, max) {
  let value = 0;
  for (const char of String(seed)) value = (value * 31 + char.charCodeAt(0)) % 2147483647;
  return value % max;
}

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isMaskable(char) {
  return /[a-z0-9]/i.test(char);
}

function httpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}
