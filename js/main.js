import { createInitialState, TURN } from "./state.js";
import { BoardView } from "./board.js";
import { TurnUI } from "./turn-ui.js";
import { SettingsUI } from "./settings.js";

const state = createInitialState();
const app = document.querySelector("#app");
const board = new BoardView(document.querySelector("#gameBoard"));
const turnUI = new TurnUI(app);
const toast = document.querySelector("#toast");

let toastTimer;

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 1600);
}

function render() {
  turnUI.render(state);
  board.setSelectable(state.turn);
}

function toggleTurn() {
  state.turn = state.turn === TURN.CAT ? TURN.DOG : TURN.CAT;
  if (state.turn === TURN.CAT) {
    state.turnNumber = Math.min(state.maxTurns, state.turnNumber + 1);
  }
  render();
  showToast(state.turn === TURN.CAT ? "ネコのターンへ" : "柴犬のターンへ");
}

board.mount();
board.onTileSelect((index) => {
  showToast(`${index + 1}番のマスを選択（Phase1デモ）`);
});

try {
  const saved = JSON.parse(localStorage.getItem("nyanChase.settings") || "null");
  if (saved) Object.assign(state.settings, saved);
} catch {
  // Broken/old settings are ignored safely.
}

new SettingsUI(state, () => {
  localStorage.setItem("nyanChase.settings", JSON.stringify(state.settings));
}).mount();

document.querySelectorAll("[data-demo-action]").forEach((button) => {
  button.addEventListener("click", () => {
    const labels = {
      move: "移動モードを選択",
      hide: "かくれるUIは後続Phaseでゲームロジックと接続",
      search: "クンクン探索UIを選択",
    };
    showToast(labels[button.dataset.demoAction] || "選択しました");
  });
});

document.querySelectorAll("[data-utility]").forEach((button) => {
  button.addEventListener("click", () => {
    switch (button.dataset.utility) {
      case "hint":
        showToast(state.turn === TURN.CAT ? "ピンクのマスが移動候補です" : "オレンジのマスが行動候補です");
        break;
      case "turn":
        toggleTurn();
        break;
      case "restart":
        state.turn = TURN.CAT;
        state.turnNumber = 1;
        render();
        showToast("UIデモをリセットしました");
        break;
    }
  });
});

render();
