export const CLIENT_EVENTS = {
  CREATE_ROOM: "create_room",
  JOIN_ROOM: "join_room",
  UPDATE_SETTINGS: "update_settings",
  START_GAME: "start_game",
  SUBMIT_GUESS: "submit_guess"
};

export const SERVER_EVENTS = {
  ROOM_UPDATE: "room_update",
  ROUND_START: "round_start",
  CLUE_REVEAL: "clue_reveal",
  TIMER_TICK: "timer_tick",
  GUESS_RESULT: "guess_result",
  ROUND_REVEAL: "round_reveal",
  GAME_OVER: "game_over",
  ERROR: "error"
};

export const PHASES = {
  LOBBY: "LOBBY",
  STARTING: "STARTING",
  PLAYING: "PLAYING",
  REVEAL: "REVEAL",
  SCORING: "SCORING",
  ROUND_END: "ROUND_END",
  GAME_OVER: "GAME_OVER"
};
