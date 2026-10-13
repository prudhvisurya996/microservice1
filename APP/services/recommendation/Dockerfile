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
ENV PORT=4012
ENV SERVICE_NAME=recommendation
EXPOSE 4012
CMD ["node", "services/recommendation/server.js"]
