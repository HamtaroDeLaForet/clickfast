#!/bin/sh
# Charge l'API via l'Ingress pendant N secondes (une requête toutes les 0,1 s) et compte les échecs.
# Usage : ./charge.sh 20
set -eu
duree=${1:?usage : ./charge.sh <secondes>}
url=${URL:-http://localhost:8080/api/scores}
fin=$(( $(date +%s) + duree ))
total=0; echecs=0; secondes_ko=""

while [ "$(date +%s)" -lt "$fin" ]; do
  code=$(curl -s -o /dev/null -m 2 -w '%{http_code}' -H 'Host: clickfast.localhost' "$url" || true)
  total=$((total + 1))
  if [ "$code" != 200 ]; then
    echecs=$((echecs + 1))
    s=$(date +%s)
    # une seconde comptée une seule fois : c'est la durée d'indisponibilité
    case " $secondes_ko " in *" $s "*) ;; *) secondes_ko="$secondes_ko $s"; echo "$(date +%T) échec ($code)" ;; esac
  fi
  sleep 0.1
done

echo "Requêtes : $total, échouées : $echecs, secondes d'indisponibilité : $(echo $secondes_ko | wc -w)"
