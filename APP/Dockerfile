FROM node:22-alpine
WORKDIR /srv
COPY lib ./lib
COPY data ./data
COPY gateway ./gateway
COPY services ./services
ENV ENTRY=gateway/server.js
EXPOSE 4000
CMD node $ENTRY
