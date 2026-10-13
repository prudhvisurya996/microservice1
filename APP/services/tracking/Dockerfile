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
ENV PORT=4015
ENV SERVICE_NAME=tracking
EXPOSE 4015
CMD ["node", "services/tracking/server.js"]
