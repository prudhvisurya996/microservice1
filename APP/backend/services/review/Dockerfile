FROM node:22-alpine
WORKDIR /srv
COPY package.json ./
RUN npm install --omit=dev
COPY lib ./lib
COPY data ./data
COPY db ./db
COPY gateway ./gateway
COPY services ./services
ENV PORT=4009
ENV SERVICE_NAME=review
EXPOSE 4009
CMD ["node", "services/review/server.js"]
