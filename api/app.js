const express = require("express");
const client = require("prom-client");

const SCORE_MAX = 200; // 40 clics/s pendant 5 s : au-delà, ce n'est pas un humain

// Renvoie un message d'erreur, ou null si le corps est valide.
function validateScore(body) {
  if (!body || typeof body !== "object") return "corps JSON attendu";
  const { username, score } = body;
  if (typeof username !== "string" || username.trim() === "") return "username obligatoire";
  if (username.trim().length > 32) return "username trop long (32 caractères max)";
  if (!Number.isInteger(score)) return "score doit être un entier";
  if (score < 0 || score > SCORE_MAX) return `score hors limites (0 à ${SCORE_MAX})`;
  return null;
}

// Un registre par app : pas de métrique enregistrée deux fois quand les tests créent plusieurs apps
function createMetrics() {
  const register = new client.Registry();
  client.collectDefaultMetrics({ register });
  const labelNames = ["method", "route", "status"];
  return {
    register,
    requests: new client.Counter({
      name: "http_requests_total",
      help: "Requêtes HTTP reçues, par méthode, route et code de statut",
      labelNames,
      registers: [register],
    }),
    duration: new client.Histogram({
      name: "http_request_duration_seconds",
      help: "Durée de traitement des requêtes HTTP",
      labelNames,
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
      registers: [register],
    }),
    scoresRecorded: new client.Counter({
      name: "clickfast_scores_recorded_total",
      help: "Scores enregistrés depuis le démarrage de l'API",
      registers: [register],
    }),
  };
}

function createApp(pool, { corsOrigin = "*" } = {}) {
  const app = express();
  const metrics = createMetrics();

  app.use((req, res, next) => {
    const stopTimer = metrics.duration.startTimer();
    res.on("finish", () => {
      // Le motif de la route (/api/scores/:id), jamais l'id : un label par id ferait exploser la cardinalité
      const route = req.route ? req.route.path : "inconnue";
      const labels = { method: req.method, route, status: String(res.statusCode) };
      metrics.requests.inc(labels);
      stopTimer(labels);
    });
    next();
  });

  app.use(express.json({ limit: "1kb" }));

  // Le jeu (port 8080) appelle l'API (port 3000) : origine différente, donc CORS
  app.use((req, res, next) => {
    res.set("Access-Control-Allow-Origin", corsOrigin);
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.set("Access-Control-Allow-Methods", "GET,POST,DELETE");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  app.get("/metrics", async (req, res) => {
    res.set("Content-Type", metrics.register.contentType);
    res.send(await metrics.register.metrics());
  });

  app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.post("/api/scores", async (req, res, next) => {
    const error = validateScore(req.body);
    if (error) return res.status(400).json({ error });
    try {
      const { rows } = await pool.query(
        "INSERT INTO scores (username, score) VALUES ($1, $2) RETURNING id, username, score, created_at",
        [req.body.username.trim(), req.body.score]
      );
      metrics.scoresRecorded.inc();
      res.status(201).json(rows[0]);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/scores", async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        "SELECT id, username, score, created_at FROM scores ORDER BY score DESC, created_at ASC LIMIT 10"
      );
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/scores/:id", async (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(404).json({ error: "score introuvable" });
    try {
      const { rows } = await pool.query(
        "SELECT id, username, score, created_at FROM scores WHERE id = $1",
        [id]
      );
      if (rows.length === 0) return res.status(404).json({ error: "score introuvable" });
      res.json(rows[0]);
    } catch (err) {
      next(err);
    }
  });

  app.delete("/api/scores/:id", async (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(404).json({ error: "score introuvable" });
    try {
      const { rowCount } = await pool.query("DELETE FROM scores WHERE id = $1", [id]);
      if (rowCount === 0) return res.status(404).json({ error: "score introuvable" });
      res.sendStatus(204);
    } catch (err) {
      next(err);
    }
  });

  app.use((req, res) => res.status(404).json({ error: "route inconnue" }));

  // JSON invalide : erreur du client. Le reste (base injoignable...) : 503, jamais un plantage.
  // eslint-disable-next-line no-unused-vars -- Express reconnaît un handler d'erreur à ses 4 arguments
  app.use((err, req, res, _next) => {
    if (err.type === "entity.parse.failed") return res.status(400).json({ error: "JSON invalide" });
    console.error(err.message);
    res.status(503).json({ error: "base de données indisponible" });
  });

  return app;
}

module.exports = { createApp, validateScore, SCORE_MAX };
