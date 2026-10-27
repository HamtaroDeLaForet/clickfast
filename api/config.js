// Lit la configuration dans l'environnement : une variable obligatoire absente arrête le démarrage.
const REQUIRED = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"];

function loadConfig(env = process.env) {
  const missing = REQUIRED.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(`Variable(s) d'environnement manquante(s) : ${missing.join(", ")}`);
  }
  return {
    port: Number(env.PORT || 3000),
    corsOrigin: env.CORS_ORIGIN || "*",
    db: {
      host: env.DB_HOST,
      port: Number(env.DB_PORT || 5432),
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
    },
  };
}

module.exports = { loadConfig };
