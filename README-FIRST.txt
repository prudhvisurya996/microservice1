RelayMart source

APP/frontend   shop only. Customers never see Kibana.
APP/backend    gateway, services, Postgres, Redis, RabbitMQ, Elasticsearch, Kibana.

Backend server:
  cd APP/backend
  docker compose up --build -d

Frontend server:
  cd APP/frontend
  GATEWAY_PUBLIC_URL=http://BACKEND_PUBLIC_IP:4000 docker compose up --build -d

Kibana (operators only, port 5601):
  data view relaymart-*
  event.category: "authentication"
  event.category: "order"
  event.category: "payment"
  event.category: "tracking"
