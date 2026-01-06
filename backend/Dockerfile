FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000
EXPOSE 3006
#AUCH IM COMPOSE FILE ÄNDERN!

CMD ["node", "index.js"]