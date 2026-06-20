import { fuzzyMatch, maskWord } from "./baseMode.js";

export const wrongNumberMode = {
  id: "wrongNumber",
  title: "Misrouted Messages",
  intro: "A stranger is texting the wrong person. Guess who they think you are.",
  maskAnswer(answer, revealRatio) {
    return maskWord(answer, "soft", revealRatio);
  },
  checkGuess: fuzzyMatch,
  packs: [
    {
      id: "wrong-number-tailor",
      modeId: "wrongNumber",
      title: "The Suit Emergency",
      creator: "BlackBox",
      intro: "Someone keeps sending measurements and asking whether the jacket can be saved.",
      answer: "tailor",
      answerType: "role",
      maskStyle: "soft",
      timerSec: 70,
      difficulty: "easy",
      tags: ["texts", "role", "mystery"],
      clues: [
        { at: 1, type: "message", payload: "Message 1: 'The sleeves are still too long and the wedding is tomorrow.'" },
        { at: 0.66, type: "message", payload: "Message 2: 'Can you take in the waist without touching the buttons?'" },
        { at: 0.33, type: "hint", payload: "They think you alter clothes for a living. Six letters." }
      ],
      zeroG: { uri: "0g://blackbox/seed/wrong-number-tailor" }
    },
    {
      id: "wrong-number-curator",
      modeId: "wrongNumber",
      title: "The Missing Exhibit",
      creator: "BlackBox",
      intro: "A museum worker keeps texting you about a display case that should not be empty.",
      answer: "curator",
      answerType: "role",
      maskStyle: "soft",
      timerSec: 70,
      difficulty: "medium",
      tags: ["texts", "museum", "mystery"],
      clues: [
        { at: 1, type: "message", payload: "Message 1: 'The bronze mask is not in gallery three. Did you move it?'" },
        { at: 0.66, type: "message", payload: "Message 2: 'The donor tour starts at noon and the labels still need approval.'" },
        { at: 0.33, type: "hint", payload: "They think you manage museum collections. Seven letters." }
      ],
      zeroG: { uri: "0g://blackbox/seed/wrong-number-curator" }
    },
    {
      id: "wrong-number-barista",
      modeId: "wrongNumber",
      title: "The Morning Rush",
      creator: "BlackBox",
      intro: "A cafe group chat thinks you are late for the opening shift.",
      answer: "barista",
      answerType: "role",
      maskStyle: "soft",
      timerSec: 70,
      difficulty: "easy",
      tags: ["texts", "coffee", "role"],
      clues: [
        { at: 1, type: "message", payload: "Message 1: 'The espresso machine is hissing again. Did you purge it?'" },
        { at: 0.66, type: "message", payload: "Message 2: 'Two oat lattes, one flat white, and the grinder is almost empty.'" },
        { at: 0.33, type: "hint", payload: "They think you make coffee drinks. Seven letters." }
      ],
      zeroG: { uri: "0g://blackbox/seed/wrong-number-barista" }
    },
    {
      id: "wrong-number-mechanic",
      modeId: "wrongNumber",
      title: "The Engine Noise",
      creator: "BlackBox",
      intro: "A driver keeps texting audio clips of a car that sounds worse every hour.",
      answer: "mechanic",
      answerType: "role",
      maskStyle: "soft",
      timerSec: 70,
      difficulty: "medium",
      tags: ["texts", "car", "role"],
      clues: [
        { at: 1, type: "message", payload: "Message 1: 'It rattles when I turn left, but only after the engine warms up.'" },
        { at: 0.66, type: "message", payload: "Message 2: 'Should I bring it back to the garage before the check light flashes again?'" },
        { at: 0.33, type: "hint", payload: "They think you repair cars. Eight letters." }
      ],
      zeroG: { uri: "0g://blackbox/seed/wrong-number-mechanic" }
    }
  ]
};
