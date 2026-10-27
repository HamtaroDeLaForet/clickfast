// ClickFast : chaque clic incrémente le score, pendant 5 secondes.
const DUREE = 5;

function initGame() {
  const button = document.getElementById("button-clicker");
  const scoreEl = document.getElementById("score");
  const timerEl = document.getElementById("timer");

  let count = 0;
  let remaining = DUREE;
  let timerId = null;
  let finished = false;

  function endGame() {
    clearInterval(timerId);
    finished = true;
    button.disabled = true;
    timerEl.textContent = "Terminé";
  }

  button.addEventListener("click", () => {
    if (finished) return;

    // Le chrono démarre au premier clic
    if (timerId === null) {
      timerId = setInterval(() => {
        remaining -= 1;
        timerEl.textContent = remaining;
        if (remaining <= 0) endGame();
      }, 1000);
    }

    count += 1;
    scoreEl.textContent = count;
  });
}

// Navigateur : on lance le jeu. Jest (Node) : on exporte pour les tests.
if (typeof module !== "undefined") {
  module.exports = { initGame, DUREE };
} else {
  initGame();
}
