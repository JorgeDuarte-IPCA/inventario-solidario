# Imagem base leve com Node.js
FROM node:18-alpine

WORKDIR /app

# Instalar dependencias primeiro (aproveita a cache do Docker)
COPY package*.json ./
RUN npm install --omit=dev

# Copiar o resto do codigo
COPY . .

EXPOSE 3000

CMD ["npm", "start"]
