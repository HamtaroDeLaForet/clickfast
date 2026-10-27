# Étape 1 : dépendances de production seulement (jest reste dehors)
FROM node:24.22.1-alpine3.24 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Étape 2 : Alpine nue + le seul binaire node (sans npm ni yarn) : 249 Mo -> 205 Mo
# Même Alpine que l'image node, pour que node trouve la même libstdc++
FROM alpine:3.24.3
RUN apk add --no-cache libstdc++ && adduser -D -H node
COPY --from=deps /usr/local/bin/node /usr/local/bin/node
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json config.js db.js app.js server.js ./
USER node
EXPOSE 3000
CMD ["node", "server.js"]
