# Image de production : nginx non-root (port 8080 à l'intérieur du conteneur)
FROM nginxinc/nginx-unprivileged:1.27-alpine

# Seul le site est copié dans l'image
COPY --chmod=644 index.html style.css script.js /usr/share/nginx/html/

EXPOSE 8080
