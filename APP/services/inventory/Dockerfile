FROM node:22-alpine
WORKDIR /srv
COPY package.json ./
RUN npm install --omit=dev
COPY lib ./lib
COPY data ./data
COPY db ./db
COPY gateway ./gateway
COPY services ./services
COPY frontend ./frontend
ENV PORT=4004
ENV SERVICE_NAME=inventory
EXPOSE 4004
CMD ["node", "services/inventory/server.js"]
