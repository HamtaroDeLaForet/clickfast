// ClickFast : chaque clic incrémente le score.
const button = document.getElementById("button-clicker");
const scoreEl = document.getElementById("score");

let count = 0;

button.addEventListener("click", () => {
  count += 1;
  scoreEl.textContent = count;
});
