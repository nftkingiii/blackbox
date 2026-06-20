import { maskWord, normalize } from "./baseMode.js";

export const rugCoinMode = {
  id: "rugCoin",
  title: "Ticker Trap",
  intro: "A market feed is full of fake token launches. Guess the ticker before the chart collapses.",
  maskAnswer(answer, revealRatio) {
    return maskWord(answer, "caps-symbol", revealRatio);
  },
  checkGuess(guess, answer) {
    return normalize(guess).replace(/^\$/, "") === normalize(answer).replace(/^\$/, "");
  },
  packs: [
    {
      id: "ticker-glitch",
      modeId: "rugCoin",
      title: "The Frozen Mint",
      creator: "BlackBox",
      intro: "A mint button kept working after trading was secretly disabled. Guess the ticker.",
      answer: "GLITCH",
      answerType: "ticker",
      maskStyle: "caps-symbol",
      timerSec: 60,
      difficulty: "medium",
      tags: ["crypto", "ticker", "market"],
      clues: [
        { at: 1, type: "feed", payload: "The chart candles duplicate, skip, and freeze every few seconds." },
        { at: 0.66, type: "logo", payload: "Logo note: a broken cursor trapped inside a cracked coin." },
        { at: 0.33, type: "hint", payload: "The name means a sudden technical error. Six letters." }
      ],
      zeroG: { uri: "0g://blackbox/seed/ticker-glitch" }
    },
    {
      id: "ticker-vaultbug",
      modeId: "rugCoin",
      title: "The Safe That Bit Back",
      creator: "BlackBox",
      intro: "A vault-themed token promised security, then the withdraw button vanished.",
      answer: "VAULTBUG",
      answerType: "ticker",
      maskStyle: "caps-symbol",
      timerSec: 60,
      difficulty: "hard",
      tags: ["crypto", "ticker", "vault"],
      clues: [
        { at: 1, type: "feed", payload: "Audit note: the lock icon turns green even when the door is open." },
        { at: 0.66, type: "logo", payload: "Logo note: a steel safe with insect legs crawling out." },
        { at: 0.33, type: "hint", payload: "Two words joined: a secure box plus a software defect. Eight letters." }
      ],
      zeroG: { uri: "0g://blackbox/seed/ticker-vaultbug" }
    },
    {
      id: "ticker-dustpay",
      modeId: "rugCoin",
      title: "The Micro-Payment Mirage",
      creator: "BlackBox",
      intro: "Tiny rewards appeared every minute, but no one could cash out the balance.",
      answer: "DUSTPAY",
      answerType: "ticker",
      maskStyle: "caps-symbol",
      timerSec: 60,
      difficulty: "medium",
      tags: ["crypto", "ticker", "payments"],
      clues: [
        { at: 1, type: "feed", payload: "The dashboard shows thousands of tiny credits that cost more to move than they are worth." },
        { at: 0.66, type: "logo", payload: "Logo note: a coin dissolving into specks beside a checkout button." },
        { at: 0.33, type: "hint", payload: "A small useless amount plus a word for sending money. Seven letters." }
      ],
      zeroG: { uri: "0g://blackbox/seed/ticker-dustpay" }
    },
    {
      id: "ticker-pixelmint",
      modeId: "rugCoin",
      title: "The Eight-Bit Mint",
      creator: "BlackBox",
      intro: "A retro NFT coin sold out instantly. The reveal image was just a blank square.",
      answer: "PIXELMINT",
      answerType: "ticker",
      maskStyle: "caps-symbol",
      timerSec: 60,
      difficulty: "hard",
      tags: ["crypto", "ticker", "retro"],
      clues: [
        { at: 1, type: "feed", payload: "Every preview is a tiny blocky square with a fake rarity label." },
        { at: 0.66, type: "logo", payload: "Logo note: an 8-bit printer stamping coins from a glowing screen." },
        { at: 0.33, type: "hint", payload: "A screen dot plus the word for creating new tokens. Nine letters." }
      ],
      zeroG: { uri: "0g://blackbox/seed/ticker-pixelmint" }
    }
  ]
};
