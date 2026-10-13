RelayMart source

frontend/   shop only. Run this on the frontend server.
backend/    gateway, services, Postgres, Redis, RabbitMQ. Run this on the backend server.

Both folders are inside APP/.

Backend server:
  cd APP/backend
  docker compose up --build -d

Frontend server:
  cd APP/frontend
  GATEWAY_PUBLIC_URL=http://BACKEND_PUBLIC_IP:4000 docker compose up --build -d
