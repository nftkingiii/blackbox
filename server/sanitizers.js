export function sanitizeRoom(room) {
  const { usedAnswers, ...safeRoom } = room;
  return {
    ...safeRoom,
    players: room.players.map(sanitizePlayer),
    currentRound: room.currentRound ? sanitizeRound(room.currentRound) : null
  };
}

export function sanitizeRound(round) {
  const { answer, mask, botPlan, allClues, guesses, result, ...safeRound } = round;
  return {
    ...safeRound,
    guesses: result ? guesses : guesses.map(({ playerId, playerName, bot, timeLeft }) => ({ playerId, playerName, bot, timeLeft })),
    result
  };
}

function sanitizePlayer(player) {
  const { skill, ...safePlayer } = player;
  return safePlayer;
}
