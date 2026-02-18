# --- STAGE 1: Build ---
FROM node:22-alpine AS build-stage
WORKDIR /app

# Abhängigkeiten installieren
COPY package*.json ./
RUN npm install

# Quellcode kopieren und Build ausführen (Vite)
COPY . .
RUN npm run build

# --- STAGE 2: Production ---
FROM nginx:alpine AS production-stage

# Kopiere die gebauten statischen Dateien aus der ersten Stage
# Vite speichert das Ergebnis standardmäßig in /app/dist
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Port 80 für Web-Traffic
EXPOSE 80
EXPOSE 5173

CMD ["nginx", "-g", "daemon off;"]