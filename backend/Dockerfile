FROM node:22-alpine

# Arbeitsverzeichnis im Container
WORKDIR /app

# Abhängigkeiten kopieren und installieren
# Durch das Kopieren der package.json separat wird der Cache optimal genutzt
COPY package*.json ./
RUN npm install

# Den restlichen Code kopieren
COPY . .

# Dein Backend nutzt laut Compose Port 3000
EXPOSE 3000
EXPOSE 5173
EXPOSE 80

# Startbefehl
CMD ["node", "index.js"]