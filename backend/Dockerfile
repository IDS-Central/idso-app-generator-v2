# syntax=docker/dockerfile:1.7

# --- Build stage ---
FROM node:20-slim AS build
WORKDIR /app

# Install deps with a clean, reproducible install
COPY package.json package-lock.json* ./
RUN npm install --omit=optional --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Prune dev deps for the runtime image
RUN npm prune --omit=dev

# --- Runtime stage ---
FROM node:20-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Non-root user for Cloud Run
RUN useradd -r -u 10001 -g root appuser
USER 10001

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

EXPOSE 8080
CMD ["node", "dist/index.js"]
