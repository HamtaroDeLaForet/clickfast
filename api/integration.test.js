// Tests d'intégration : vraie base Postgres (DB_* dans l'environnement), lancés par npm run test:integration
const { Pool } = require("pg");
const request = require("supertest");
const { loadConfig } = require("./config");
const { createApp } = require("./app");
const { SCHEMA } = require("./db");

const pool = new Pool(loadConfig().db);
const app = createApp(pool);

beforeAll(() => pool.query(SCHEMA));
// Chaque test repart d'une table vide
beforeEach(() => pool.query("TRUNCATE scores RESTART IDENTITY"));
afterAll(() => pool.end());

test("un score enregistré se relit par son id, avec les mêmes données", async () => {
  const created = await request(app).post("/api/scores").send({ username: "mateo", score: 42 });
  expect(created.status).toBe(201);

  const read = await request(app).get(`/api/scores/${created.body.id}`);
  expect(read.status).toBe(200);
  expect(read.body).toMatchObject({ id: created.body.id, username: "mateo", score: 42 });
});

test("un id inexistant renvoie 404", async () => {
  const res = await request(app).get("/api/scores/999999");
  expect(res.status).toBe(404);
});

test.each([
  [{ score: 10 }, "champ manquant"],
  [{ username: "mateo", score: -5 }, "score négatif"],
])("un corps invalide (%j, %s) renvoie 400 et n'écrit rien", async (body) => {
  const res = await request(app).post("/api/scores").send(body);
  expect(res.status).toBe(400);
  const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM scores");
  expect(rows[0].n).toBe(0);
});

test("un score supprimé disparaît du classement", async () => {
  const created = await request(app).post("/api/scores").send({ username: "mateo", score: 42 });

  const del = await request(app).delete(`/api/scores/${created.body.id}`);
  expect(del.status).toBe(204);

  const board = await request(app).get("/api/scores");
  expect(board.body.map((s) => s.id)).not.toContain(created.body.id);
});
