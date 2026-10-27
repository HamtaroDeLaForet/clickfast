#!/bin/sh
# Tire une panne au hasard sur vm-prod, pour l'exercice d'astreinte. À lancer sans regarder :
#   ssh -i deploy_key -p 2222 root@localhost 'sh -s' < incident.sh
# La réponse est encodée dans /root/.incident : base64 -d /root/.incident, une fois le diagnostic posé.
set -eu

n=$(( $(od -An -N1 -tu1 /dev/urandom) % 5 + 1 ))
net=$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' scores-api)
image=$(docker inspect -f '{{.Config.Image}}' scores-api)

case $n in
  1) docker stop scores-api
     answer="scores-api arrêtée. Remède : docker start scores-api (ou redéployer)." ;;
  2) docker stop scores-db
     answer="scores-db arrêtée. Remède : docker start scores-db." ;;
  3) docker network disconnect "$net" scores-api
     answer="scores-api déconnectée du réseau $net. Remède : docker network connect $net scores-api." ;;
  4) docker rm -f scores-api
     docker run -d --name scores-api --network "$net" -p 3000:3000 "$image"
     answer="scores-api relancée sans sa config (DB_* absentes). Remède : docker rm -f scores-api puis TAG=<sha> docker compose up -d dans /srv/clickfast." ;;
  5) for i in 1 2 3 4; do docker run -d --name "hog-$i" alpine:3.24.3 sh -c 'while :; do :; done'; done
     answer="4 conteneurs hog-N saturent le CPU. Remède : docker rm -f hog-1 hog-2 hog-3 hog-4." ;;
esac > /dev/null 2>&1

printf 'Panne %s : %s\n' "$n" "$answer" | base64 > /root/.incident
echo "Incident déclenché. Au pilote de jouer."
