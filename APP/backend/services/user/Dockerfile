FROM node:22-alpine
WORKDIR /srv
COPY package.json ./
RUN npm install --omit=dev
COPY lib ./lib
COPY data ./data
COPY db ./db
COPY gateway ./gateway
COPY services ./services
ENV PORT=4010
ENV SERVICE_NAME=user
EXPOSE 4010
CMD ["node", "services/user/server.js"]
