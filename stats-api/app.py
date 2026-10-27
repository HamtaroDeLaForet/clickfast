"""stats-api : statistiques du jeu ClickFast, lues dans la même base que l'API de scores."""
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import psycopg

# Doivent correspondre au schéma créé par l'API de scores (api/server.js)
TABLE = "scores"
COL_USERNAME = "username"
COL_SCORE = "score"

REQUIRED = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"]
missing = [name for name in REQUIRED if not os.environ.get(name)]
if missing:
    sys.exit(f"Variable(s) d'environnement manquante(s) : {', '.join(missing)}")

DSN = {
    "host": os.environ["DB_HOST"],
    "port": int(os.environ.get("DB_PORT", "5432")),
    "user": os.environ["DB_USER"],
    "password": os.environ["DB_PASSWORD"],
    "dbname": os.environ["DB_NAME"],
    "connect_timeout": 3,
}
PORT = int(os.environ.get("PORT", "5000"))

QUERY = f"""SELECT COALESCE(MAX({COL_SCORE}), 0), COUNT(*), COUNT(DISTINCT {COL_USERNAME})
FROM {TABLE}"""


def read_stats():
    with psycopg.connect(**DSN) as conn:
        try:
            best, games, players = conn.execute(QUERY).fetchone()
        except psycopg.errors.UndefinedTable:
            # Aucune partie encore jouée : table pas encore créée, compteurs à zéro
            best, games, players = 0, 0, 0
    return {"best_score": best, "games_played": games, "distinct_players": players}


class Handler(BaseHTTPRequestHandler):
    def send_json(self, status, body):
        payload = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        if self.path == "/health":
            return self.send_json(200, {"status": "ok"})
        if self.path != "/stats":
            return self.send_json(404, {"error": "route inconnue"})
        try:
            self.send_json(200, read_stats())
        except psycopg.Error as err:
            # Le détail reste dans les logs, le client reçoit un message exploitable
            print(f"Base injoignable : {err}", file=sys.stderr, flush=True)
            self.send_json(503, {"error": "base de données indisponible"})


if __name__ == "__main__":
    print(f"stats-api sur le port {PORT}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
