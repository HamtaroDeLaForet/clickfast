const { Pool } = require("pg");
const { loadConfig } = require("./config");
const { createApp } = require("./app");
const { SCHEMA } = require("./db");

let config;
try {
  config = loadConfig();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const pool = new Pool({ ...config.db, connectionTimeoutMillis: 3000 });
// Sans ce handler, une base tuée fait planter tout le process via un client inactif
pool.on("error", (err) => console.error("Connexion Postgres perdue :", err.message));

// La base peut démarrer après l'API : on réessaie jusqu'à pouvoir créer la table
async function initSchema() {
  for (;;) {
    try {
      await pool.query(SCHEMA);
      console.log("Table scores prête");
      return;
    } catch (err) {
      console.error("Base injoignable, nouvel essai dans 2 s :", err.message);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

initSchema();
const server = createApp(pool, { corsOrigin: config.corsOrigin }).listen(config.port, () => {
  console.log(`API de scores sur le port ${config.port}`);
});

// docker stop envoie SIGTERM : on ferme proprement au lieu d'attendre le SIGKILL
process.on("SIGTERM", () => server.close(() => pool.end().then(() => process.exit(0))));
