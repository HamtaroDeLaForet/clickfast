// Schéma de la table des scores : créé par le serveur au démarrage et par les tests d'intégration.
// stats-api lit les mêmes noms de table et de colonnes (stats-api/app.py).
const SCHEMA = `CREATE TABLE IF NOT EXISTS scores (
  id SERIAL PRIMARY KEY,
  username VARCHAR(32) NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`;

module.exports = { SCHEMA };
