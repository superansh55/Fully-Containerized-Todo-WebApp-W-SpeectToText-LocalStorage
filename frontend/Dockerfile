# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --silent
COPY . .
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# ── Stage 2: Serve with nginx ─────────────────────────────────────────────────
FROM nginx:1.25-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/api/health || exit 1
CMD ["nginx", "-g", "daemon off;"]