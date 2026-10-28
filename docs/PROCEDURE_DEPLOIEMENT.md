# Procédure de déploiement : API de scores ClickFast (Kubernetes)

Runbook à suivre pas à pas, sans connaître le projet. Chaque étape se termine par une vérification : si elle ne donne pas le résultat attendu, **on s'arrête** et on passe à « Retour arrière » ou « Pannes connues ».

Durée normale : rolling update de 3 pods en **14 à 16 s** sous charge, sans requête perdue (mesuré avec `./charge.sh 30`). Push sur `main` → nouveau sha en prod : **à mesurer et noter ici** (__ min).

## 1. Accès

| Quoi | Valeur |
|---|---|
| Cluster | k3d `clickfast-cluster`, sur la machine du runner self-hosted |
| Contexte kubectl | `k3d-clickfast-cluster` |
| Namespace | `clickfast` |
| Manifestes | `k8s/` du dépôt, appliqués avec `kubectl apply -k k8s/` |
| Secret | `k8s/clickfast-secret.yaml` (ignoré par Git, modèle : `clickfast-secret.example.yaml`) |
| Image | `ghcr.io/hamtarodelaforet/clickfast-api:<sha du commit>` |
| Entrée | http://clickfast.localhost:8080 (Ingress Traefik) |

Vérification avant toute action (**ne rien faire si l'une échoue**) :

```sh
kubectl config current-context        # attendu : k3d-clickfast-cluster
kubectl get nodes                     # attendu : k3d-clickfast-cluster-server-0   Ready
kubectl get pods -n clickfast         # attendu : 3 clickfast-api et 1 clickfast-db en 1/1 Running
```

Mauvais contexte (un autre cluster répond) : `kubectl config use-context k3d-clickfast-cluster`, puis recommencer les vérifications.
Cluster arrêté (`connection refused`) : `k3d cluster start clickfast-cluster`.

## 2. Déploiement normal (par la pipeline)

1. Fusionner ou pousser sur `main`.
   **Vérifier** : onglet Actions, workflow `Release`, le run démarre.
2. Attendre `api-test`, `api-integration`, puis `api-build`.
   **Vérifier** : le tag `<sha>` existe dans les packages GitHub (`clickfast-api`).
3. Le job `deploy` tourne sur le runner self-hosted (terminal `./run.sh` ouvert).
   **Vérifier** : le job ne reste pas « Queued », sinon relancer `./run.sh`.
4. Le job finit par `deployment "clickfast-api" successfully rolled out`.
   **Vérifier** :

   ```sh
   kubectl get deploy clickfast-api -n clickfast -o jsonpath='{.spec.template.spec.containers[0].image}'
   # attendu : ...clickfast-api:<sha poussé>
   curl -s -H 'Host: clickfast.localhost' http://localhost:8080/health   # {"status":"ok",...}
   ```

## 3. Déploiement manuel d'urgence (pipeline en panne)

```sh
kubectl set image deployment/clickfast-api -n clickfast api=ghcr.io/hamtarodelaforet/clickfast-api:<sha>
# vérif : "image updated"
kubectl rollout status deployment/clickfast-api -n clickfast --timeout=180s
# vérif : "successfully rolled out". Timeout = le nouveau pod ne démarre pas : passer à la section 5
curl -s -H 'Host: clickfast.localhost' http://localhost:8080/health
# vérif : {"status":"ok",...}
```

Puis reporter le sha dans `newTag` de `k8s/kustomization.yaml` par une PR, pour que le dépôt reste la vérité.

Premier déploiement sur un cluster neuf :

```sh
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/clickfast-secret.yaml      # vérif : secret/clickfast-secret created
kubectl apply -k k8s/                            # vérif : aucune ligne "error"
kubectl get pvc -n clickfast                     # vérif : clickfast-db-data   Bound   1Gi   RWO
kubectl rollout status deployment/clickfast-api -n clickfast
```

## 4. Retour arrière

**Quand** : après un déploiement, si l'une de ces conditions dure plus de 2 minutes :
- `/health` ne répond pas ;
- `charge.sh` remonte des échecs ;
- `rollout status` ne converge pas.

**Qui décide** : la personne d'astreinte, sans attendre d'accord. On revient d'abord, on diagnostique ensuite.

**Commande** :

```sh
kubectl rollout undo deployment/clickfast-api -n clickfast
kubectl rollout status deployment/clickfast-api -n clickfast
curl -s -H 'Host: clickfast.localhost' http://localhost:8080/health
```

Revenir à une version précise : `kubectl rollout history deployment/clickfast-api -n clickfast`, puis `kubectl rollout undo deployment/clickfast-api -n clickfast --to-revision=<N>`.

Attention : `undo` revient à la révision **précédente**, quelle qu'elle soit. Après plusieurs `rollout restart`, la précédente peut être elle aussi cassée. Toujours vérifier l'image et les ressources après un undo :

```sh
kubectl get deploy clickfast-api -n clickfast -o jsonpath='{.spec.template.spec.containers[0].image} {.spec.template.spec.containers[0].resources}'
```

En cas de doute, `kubectl apply -k k8s/` remet l'état décrit dans le dépôt.

## 5. Pannes connues

Les 5 pannes de `chaos.sh`, diagnostiquées et vérifiées. Avec `maxUnavailable: 0` et la sonde readiness, aucune ne coupe le service : les anciens pods restent en place tant que les nouveaux ne sont pas prêts.

| Panne | Signature dans `kubectl get pods` | Signature dans `describe` / events | Se répare seule ? | Remède |
|---|---|---|---|---|
| Pod supprimé | un pod `clickfast-api` d'âge quelques secondes | events : `Killing`, puis `Scheduled`, `Started` | **Oui** | rien |
| `kill 1` dans le conteneur | `RESTARTS` à 1 sur un pod | `Last State: Terminated`, `Reason: Completed`, exit 0 | **Oui** | rien |
| Image inexistante | 1 pod `0/1 ErrImagePull` puis `ImagePullBackOff`, 3 anciens `Running` | events : `Failed to pull image ... not found` | Non | `kubectl rollout undo deployment/clickfast-api -n clickfast` |
| `DB_PASSWORD` retirée du Secret | 1 pod `0/1 CrashLoopBackOff`, 3 anciens `Running` | `kubectl logs <pod>` : `Variable(s) d'environnement manquante(s) : DB_PASSWORD` | Non | `kubectl apply -f k8s/clickfast-secret.yaml` puis `kubectl rollout restart deployment/clickfast-api -n clickfast` |
| Limite mémoire à 8Mi | 1 pod `0/1 OOMKilled` puis `CrashLoopBackOff` | `Last State: Terminated`, `Reason: OOMKilled`, exit 137 | Non | `kubectl apply -k k8s/` (remet la limite de 32Mi) |

Autres cas connus :

| Panne | Signature | Remède |
|---|---|---|
| Base arrêtée | les pods API restent `1/1`, mais `/api/scores` renvoie 503 | `kubectl scale deployment/clickfast-db -n clickfast --replicas=1` |
| Selector du Service faux | 3 pods `Running`, mais toutes les requêtes échouent ; `kubectl get endpoints -n clickfast` vide | réappliquer `k8s/clickfast-api-service.yaml` |
| Pod `Pending` | `0/1 Pending`, events : `Insufficient memory` ou `cpu` | baisser `requests` ou libérer le nœud |
| DNS du cluster figé après un changement de réseau | job `deploy` rouge sur `timed out waiting for the condition` ; 1 pod `ImagePullBackOff`, 3 anciens `Running` ; events : `lookup ghcr.io: Try again` | `k3d cluster stop clickfast-cluster && k3d cluster start clickfast-cluster`, vérifier `docker exec k3d-clickfast-cluster-server-0 nslookup ghcr.io`, puis relancer le job (« Re-run failed jobs ») |

**Limite des sondes** : `/health` ne teste pas la base. Si Postgres tombe, les pods API restent `1/1 Ready`, le Service continue de leur envoyer du trafic et les joueurs reçoivent des 503. Il faut surveiller les erreurs (`charge.sh`, `kubectl logs`), pas seulement l'état des pods.

Diagnostic de base, dans cet ordre :
1. `kubectl get pods -n clickfast` ;
2. `kubectl describe pod <pod> -n clickfast`, en lisant `Last State` et `Events` ;
3. `kubectl logs <pod> -n clickfast --previous` ;
4. `kubectl get events -n clickfast --sort-by=.lastTimestamp` ;
5. `kubectl top pods -n clickfast`.
