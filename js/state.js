export const TURN = Object.freeze({
  CAT: "cat",
  DOG: "dog",
});

export const createInitialState = () => ({
  phase: "ui-demo",
  turn: TURN.CAT,
  turnNumber: 1,
  maxTurns: 13,
  activeDog: 1,
  settings: {
    bgmEnabled: true,
    bgmVolume: 70,
    seEnabled: true,
  },
});
