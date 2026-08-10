# Imagem enxuta de Node 20 LTS. Usar Dockerfile em vez do builder
# automatico (Railpack/Nixpacks) evita bugs de plataforma do Railway
# com dependencias apt/mise.
FROM node:20-alpine

WORKDIR /app

# Copia manifestos primeiro para aproveitar cache de camadas do Docker.
COPY package*.json ./
RUN npm install --omit=dev

# Copia o resto do codigo.
COPY . .

# O Railway injeta a variavel PORT em runtime; o server.js ja le
# process.env.PORT. Exposicao aqui e so documentacao.
EXPOSE 3000

CMD ["node", "server.js"]
