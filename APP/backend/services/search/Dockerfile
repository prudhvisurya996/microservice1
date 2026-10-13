FROM node:22-alpine
WORKDIR /srv
COPY package.json ./
RUN npm install --omit=dev
COPY lib ./lib
COPY data ./data
COPY db ./db
COPY gateway ./gateway
COPY services ./services
ENV PORT=4002
ENV SERVICE_NAME=search
EXPOSE 4002
CMD ["node", "services/search/server.js"]
