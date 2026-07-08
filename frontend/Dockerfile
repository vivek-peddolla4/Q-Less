# ══════════════════════════════════════════════════════════════
# Stage 1: BUILD — Install dependencies and compile React app
# ══════════════════════════════════════════════════════════════
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files first for better layer caching
# (only re-installs if package.json or package-lock.json changes)
COPY package*.json ./
RUN npm ci

# Accept Vite build-time env vars as Docker build arguments
ARG VITE_API_URL
ARG VITE_AI_SERVICE_URL

# Expose them as environment variables so Vite picks them up at build time
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_AI_SERVICE_URL=$VITE_AI_SERVICE_URL

# Copy source and build production bundle
COPY . .
RUN npm run build

# ══════════════════════════════════════════════════════════════
# Stage 2: SERVE — Lightweight Nginx to serve the static files
# ══════════════════════════════════════════════════════════════
FROM nginx:1.27-alpine

# Remove default Nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the compiled React build from Stage 1
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
