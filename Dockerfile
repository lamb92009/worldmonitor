# ---- Build stage ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# ---- Production stage ----
FROM node:20-alpine

# Install nginx and supervisord
RUN apk add --no-cache nginx supervisor

# Copy built frontend
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy API server and Edge Function handlers
COPY --from=builder /app/src-tauri/sidecar/local-api-server.mjs /app/local-api-server.mjs
COPY --from=builder /app/api /app/api
COPY --from=builder /app/package.json /app/package.json

# Install only production dependencies needed by API handlers
WORKDIR /app
RUN npm install --omit=dev @upstash/redis

# Copy deploy configs
COPY deploy/nginx.conf /etc/nginx/http.d/default.conf
COPY deploy/supervisord.conf /etc/supervisord.conf

# Create nginx pid directory
RUN mkdir -p /run/nginx

EXPOSE 80
CMD ["supervisord", "-c", "/etc/supervisord.conf"]
