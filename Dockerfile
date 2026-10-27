# Image de production : nginx non-root (port 8080 à l'intérieur du conteneur)
FROM nginxinc/nginx-unprivileged:1.30.6-alpine3.24

# Page d'erreur fournie par l'image de base : inutile pour le jeu.
# Le dossier appartient à root, on repasse root le temps de la supprimer.
USER root
RUN rm /usr/share/nginx/html/50x.html
USER nginx

# Seul le site est copié dans l'image
COPY --chmod=644 index.html style.css script.js /usr/share/nginx/html/

EXPOSE 8080
