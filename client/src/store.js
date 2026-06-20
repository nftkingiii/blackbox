export const store = {
  packs: [],
  room: null,
  playerId: localStorage.getItem("blackbox:playerId") || "",
  events: null
};

export function setPlayerId(playerId) {
  store.playerId = playerId;
  localStorage.setItem("blackbox:playerId", playerId);
}
