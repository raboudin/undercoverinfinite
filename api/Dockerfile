# Build context: api/ (voir ci-cd.yml, job build-push-api-image)
FROM node:24-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build
# Le CLI "prisma" est une dépendance de production (et non de dev) : le
# conteneur applique les migrations au déploiement via `prisma migrate
# deploy` (service "migrate" des compose staging/prod). `npm prune` doit
# donc le conserver.
RUN npm prune --omit=dev

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
# Nécessaires à `prisma migrate deploy` : le schéma, l'historique des
# migrations, et la config CLI qui porte l'URL de connexion (Prisma 7 ne
# l'accepte plus dans le bloc datasource).
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
EXPOSE 3000
CMD ["node", "dist/main"]
