FROM node:22-alpine
WORKDIR /srv
COPY package.json ./
RUN npm install --omit=dev
COPY lib ./lib
COPY data ./data
COPY db ./db
COPY gateway ./gateway
COPY services ./services
ENV PORT=4001
ENV SERVICE_NAME=catalog
EXPOSE 4001
CMD ["node", "services/catalog/server.js"]
