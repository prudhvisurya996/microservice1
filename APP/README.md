# RelayMart

Clone this `APP` folder on the AWS server. Every service has its own Dockerfile and its own image. The browser talks only to the frontend. The frontend talks only to the API gateway. The gateway talks to the backend services.

## Layout

| Layer | Service | Port | Image |
| --- | --- | --- | --- |
| Frontend | `frontend` | 4173 | `relaymart/frontend` |
| API | `gateway` | 4000 | `relaymart/gateway` |
| Backend | catalog, search, pricing, inventory, cart, order | 4001–4006 | one image each |
| Backend | payment | 4007 | `relaymart/payment` |
| Backend | shipping, review, user, notification, recommendation | 4008–4012 | one image each |
| Backend | auth (register and login) | 4013 | `relaymart/auth` |
| Backend | verification (email and mobile OTP) | 4014 | `relaymart/verification` |
| Backend | tracking | 4015 | `relaymart/tracking` |
| Data | Postgres | 5432 | database for users, payments, shipments |
| Data | Redis | 6379 | sessions and OTP. On AWS this is ElastiCache |
| Data | RabbitMQ | 5672 | `user.registered`, `otp.email`, `otp.mobile`, `payment.authorized`, `tracking.updated` |
| Logs | Fluent Bit, Elasticsearch, Kibana | 5601 | EFK. Index pattern `relaymart-*` |

JSON logs go to stdout: `service`, `msg`, `path`, `status`. Fluent Bit tails the container logs and writes them to Elasticsearch. Kibana is how you watch them live.

OTP codes are not sent through SES or SNS. They are stored in Redis for 5 minutes, published on RabbitMQ, and written to stdout so they show up in Kibana. The notification service consumes the queue. Swap that consumer for SES or SNS when you want real delivery.

## 1. Test with Docker Compose

On the server, from this folder:

```bash
docker compose up --build
```

- Shop UI: http://127.0.0.1:4173
- API: http://127.0.0.1:4000
- Kibana: http://127.0.0.1:5601
- RabbitMQ management: http://127.0.0.1:15672 (`relay` / `relay`)
- Grafana metrics: http://127.0.0.1:3000 (`admin` / `classroom`)

In Kibana, create a data view for `relaymart-*`. Filter `service: "verification"` to see email and mobile codes.

```bash
curl -s -X POST http://127.0.0.1:4000/api/register \
  -H 'content-type: application/json' \
  -d '{"name":"Asha Menon","email":"asha@classroom.relaymart","mobile":"9845012345","password":"classroom123"}'

curl -s -X POST http://127.0.0.1:4000/api/verify/email/send \
  -H 'content-type: application/json' \
  -d '{"email":"asha@classroom.relaymart"}'
```

Read the code from `docker compose logs verification`, then:

```bash
curl -s -X POST http://127.0.0.1:4000/api/verify/email/confirm \
  -H 'content-type: application/json' \
  -d '{"email":"asha@classroom.relaymart","code":"THE_CODE"}'

curl -s -X POST http://127.0.0.1:4000/api/verify/mobile/send \
  -H 'content-type: application/json' \
  -d '{"mobile":"9845012345"}'
# confirm the same way, then login
curl -s -X POST http://127.0.0.1:4000/api/login \
  -H 'content-type: application/json' \
  -d '{"email":"asha@classroom.relaymart","password":"classroom123"}'

curl -s -X POST http://127.0.0.1:4000/api/tracking/shipments \
  -H 'content-type: application/json' \
  -d '{"orderId":"ord_demo","pincode":"560001"}'
```

Checkout still works on the gateway: `POST /api/checkout` with coupon `STUDIO`.

Without the full stack, `node scripts/smoke.mjs` checks the original checkout saga only.

## 2. Images and ECR

```bash
AWS_ACCOUNT_ID=123456789012 AWS_REGION=ap-south-1 sh scripts/ecr-push.sh
```

That creates one ECR repository per service (`relaymart/frontend`, `relaymart/gateway`, `relaymart/auth`, …) and pushes `:latest`.

## 3. ECS

`deploy/ecs/main.tf` is one Fargate service per image. Cloud Map DNS is `*.relaymart.local`.

```bash
cd deploy/ecs
terraform init
terraform apply \
  -var vpc_id=vpc-xxxx \
  -var 'subnet_ids=["subnet-a","subnet-b"]' \
  -var execution_role_arn=arn:aws:iam::123456789012:role/ecsTaskExecutionRole \
  -var image_prefix=123456789012.dkr.ecr.ap-south-1.amazonaws.com/relaymart \
  -var database_url='postgres://relay:PASSWORD@your-rds:5432/relaymart' \
  -var redis_url='redis://your-elasticache:6379' \
  -var rabbit_url='amqp://relay:relay@rabbit:5672' \
  -var elasticsearch_host=your-es.example.com
```

When `elasticsearch_host` is set, each task gets a FireLens Fluent Bit sidecar and ships logs to that cluster for Kibana. When it is empty, logs stay in CloudWatch `/relaymart/mesh`.

`create_elasticache = true` and `create_rds = true` provision Redis and Postgres. Copy the outputs into `redis_url` and `database_url` and apply again. Change the RDS password in `elasticache.tf` before you do that.

Run `db/init.sql` on RDS once. Compose does that automatically.

## 4. EKS

```bash
IMAGE_PREFIX=123456789012.dkr.ecr.ap-south-1.amazonaws.com/relaymart \
  node deploy/eks/render.mjs
kubectl apply -f deploy/eks/mesh.yaml
kubectl apply -f deploy/eks/efk.yaml
```

`mesh.yaml` is one Deployment and Service per image. The gateway has an Ingress and an HPA.

`efk.yaml` runs Elasticsearch, Kibana, and a Fluent Bit DaemonSet in the `logging` namespace. Fluent Bit tails `/var/log/containers` and indexes `relaymart-*`. Port-forward Kibana:

```bash
kubectl -n logging port-forward svc/kibana 5601:5601
```

Postgres, Redis, and RabbitMQ are not in the cluster manifest. Point `DATABASE_URL`, `REDIS_URL`, and `RABBIT_URL` in `render.mjs` at RDS, ElastiCache, and Amazon MQ (or run the same three containers you use in Compose).

## What is still a classroom stand-in

- Payment authorizes and writes a row. It does not call a bank.
- Email and SMS are the log line plus the RabbitMQ message, not SES or SNS.
- Elasticsearch in Compose and on EKS is a single node with security off. Use Amazon OpenSearch for a real cluster and turn TLS on in the Fluent Bit output.
