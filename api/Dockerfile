# Étape 1 : dépendances de production seulement (jest reste dehors)
FROM node:24.22.1-alpine3.24 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Étape 2 : image finale, sans npm cache ni devDependencies
FROM node:24.22.1-alpine3.24
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json config.js app.js server.js ./
# L'image node fournit déjà l'utilisateur non-root "node"
USER node
EXPOSE 3000
CMD ["node", "server.js"]
