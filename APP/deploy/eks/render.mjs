import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const services = [
  ["frontend", 4173, "frontend/server.js"],
  ["gateway", 4000, "gateway/server.js"],
  ["catalog", 4001, "services/catalog/server.js"],
  ["search", 4002, "services/search/server.js"],
  ["pricing", 4003, "services/pricing/server.js"],
  ["inventory", 4004, "services/inventory/server.js"],
  ["cart", 4005, "services/cart/server.js"],
  ["order", 4006, "services/order/server.js"],
  ["payment", 4007, "services/payment/server.js"],
  ["shipping", 4008, "services/shipping/server.js"],
  ["review", 4009, "services/review/server.js"],
  ["user", 4010, "services/user/server.js"],
  ["notification", 4011, "services/notification/server.js"],
  ["recommendation", 4012, "services/recommendation/server.js"],
  ["auth", 4013, "services/auth/server.js"],
  ["verification", 4014, "services/verification/server.js"],
  ["tracking", 4015, "services/tracking/server.js"],
];

const imagePrefix = process.env.IMAGE_PREFIX || "relaymart";

const env = [
  ["CATALOG_URL", "http://catalog:4001"],
  ["SEARCH_URL", "http://search:4002"],
  ["PRICING_URL", "http://pricing:4003"],
  ["INVENTORY_URL", "http://inventory:4004"],
  ["CART_URL", "http://cart:4005"],
  ["ORDER_URL", "http://order:4006"],
  ["PAYMENT_URL", "http://payment:4007"],
  ["SHIPPING_URL", "http://shipping:4008"],
  ["REVIEW_URL", "http://review:4009"],
  ["USER_URL", "http://user:4010"],
  ["NOTIFICATION_URL", "http://notification:4011"],
  ["RECOMMENDATION_URL", "http://recommendation:4012"],
  ["AUTH_URL", "http://auth:4013"],
  ["VERIFICATION_URL", "http://verification:4014"],
  ["TRACKING_URL", "http://tracking:4015"],
  ["DATABASE_URL", "postgres://relay:relay@postgres:5432/relaymart"],
  ["REDIS_URL", "redis://redis:6379"],
  ["RABBIT_URL", "amqp://relay:relay@rabbitmq:5672"],
  ["GATEWAY_PUBLIC_URL", "http://gateway:4000"],
];

function doc(name, port, entry) {
  const vars = [
    `            - { name: ENTRY, value: ${entry} }`,
    `            - { name: PORT, value: "${port}" }`,
    `            - { name: SERVICE_NAME, value: ${name} }`,
    ...env.map(([key, value]) => `            - { name: ${key}, value: ${value} }`),
  ].join("\n");
  return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
  namespace: relaymart
  labels: { app: ${name} }
spec:
  replicas: ${name === "gateway" ? 2 : 1}
  selector:
    matchLabels: { app: ${name} }
  template:
    metadata:
      labels: { app: ${name} }
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "${port}"
        prometheus.io/path: /metrics
    spec:
      containers:
        - name: ${name}
          image: ${imagePrefix}/${name}:latest
          ports: [{ containerPort: ${port} }]
          env:
${vars}
          readinessProbe:
            httpGet: { path: /health, port: ${port} }
            initialDelaySeconds: 2
          resources:
            requests: { cpu: 100m, memory: 128Mi }
            limits: { cpu: 500m, memory: 256Mi }
---
apiVersion: v1
kind: Service
metadata:
  name: ${name}
  namespace: relaymart
spec:
  selector: { app: ${name} }
  ports: [{ port: ${port}, targetPort: ${port} }]
`;
}

const header = `apiVersion: v1
kind: Namespace
metadata:
  name: relaymart
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: gateway
  namespace: relaymart
spec:
  rules:
    - host: relaymart.local
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: gateway
                port: { number: 4000 }
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: gateway
  namespace: relaymart
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: gateway
  minReplicas: 2
  maxReplicas: 6
  metrics:
    - type: Resource
      resource:
        name: cpu
        target: { type: Utilization, averageUtilization: 70 }
`;

const file = join(dirname(fileURLToPath(import.meta.url)), "mesh.yaml");
writeFileSync(file, [header, ...services.map((row) => doc(...row))].join("---\n"));
console.log(file);
