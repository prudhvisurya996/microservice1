RelayMart source

APP/frontend  shop. Run on the frontend server.
APP/backend   gateway, services, database, Redis, RabbitMQ. Run on the backend server.

Backend:
  cd APP/backend && docker compose up --build -d

Frontend:
  cd APP/frontend
  GATEWAY_PUBLIC_URL=http://BACKEND_PUBLIC_IP:4000 docker compose up --build -d
