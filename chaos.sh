#!/bin/sh
# Tire une panne au hasard sur clickfast-cluster. À lancer sans regarder : ./chaos.sh
# La réponse est encodée dans .incident (ignoré par Git) : base64 -d .incident, une fois le diagnostic posé.
set -eu
ns=clickfast
# PANNE=3 ./chaos.sh force une panne précise (pour tester le script lui-même)
n=${PANNE:-$(( $(od -An -N1 -tu1 /dev/urandom) % 5 + 1 ))}
pod=$(kubectl get pods -n $ns -l app=clickfast-api -o jsonpath='{.items[0].metadata.name}')

case $n in
  1) kubectl delete pod -n $ns "$pod" --wait=false
     answer="pod $pod supprimé. Se répare seule : le Deployment en recrée un." ;;
  2) kubectl exec -n $ns "$pod" -- kill 1
     answer="kill 1 dans $pod : le conteneur s'arrête. Se répare seule : kubelet le redémarre (RESTARTS +1)." ;;
  3) kubectl set image deployment/clickfast-api -n $ns api=ghcr.io/hamtarodelaforet/clickfast-api:ce-tag-n-existe-pas
     answer="image inexistante : nouveau pod en ImagePullBackOff. Remède : kubectl rollout undo deployment/clickfast-api -n $ns." ;;
  4) kubectl patch secret clickfast-secret -n $ns --type=json -p '[{"op":"remove","path":"/data/DB_PASSWORD"}]'
     kubectl rollout restart deployment/clickfast-api -n $ns
     answer="DB_PASSWORD retirée du Secret : nouveaux pods en CrashLoopBackOff (variable manquante). Remède : kubectl apply -f k8s/clickfast-secret.yaml puis kubectl rollout restart deployment/clickfast-api -n $ns." ;;
  5) kubectl set resources deployment/clickfast-api -n $ns -c api --limits=memory=8Mi
     answer="limite mémoire à 8Mi : nouveaux pods OOMKilled en boucle. Remède : kubectl rollout undo deployment/clickfast-api -n $ns." ;;
esac > /dev/null 2>&1

printf 'Panne %s : %s\n' "$n" "$answer" | base64 > .incident
echo "Incident déclenché. À toi de diagnostiquer."
