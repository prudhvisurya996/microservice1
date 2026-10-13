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
ENV PORT=4173
ENV SERVICE_NAME=frontend
EXPOSE 4173
CMD ["node", "frontend/server.js"]
