# STAGE 1
FROM node:22-alpine AS build-stage
WORKDIR /app

# Abhängigkeiten installieren
COPY package*.json ./
RUN npm install

# Quellcode kopieren und Build ausführen (Vite)
COPY . .
RUN npm run build

# STAGE 2
FROM nginx:alpine AS production-stage

# Kopiere die gebauten statischen Dateien aus der ersten Stage
# Vite speichert das Ergebnis standardmäßig in /app/dist
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Port 80,443 für Web-Traffic (5173 für Vite-Dev-Server)
EXPOSE 80
EXPOSE 443
EXPOSE 5173

# Starten von Nginx
CMD ["nginx", "-g", "daemon off;"] 



