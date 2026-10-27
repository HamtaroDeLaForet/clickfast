const request = require("supertest");
const { createApp } = require("./app");

// Pas de base ici : les routes testées n'y touchent pas
const app = createApp({ query: () => Promise.reject(new Error("pas de base")) });

function counter(text, labels) {
  const line = text.split("\n").find((l) => l.startsWith(`http_requests_total{${labels}}`));
  return line ? Number(line.split(" ").pop()) : 0;
}

test("3 appels à une route font monter son compteur de exactement 3", async () => {
  const labels = 'method="GET",route="/health",status="200"';
  const before = counter((await request(app).get("/metrics")).text, labels);
  for (let i = 0; i < 3; i++) await request(app).get("/health");
  expect(counter((await request(app).get("/metrics")).text, labels)).toBe(before + 3);
});

test("les 404 de routes inconnues sont comptés, sous une route unique", async () => {
  await request(app).get("/n-existe-pas");
  await request(app).get("/autre-chose");
  const text = (await request(app).get("/metrics")).text;
  expect(counter(text, 'method="GET",route="inconnue",status="404"')).toBe(2);
});

test("l'id n'apparaît jamais en label : on garde le motif de la route", async () => {
  await request(app).get("/api/scores/123");
  const text = (await request(app).get("/metrics")).text;
  expect(text).toContain('route="/api/scores/:id"');
  expect(text).not.toContain('route="/api/scores/123"');
});
