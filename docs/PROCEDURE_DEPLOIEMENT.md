# Procédure de déploiement : API de scores ClickFast

Runbook à suivre pas à pas, sans connaître le projet. Chaque étape se termine par une vérification : si elle ne donne pas le résultat attendu, **on s'arrête** et on passe à la section « Retour arrière » ou « Pannes connues ».

Durée normale d'un déploiement par la pipeline : **à mesurer et noter ici** (job `deploy` seul : environ __ s ; push → `/health` OK : environ __ min).

## 1. Prérequis

| Quoi | Valeur |
|---|---|
| Machine de prod | conteneur `vm-prod` sur la machine du runner |
| Accès SSH | `ssh -i deploy_key -p 2222 root@localhost` |
| Clé privée | fichier `deploy_key` à la racine du repo local (jamais commité). Dans la pipeline : secret `DEPLOY_SSH_KEY` |
| Fichiers en prod | `/srv/clickfast/` : `compose.yml`, `prometheus.yml`, `grafana/`, `.env` |
| `.env` de prod | `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `GRAFANA_PASSWORD` : copié à la main, jamais dans le dépôt |
| Image | `ghcr.io/hamtarodelaforet/clickfast-api:<sha du commit>` |
| API | http://localhost:3000/health |
| Grafana | http://localhost:3001 (admin / `GRAFANA_PASSWORD`), dashboard « ClickFast - API de scores » |
| Prometheus | http://localhost:9090 |

Vérification avant de commencer :

```sh
docker ps --filter name=vm-prod --format '{{.Status}}'      # attendu : Up ...
ssh -i deploy_key -p 2222 root@localhost 'docker ps --format "{{.Names}}"'
# attendu : scores-api, scores-db, prometheus, grafana
```

Si `vm-prod` n'existe plus : `docker start vm-prod` (ou la recréer, voir l'annexe).

## 2. Déploiement normal (par la pipeline)

1. Fusionner ou pousser sur `main`.
   **Vérifier** : onglet Actions, workflow `Release`, le run démarre.
2. Attendre `api-test`, `api-integration`, puis `api-build`.
   **Vérifier** : `api-build` vert ; le tag `<sha>` existe dans les packages GitHub (`clickfast-api`).
3. Le job `deploy` tourne sur le runner self-hosted (le terminal `./run.sh` doit être ouvert).
   **Vérifier** : le job ne reste pas « Queued ». S'il l'est : le runner est arrêté, relancer `./run.sh`.
4. Le job se termine par `Déployé : <sha court>`.
   **Vérifier** depuis la machine :

   ```sh
   curl -s localhost:3000/health                       # {"status":"ok",...}
   ssh -i deploy_key -p 2222 root@localhost 'docker inspect -f "{{.Config.Image}}" scores-api'
   # attendu : ...clickfast-api:<sha du commit poussé>
   ```

5. **Vérifier** dans Grafana : panneau Disponibilité à 1, Erreurs proches de 0 %.

## 3. Déploiement manuel (pipeline en panne)

```sh
ssh -i deploy_key -p 2222 root@localhost
cd /srv/clickfast
export TAG=<sha complet à déployer>
docker compose pull scores-api                # vérif : "Pulled" ; une erreur ici = tag introuvable, rien n'a été arrêté
docker compose up -d --remove-orphans         # vérif : aucune ligne "Error"
wget -qO- localhost:3000/health               # vérif : {"status":"ok",...}
```

Si `pull` répond `denied` : le jeton GHCR a expiré. `docker login ghcr.io -u <compte GitHub>` avec un token `read:packages`, puis recommencer.

## 4. Retour arrière

**Quand** : après un déploiement, si l'une de ces conditions dure plus de 2 minutes :

| Signal | Seuil |
|---|---|
| Disponibilité (`up`) | 0 |
| Erreurs (part de 5xx) | > 5 % |
| Latence p95 | > 500 ms |
| `/health` | ne répond pas |

**Qui décide** : la personne d'astreinte, sans attendre d'accord. On revient d'abord, on diagnostique ensuite.

**Commande** (le sha précédent est dans l'historique des runs `Release`, ou `git log --format=%H -2 main`) :

```sh
ssh -i deploy_key -p 2222 root@localhost \
  'cd /srv/clickfast && export TAG=<sha précédent> && docker compose pull scores-api && docker compose up -d'
curl -s localhost:3000/health
```

**Vérifier** : `docker inspect -f '{{.Config.Image}}' scores-api` montre le sha précédent, Grafana repasse au vert.
Un tag inexistant échoue au `pull`, avant d'arrêter quoi que ce soit : la prod reste sur la version en cours.

Ensuite : corriger sur une branche, PR, fusion. Ne jamais corriger à la main en prod.

## 5. Pannes connues et leur signature

| Panne | Signature Grafana | Confirmation | Remède |
|---|---|---|---|
| API arrêtée | Disponibilité à 0 en moins de 15 s, trafic à 0 | `docker ps -a` : `scores-api` Exited | `docker start scores-api` |
| Base arrêtée | Disponibilité **reste à 1**, erreurs 5xx qui explosent | `curl localhost:3000/api/scores` → 503 ; `scores-db` Exited | `docker start scores-db` ; l'API se reconnecte seule |
| API sortie du réseau | Disponibilité à 0 alors que `scores-api` est Up | `docker inspect scores-api` : aucun réseau | `docker network connect clickfast_default scores-api` |
| API lancée sans config | Disponibilité à 0, `scores-api` redémarre ou Exited | `docker logs scores-api` : `Variable(s) d'environnement manquante(s)` | `docker rm -f scores-api` puis `cd /srv/clickfast && TAG=<sha> docker compose up -d` |
| CPU saturé | Latence p95 qui monte, trafic qui baisse | `docker stats --no-stream` : conteneurs `hog-N` à 100 % | `docker rm -f $(docker ps -q --filter name=hog-)` |
| Port 3000 déjà pris | `deploy` échoue : `port is already allocated` | `docker ps` sur la VM : un autre conteneur publie 3000 | arrêter ce conteneur, relancer le déploiement |
| Runner arrêté | job `deploy` « Queued » indéfiniment | terminal du runner fermé | relancer `./run.sh` dans le dossier du runner |
| Secret mal nommé | job `deploy` rouge : `secret DEPLOY_... vide ou introuvable` | Settings > Secrets and variables > Actions | corriger le nom du secret, relancer le job |

Diagnostic de base, dans cet ordre : `docker ps -a` → `docker logs --tail 50 <conteneur>` → `docker inspect <conteneur>` → `docker stats --no-stream`.

## Annexe : recréer vm-prod

```sh
docker build -f Dockerfile.vm -t vm-prod .
docker run -d --privileged --name vm-prod -p 2222:22 -p 3000:3000 -p 9090:9090 -p 3001:3001 \
  -v vm-prod-data:/var/lib/docker vm-prod
ssh-keygen -R '[localhost]:2222'      # la nouvelle VM a une nouvelle clé d'hôte
```

Puis recopier le `.env` de prod dans `/srv/clickfast/` et relancer le dernier run `Release` (ou la section 3).
