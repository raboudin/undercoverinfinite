# Build context: frontend/ (voir ci-cd.yml, job build-push-app-image)
FROM node:24-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
# Nitro (preset node-server) bundle son propre runtime dans .output/server —
# pas besoin de copier node_modules pour l'image finale.
COPY --from=build /app/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
