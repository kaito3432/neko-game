const BOARD_SIZE = 7;

const DEMO = {
  boxes: [
    1, 3, 5,
    8, 10, 12,
    15, 19,
    22, 24, 26,
    29, 31, 33,
    36, 38, 40,
    43, 45,
  ],
  goal: 48,
  cat: 42,
  dogs: [2, 18, 34],
};

export class BoardView {
  constructor(element) {
    this.element = element;
    this.tiles = [];
  }

  mount() {
    const fragment = document.createDocumentFragment();

    for (let index = 0; index < BOARD_SIZE * BOARD_SIZE; index += 1) {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "tile tile--path";
      tile.dataset.index = String(index);
      tile.setAttribute("role", "gridcell");
      tile.setAttribute("aria-label", `マス ${index + 1}`);

      if (DEMO.boxes.includes(index)) {
        tile.classList.add("tile--box");
        tile.disabled = true;
        tile.setAttribute("aria-label", `マス ${index + 1} 段ボール`);
      }

      if (index === DEMO.goal) {
        tile.classList.add("tile--goal");
        tile.setAttribute("aria-label", "ゴール");
      }

      fragment.append(tile);
      this.tiles.push(tile);
    }

    this.element.replaceChildren(fragment);
    this.renderPieces();
  }

  renderPieces() {
    this.tiles.forEach((tile) => tile.querySelector(".piece")?.remove());

    this.addPiece(DEMO.cat, "🐱", "piece piece--cat", "ネコ");

    DEMO.dogs.forEach((position, i) => {
      const piece = this.addPiece(position, "🐕", "piece piece--dog", `柴犬 ${i + 1}`);
      piece.dataset.dog = String(i + 1);
    });
  }

  addPiece(index, emoji, className, label) {
    const piece = document.createElement("span");
    piece.className = className;
    piece.textContent = emoji;
    piece.setAttribute("aria-label", label);
    piece.setAttribute("role", "img");
    this.tiles[index].append(piece);
    return piece;
  }

  setSelectable(turn) {
    this.tiles.forEach((tile) => tile.classList.remove("is-selectable"));

    const catSelectable = [35, 41, 43];
    const dogSelectable = [9, 17, 25, 27, 32];

    (turn === "cat" ? catSelectable : dogSelectable).forEach((index) => {
      if (!this.tiles[index].disabled) this.tiles[index].classList.add("is-selectable");
    });
  }

  onTileSelect(callback) {
    this.element.addEventListener("click", (event) => {
      const tile = event.target.closest(".tile.is-selectable");
      if (!tile) return;
      callback(Number(tile.dataset.index));
    });
  }
}
