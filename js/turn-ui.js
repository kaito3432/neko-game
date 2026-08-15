import { TURN } from "./state.js";

const COPY = {
  [TURN.CAT]: {
    character: "🐱",
    title: "ネコのターン",
    hint: "見つからないように移動しよう！",
    badge: "ESCAPE",
    boardMessage: "逃げ道を選んでね",
    actionTitle: "移動先をタップ",
  },
  [TURN.DOG]: {
    character: "🐕",
    title: "柴犬のターン",
    hint: "足跡を追ってネコを探そう！",
    badge: "CHASE",
    boardMessage: "探索か移動を選んでね",
    actionTitle: "探索方法を選択",
  },
};

export class TurnUI {
  constructor(root) {
    this.root = root;
    this.nodes = {
      turnCharacter: document.querySelector("#turnCharacter"),
      turnNumber: document.querySelector("#turnNumber"),
      turnTitle: document.querySelector("#turnTitle"),
      turnHint: document.querySelector("#turnHint"),
      turnBadge: document.querySelector("#turnBadge"),
      boardMessage: document.querySelector("#boardMessage"),
      actionTitle: document.querySelector("#actionTitle"),
      catActions: document.querySelector("#catActions"),
      dogActions: document.querySelector("#dogActions"),
      remainingTurns: document.querySelector("#remainingTurns"),
    };
  }

  render(state) {
    const copy = COPY[state.turn];
    this.root.dataset.turn = state.turn;
    this.nodes.turnCharacter.textContent = copy.character;
    this.nodes.turnNumber.textContent = state.turnNumber;
    this.nodes.turnTitle.textContent = copy.title;
    this.nodes.turnHint.textContent = copy.hint;
    this.nodes.turnBadge.textContent = copy.badge;
    this.nodes.boardMessage.textContent = copy.boardMessage;
    this.nodes.actionTitle.textContent = copy.actionTitle;
    this.nodes.catActions.hidden = state.turn !== TURN.CAT;
    this.nodes.dogActions.hidden = state.turn !== TURN.DOG;
    this.nodes.remainingTurns.textContent = Math.max(0, state.maxTurns - state.turnNumber);
  }
}
