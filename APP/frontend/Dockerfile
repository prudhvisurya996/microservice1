FROM node:22-alpine
WORKDIR /srv
COPY server.js ./
COPY products ./products
ENV PORT=4173
EXPOSE 4173
CMD ["node", "server.js"]
