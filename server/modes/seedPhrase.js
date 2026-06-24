import { exactMatch, maskWord } from "./baseMode.js";
import { seedPhraseV2Packs } from "./v2Stories.js";

export const seedPhraseMode = {
  id: "seedPhrase",
  title: "Recovery Word",
  intro: "A sealed wallet terminal is missing one recovery word.",
  maskAnswer(answer, revealRatio) {
    return maskWord(answer, "symbol-heavy", revealRatio);
  },
  checkGuess: exactMatch,
  packs: [
    {
      id: "seed-greenhouse",
      modeId: "seedPhrase",
      title: "The Locked Greenhouse",
      creator: "BlackBox",
      intro: "A cold wallet was hidden inside a fruit-farm inventory system. One word was replaced with static.",
      answer: "orchard",
      answerType: "common word",
      maskStyle: "symbol-heavy",
      timerSec: 60,
      difficulty: "medium",
      tags: ["crypto", "recovery", "word"],
      clues: [
        { at: 1, type: "terminal", payload: "The backup note mentions rows of numbered trees behind a locked gate." },
        { at: 0.66, type: "association", payload: "Apples, pears, harvest crates, and a caretaker with soil on their boots." },
        { at: 0.33, type: "hint", payload: "A planted place where fruit trees grow. Seven letters." }
      ],
      zeroG: { uri: "0g://blackbox/seed/seed-greenhouse" }
    },
    {
      id: "seed-velvet",
      modeId: "seedPhrase",
      title: "The Soft-Key Vault",
      creator: "BlackBox",
      intro: "A hardware wallet case opens only when the missing texture-word is restored.",
      answer: "velvet",
      answerType: "common word",
      maskStyle: "symbol-heavy",
      timerSec: 60,
      difficulty: "medium",
      tags: ["crypto", "texture", "word"],
      clues: [
        { at: 1, type: "terminal", payload: "The clue file says the missing word feels expensive under your fingertips." },
        { at: 0.66, type: "association", payload: "The vault lining is soft, dark, and used for jewelry boxes." },
        { at: 0.33, type: "hint", payload: "A smooth fabric with a short thick pile. Six letters." }
      ],
      zeroG: { uri: "0g://blackbox/seed/seed-velvet" }
    },
    {
      id: "seed-copper",
      modeId: "seedPhrase",
      title: "The Metal Ledger",
      creator: "BlackBox",
      intro: "The recovery sheet was etched into metal, but one material name is corrupted.",
      answer: "copper",
      answerType: "common word",
      maskStyle: "symbol-heavy",
      timerSec: 60,
      difficulty: "easy",
      tags: ["crypto", "metal", "word"],
      clues: [
        { at: 1, type: "terminal", payload: "The missing word is the color of old coins and exposed wires." },
        { at: 0.66, type: "association", payload: "Pipes, pennies, circuit traces, and a reddish-brown shine." },
        { at: 0.33, type: "hint", payload: "A conductive metal. Six letters." }
      ],
      zeroG: { uri: "0g://blackbox/seed/seed-copper" }
    },
    {
      id: "seed-harbor",
      modeId: "seedPhrase",
      title: "The Dockside Phrase",
      creator: "BlackBox",
      intro: "A wallet phrase was split across shipping manifests. One safe-place word is missing.",
      answer: "harbor",
      answerType: "common word",
      maskStyle: "symbol-heavy",
      timerSec: 60,
      difficulty: "medium",
      tags: ["crypto", "dock", "word"],
      clues: [
        { at: 1, type: "terminal", payload: "The logs mention boats waiting inside calm protected water." },
        { at: 0.66, type: "association", payload: "Lighthouses, mooring ropes, cargo cranes, and ships away from rough sea." },
        { at: 0.33, type: "hint", payload: "A sheltered place where ships dock. Six letters." }
      ],
      zeroG: { uri: "0g://blackbox/seed/seed-harbor" }
    },
    ...seedPhraseV2Packs
  ]
};
