RelayMart source

APP/                 Node microservices (this is what Docker, ECS, and EKS run)
  docker-compose.yml local mesh
  deploy/ecs         Terraform
  deploy/eks         Kubernetes
  gateway            API gateway and checkout saga
  services           catalog, search, pricing, inventory, cart, order, payment,
                     shipping, review, user, notification, recommendation

src/routes           store, cart, orders, lab, assistant
src/lib              checkout, cart state, ranking, Grok assistant
public/products      product photos

Run the mesh:
  cd APP && npm install && node scripts/smoke.mjs
  # or: docker compose up --build
