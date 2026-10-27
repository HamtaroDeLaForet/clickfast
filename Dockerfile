# Image de production : nginx non-root (port 8080 à l'intérieur du conteneur)
FROM nginxinc/nginx-unprivileged:1.30.6-alpine3.24

# Page d'erreur fournie par l'image de base : inutile pour le jeu.
# curl n'est pas utilisé par nginx et porte des CVE remontées par Trivy.
# On repasse root le temps de les supprimer.
USER root
RUN rm /usr/share/nginx/html/50x.html && apk del --no-cache curl
USER nginx

# Seul le site est copié dans l'image
COPY --chmod=644 index.html style.css script.js /usr/share/nginx/html/

EXPOSE 8080
