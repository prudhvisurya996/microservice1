FROM node:22-alpine
WORKDIR /srv
COPY package.json ./
RUN npm install --omit=dev
COPY lib ./lib
COPY data ./data
COPY db ./db
COPY gateway ./gateway
COPY services ./services
ENV PORT=4005
ENV SERVICE_NAME=cart
EXPOSE 4005
CMD ["node", "services/cart/server.js"]
