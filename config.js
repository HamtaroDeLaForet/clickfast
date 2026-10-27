// URL de l'API de scores. Fichier séparé : on le remplace par environnement (volume, ConfigMap) sans reconstruire l'image.
window.CLICKFAST_API_URL = `${location.protocol}//${location.hostname}:3000`;
