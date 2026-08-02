# Build context: api/ (voir ci-cd.yml, job build-push-api-image)
FROM node:24-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build
# "prisma" (CLI utilisé par le postinstall "prisma generate") est en
# devDependency : on la retire après le build plutôt que de refaire un
# npm ci --omit=dev à froid dans le stage runtime, ce qui échouerait sur
# le postinstall (binaire prisma absent).
RUN npm prune --omit=dev

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
EXPOSE 3000
CMD ["node", "dist/main"]
