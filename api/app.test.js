const { validateScore, SCORE_MAX } = require("./app");
const { loadConfig } = require("./config");

describe("validateScore", () => {
  test("accepte un score valide", () => {
    expect(validateScore({ username: "mateo", score: 42 })).toBeNull();
  });

  test.each([
    [{ score: 42 }, "username obligatoire"],
    [{ username: "  ", score: 42 }, "username obligatoire"],
    [{ username: "mateo" }, "score doit être un entier"],
    [{ username: "mateo", score: "42" }, "score doit être un entier"],
    [{ username: "mateo", score: 4.2 }, "score doit être un entier"],
    [{ username: "mateo", score: -1 }, `score hors limites (0 à ${SCORE_MAX})`],
    [{ username: "mateo", score: SCORE_MAX + 1 }, `score hors limites (0 à ${SCORE_MAX})`],
  ])("refuse %j", (body, message) => {
    expect(validateScore(body)).toBe(message);
  });
});

describe("loadConfig", () => {
  test("liste les variables manquantes", () => {
    expect(() => loadConfig({ DB_HOST: "db" })).toThrow("DB_USER, DB_PASSWORD, DB_NAME");
  });

  test("applique les valeurs par défaut", () => {
    const config = loadConfig({ DB_HOST: "db", DB_USER: "u", DB_PASSWORD: "p", DB_NAME: "n" });
    expect(config.port).toBe(3000);
    expect(config.db.port).toBe(5432);
  });
});
