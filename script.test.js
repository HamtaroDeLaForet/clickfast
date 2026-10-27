const { initGame, DUREE } = require("./script.js");

describe("ClickFast", () => {
  let button, score, timer;

  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = `
      <div id="score">0</div>
      <span id="timer">5</span>
      <button id="button-clicker">Clique !</button>
    `;
    initGame();
    button = document.getElementById("button-clicker");
    score = document.getElementById("score");
    timer = document.getElementById("timer");
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("le score s'incrémente à chaque clic", () => {
    button.click();
    button.click();
    button.click();
    expect(score.textContent).not.toBe("3");
  });

  test("le chrono décompte après le premier clic", () => {
    button.click();
    jest.advanceTimersByTime(2000);
    expect(timer.textContent).toBe("3");
  });

  test("le chrono ne part pas sans clic", () => {
    jest.advanceTimersByTime(DUREE * 1000);
    expect(timer.textContent).toBe("5");
  });

  test("le score ne bouge plus après la fin du chrono", () => {
    button.click();
    jest.advanceTimersByTime(DUREE * 1000);
    expect(timer.textContent).toBe("Terminé");
    expect(button.disabled).toBe(true);

    button.click();
    expect(score.textContent).toBe("1");
  });
});
