import { seedPhraseMode } from "./modes/seedPhrase.js";
import { rugCoinMode } from "./modes/rugCoin.js";
import { wrongNumberMode } from "./modes/wrongNumber.js";
import { exactMatch, maskWord } from "./modes/baseMode.js";

const builderMode = {
  id: "builderStory",
  title: "Builder Story",
  intro: "A custom builder-created mystery.",
  maskAnswer(answer, revealRatio) {
    return maskWord(answer, "symbol-heavy", revealRatio);
  },
  checkGuess: exactMatch,
  packs: []
};

const aiMode = {
  ...builderMode,
  id: "blackBoxOriginal",
  title: "AI Original"
};

export class ModeRegistry {
  constructor() {
    this.modes = new Map([seedPhraseMode, rugCoinMode, wrongNumberMode, builderMode, aiMode].map((mode) => [mode.id, mode]));
    this.storyPacks = [...this.modes.values()].flatMap((mode) => mode.packs || []);
  }

  listPublicPacks() {
    return this.storyPacks.map((pack) => this.publicPack(pack));
  }

  getPack(packId) {
    return this.storyPacks.find((pack) => pack.id === packId) || this.storyPacks[0];
  }

  getPackForRound(packId, roundIndex = 0) {
    if (packId !== "__random__") return this.getPack(packId);
    const index = Math.max(0, Number(roundIndex || 0)) % this.storyPacks.length;
    return this.storyPacks[index] || this.storyPacks[0];
  }

  getPackForRoom(room) {
    const packId = room.settings.packId;
    if (packId !== "__random__") {
      const selected = this.getPack(packId);
      if (!room.currentRoundIndex) return selected;

      const freshModePack = this.findFreshPack({
        packs: this.storyPacks.filter((pack) => pack.modeId === selected.modeId),
        usedPackIds: room.usedPackIds,
        usedAnswers: room.usedAnswers
      });
      return freshModePack || selected;
    }

    const fresh = this.findFreshPack({
      packs: this.storyPacks,
      usedPackIds: room.usedPackIds,
      usedAnswers: room.usedAnswers
    });
    if (fresh) return fresh;

    const index = Math.max(0, Number(room.currentRoundIndex || 0)) % this.storyPacks.length;
    return this.storyPacks[index] || this.storyPacks[0];
  }

  findFreshPack({ packs, usedPackIds = [], usedAnswers = [] }) {
    const usedIds = new Set(usedPackIds || []);
    const usedAnswerSet = new Set(usedAnswers || []);
    const available = packs.filter((pack) => !usedIds.has(pack.id) && !usedAnswerSet.has(normalizeAnswer(pack.answer)));
    return available[Math.floor(Math.random() * available.length)];
  }

  getMode(modeId) {
    return this.modes.get(modeId) || builderMode;
  }

  addPack(pack) {
    this.storyPacks.unshift(pack);
    return pack;
  }

  createBuilderPack(body) {
    return {
      id: `builder-${Date.now().toString(36)}`,
      modeId: body.modeId || "builderStory",
      title: body.title,
      creator: body.creator || "Builder",
      intro: body.intro,
      answer: body.answer,
      answerType: body.answerType || "custom",
      maskStyle: body.maskStyle || "symbol-heavy",
      timerSec: Number(body.timerSec || 60),
      difficulty: body.difficulty || "medium",
      tags: splitTags(body.tags),
      clues: [
        { at: 0.95, type: "clue", payload: body.clue1 },
        { at: 0.66, type: "clue", payload: body.clue2 },
        { at: 0.33, type: "clue", payload: body.clue3 }
      ].filter((clue) => clue.payload)
    };
  }

  createAiAssistedPack({ theme, modeId = "blackBoxOriginal", creator = "Builder" }) {
    const cleanTheme = (theme || "mystery").trim();
    const answer = pickAnswer(cleanTheme);
    return {
      id: `builder-${Date.now().toString(36)}`,
      modeId,
      title: `The ${titleCase(cleanTheme)} Box`,
      creator,
      intro: `A sealed black box appears with a story built around ${cleanTheme}. Crack the hidden answer before the timer expires.`,
      answer,
      answerType: "mystery answer",
      maskStyle: "symbol-heavy",
      timerSec: 60,
      difficulty: "medium",
      tags: ["ai-assisted", cleanTheme.toLowerCase()],
      clues: [
        { at: 0.95, type: "story", payload: `The first clue points toward ${cleanTheme}, but hides the answer in plain sight.` },
        { at: 0.66, type: "association", payload: `The answer is connected to: ${relatedHint(answer)}.` },
        { at: 0.33, type: "hint", payload: `It starts with ${answer[0].toUpperCase()} and has ${answer.length} letters.` }
      ]
    };
  }

  publicPack(pack) {
    const { answer, ...safe } = pack;
    return safe;
  }
}

function splitTags(value = "") {
  return String(value).split(",").map((tag) => tag.trim()).filter(Boolean);
}

function pickAnswer(theme) {
  const table = [
    ["crypto", "wallet"],
    ["love", "memory"],
    ["horror", "shadow"],
    ["school", "teacher"],
    ["music", "chorus"],
    ["space", "signal"],
    ["crime", "dagger"],
    ["food", "pepper"]
  ];
  const hit = table.find(([key]) => theme.toLowerCase().includes(key));
  return hit ? hit[1] : "secret";
}

function relatedHint(answer) {
  const hints = {
    wallet: "keys, funds, and recovery phrases",
    memory: "old photos and things people cannot forget",
    shadow: "dark rooms and something following close behind",
    teacher: "classrooms, chalkboards, and tests",
    chorus: "songs, hooks, and the part everyone remembers",
    signal: "messages crossing empty space",
    dagger: "evidence, betrayal, and a missing weapon",
    pepper: "kitchens, spice, and a sneeze waiting to happen",
    secret: "something known by one person and hidden from everyone else"
  };
  return hints[answer] || "the central story clue";
}

function titleCase(value) {
  return value.replace(/\w\S*/g, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase());
}

function normalizeAnswer(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
