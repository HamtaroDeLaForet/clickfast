// ClickFast : chaque clic incrémente le score, pendant 5 secondes.
const DUREE = 5;

function initGame(onEnd = () => {}) {
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
    onEnd(count);
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

// URL définie par config.js, remplaçable au déploiement sans reconstruire l'image
const API_URL = typeof window !== "undefined" ? window.CLICKFAST_API_URL : "";

function showMessage(text) {
  document.getElementById("message").textContent = text;
}

async function loadLeaderboard() {
  const list = document.getElementById("leaderboard");
  try {
    const res = await fetch(`${API_URL}/api/scores`);
    if (!res.ok) throw new Error((await res.json()).error);
    const scores = await res.json();
    list.replaceChildren(
      ...scores.map(({ username, score }) => {
        const li = document.createElement("li");
        li.textContent = `${username} : ${score}`;
        return li;
      })
    );
  } catch {
    // Le jeu reste jouable même sans API : on le dit, sans bloquer la page
    showMessage("Classement indisponible pour le moment.");
  }
}

async function sendScore(score) {
  const username = document.getElementById("username").value.trim() || "anonyme";
  try {
    const res = await fetch(`${API_URL}/api/scores`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, score }),
    });
    const body = await res.json();
    showMessage(res.ok ? `Score de ${score} enregistré !` : `Score non enregistré : ${body.error}`);
  } catch {
    showMessage("Score non enregistré : API injoignable.");
  }
  loadLeaderboard();
}

// Navigateur : on lance le jeu. Jest (Node) : on exporte pour les tests.
if (typeof module !== "undefined") {
  module.exports = { initGame, DUREE };
} else {
  initGame(sendScore);
  loadLeaderboard();
}
