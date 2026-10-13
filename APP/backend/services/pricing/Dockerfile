FROM node:22-alpine
WORKDIR /srv
COPY package.json ./
RUN npm install --omit=dev
COPY lib ./lib
COPY data ./data
COPY db ./db
COPY gateway ./gateway
COPY services ./services
ENV PORT=4003
ENV SERVICE_NAME=pricing
EXPOSE 4003
CMD ["node", "services/pricing/server.js"]
