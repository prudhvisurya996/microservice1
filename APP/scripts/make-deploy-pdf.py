#!/usr/bin/env python3
"""Detailed RelayMart deploy procedure."""

from fpdf import FPDF

OUT = "/workspace/public/RelayMart-Deploy.pdf"
INK = (28, 36, 48)
PINE = (31, 107, 74)
MUTED = (90, 98, 108)
PAPER = (244, 239, 230)
WHITE = (255, 253, 248)
CODE_BG = (23, 32, 42)
CODE_FG = (231, 238, 246)

pdf = FPDF(format="A4")
pdf.set_auto_page_break(auto=True, margin=16)
pdf.set_margins(16, 16, 16)


class Doc(FPDF):
    def header(self):
        if self.page_no() == 1:
            return
        self.set_fill_color(*PINE)
        self.rect(0, 0, 210, 10, "F")
        self.set_xy(16, 2.5)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(255, 255, 255)
        self.cell(170, 5, "RelayMart   Deploy procedure")
        self.set_text_color(*INK)
        self.set_xy(16, 14)

    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*MUTED)
        self.cell(0, 6, str(self.page_no()), align="C")
        self.set_text_color(*INK)


pdf = Doc(format="A4")
pdf.set_auto_page_break(auto=True, margin=16)
pdf.set_margins(16, 16, 16)
pdf.add_page()


def mc(h, text):
    pdf.multi_cell(0, h, text, new_x="LMARGIN", new_y="NEXT")


def h1(text):
    pdf.ln(1.5)
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(*PINE)
    mc(7, text)
    y = pdf.get_y()
    pdf.set_draw_color(*PINE)
    pdf.set_line_width(0.35)
    pdf.line(16, y, 194, y)
    pdf.ln(2.5)
    pdf.set_text_color(*INK)


def h2(text):
    pdf.ln(0.8)
    pdf.set_font("Helvetica", "B", 11.5)
    pdf.set_text_color(*INK)
    mc(6, text)


def body(text):
    pdf.set_font("Helvetica", "", 10.5)
    pdf.set_text_color(*INK)
    mc(5.2, text)
    pdf.ln(1)


def bullet(text):
    pdf.set_font("Helvetica", "", 10.5)
    pdf.set_text_color(*INK)
    mc(5.1, "-  " + text)


def step(n, title, text=""):
    pdf.ln(0.3)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(*PINE)
    mc(5.8, f"Step {n}.  {title}")
    if text:
        body(text)


def code(text):
    pdf.ln(0.3)
    pdf.set_font("Courier", "", 8)
    pdf.set_fill_color(*CODE_BG)
    pdf.set_text_color(*CODE_FG)
    for raw in text.split("\n"):
        line = raw
        while len(line) > 86:
            if pdf.get_y() > 275:
                pdf.add_page()
            pdf.set_x(16)
            pdf.cell(0, 4.2, "  " + line[:86], new_x="LMARGIN", new_y="NEXT", fill=True)
            line = line[86:]
        if pdf.get_y() > 275:
            pdf.add_page()
        pdf.set_x(16)
        pdf.cell(0, 4.2, "  " + line, new_x="LMARGIN", new_y="NEXT", fill=True)
    pdf.ln(1.6)
    pdf.set_text_color(*INK)


def expect(text):
    pdf.set_font("Helvetica", "I", 10)
    pdf.set_text_color(40, 80, 60)
    mc(5, "Expected: " + text)
    pdf.ln(1.2)
    pdf.set_text_color(*INK)


def table(rows, widths):
    pdf.set_auto_page_break(False)
    for i, row in enumerate(rows):
        if pdf.get_y() + 8 > 276:
            pdf.add_page()
            pdf.set_xy(16, 16)
        pdf.set_fill_color(*(PINE if i == 0 else (WHITE if i % 2 else PAPER)))
        pdf.set_text_color(*(WHITE if i == 0 else INK))
        pdf.set_font("Helvetica", "B" if i == 0 else "", 8)
        pdf.set_x(16)
        for cell, w in zip(row, widths):
            pdf.cell(w, 6, " " + cell, fill=True)
        pdf.ln(6)
    pdf.ln(2)
    pdf.set_text_color(*INK)
    pdf.set_auto_page_break(True, margin=16)


# cover
pdf.set_fill_color(*PINE)
pdf.rect(0, 0, 210, 58, "F")
pdf.set_xy(16, 16)
pdf.set_text_color(255, 255, 255)
pdf.set_font("Helvetica", "", 11)
mc(6, "DEPLOY PROCEDURE")
pdf.set_text_color(255, 255, 255)
pdf.set_font("Helvetica", "B", 22)
mc(10, "RelayMart")
pdf.set_text_color(255, 255, 255)
pdf.set_font("Helvetica", "", 12)
mc(6, "From clone to Compose, two servers, ECR, ECS, and EKS")
pdf.set_text_color(*INK)
pdf.set_y(66)
body(
    "Follow the parts in order. Part A proves the application on one server. "
    "Part B splits the frontend onto a second server. Parts C, D, and E move the same images to AWS. "
    "Do not open ECS until the Compose health check and a register call have succeeded."
)

h1("1. What gets deployed")
body("The browser loads the shop from the frontend. The page then calls only the API gateway. The gateway calls the backend services. Services do not call each other, except by publishing events to RabbitMQ.")
table(
    [
        ["Piece", "Where it runs", "Port"],
        ["Frontend shop", "its own server, or with the stack", "4173"],
        ["API gateway", "backend server", "4000"],
        ["15 backend services", "backend server", "4001-4015"],
        ["Postgres, Redis, RabbitMQ", "backend server", "not public"],
        ["Kibana", "backend server", "5601"],
        ["Grafana", "backend server", "3000"],
    ],
    [62, 78, 38],
)
body("Images, one each: frontend, gateway, catalog, search, pricing, inventory, cart, order, payment, shipping, review, user, notification, recommendation, auth, verification, tracking.")
body("You do not edit service source to deploy. The only values you set are URLs, the RDS password, and AWS identifiers.")

h1("2. Install on the server")
h2("Size")
bullet("One server for everything: 4 GB RAM minimum, 8 GB if Kibana must stay up. 30 GB disk.")
bullet("Two servers: backend 4 GB or more. Frontend 1 GB is enough.")
bullet("Ubuntu 22.04 or Amazon Linux 2023. Open SSH from your IP only.")
h2("Ubuntu")
code("sudo apt-get update\nsudo apt-get install -y docker.io docker-compose-v2 git\nsudo usermod -aG docker $USER")
h2("Amazon Linux 2023")
code("sudo dnf update -y\nsudo dnf install -y docker git\nsudo systemctl enable --now docker\nsudo usermod -aG docker ec2-user\nsudo mkdir -p /usr/libexec/docker/cli-plugins\nVER=v2.32.4\nsudo curl -fsSL -o /tmp/docker-compose \\\n  https://github.com/docker/compose/releases/download/${VER}/docker-compose-linux-x86_64\nsudo mv /tmp/docker-compose /usr/libexec/docker/cli-plugins/docker-compose\nsudo chmod +x /usr/libexec/docker/cli-plugins/docker-compose")
body("Log out and SSH back in. Then check:")
code("docker version\ndocker compose version\ngit --version")
expect("Both docker and docker compose print a version. If compose is missing, the rest of this guide will fail.")
body("Node, Terraform, and kubectl are not required for Parts A and B. Install Terraform 1.6+ before Part D. Install kubectl and the AWS CLI before Part E. The AWS CLI is also required for Part C.")

h1("3. Ports")
table(
    [
        ["Server", "Port", "Who can connect"],
        ["Frontend", "4173", "your users"],
        ["Backend", "4000", "your users, because the browser calls it"],
        ["Backend", "5601", "you, for Kibana"],
        ["Backend", "3000", "you, for Grafana"],
        ["Backend", "22", "you"],
        ["Backend", "5432 6379 5672", "nobody on the internet"],
    ],
    [40, 48, 90],
)
body("5432, 6379, and 5672 are used only on the Docker network. Do not add them to the security group.")

h1("4. Clone")
step(1, "Put the repository on the server", "Clone the same repository on every server that will run a piece of RelayMart.")
code("git clone https://github.com/YOUR_USER/relaymart.git\ncd relaymart\nls docker-compose.yml docker-compose.frontend.yml scripts/up-backend.sh")
expect("All three paths exist. If docker-compose.yml is inside APP, cd APP and stay there. Every command below assumes that directory.")
body("Do not copy node_modules from a laptop. The Dockerfiles install dependencies inside the image.")

h1("5. Values you set, and values you leave alone")
h2("Leave these alone for Compose")
bullet("Service ports, Docker network names, and the files under services/ and gateway/.")
bullet("db/init.sql. Compose loads it into Postgres on first start.")
bullet("Postgres user relay, database relaymart, and RabbitMQ user relay. They match the Compose file.")
h2("Set this when the browser is not on the server")
body("GATEWAY_PUBLIC_URL is the address the shopper's browser uses to reach the gateway. It is not a Docker hostname.")
code("GATEWAY_PUBLIC_URL=http://BACKEND_PUBLIC_IP:4000")
body("Use http://127.0.0.1:4000 only when you open the shop on the server itself, or through an SSH tunnel to your laptop.")
h2("Set these only for ECS and EKS")
bullet("image_prefix: 123456789012.dkr.ecr.ap-south-1.amazonaws.com/relaymart")
bullet("database_url: postgres://relay:PASSWORD@RDS_ENDPOINT:5432/relaymart")
bullet("redis_url: redis://ELASTICACHE_ENDPOINT:6379")
bullet("rabbit_url: leave empty until you have a broker, or set amqp://user:pass@host:5672")
bullet("vpc_id, subnet_ids, and the ECS task execution role ARN")
bullet("In deploy/ecs/elasticache.tf, replace the placeholder RDS password before the first apply.")
bullet("In deploy/eks/render.mjs, replace the Compose hostnames in DATABASE_URL, REDIS_URL, and RABBIT_URL, then render again.")

h1("6. Part A. One server")
step(2, "Start the full stack", "This builds 17 images and starts Postgres, Redis, RabbitMQ, Elasticsearch, Kibana, Prometheus, and Grafana.")
code("docker compose up --build -d\ndocker compose ps")
expect("gateway, auth, postgres, redis, and rabbitmq become healthy. Elasticsearch can take two minutes. The first build is the slow part.")
body("If auth or tracking restarts:")
code("docker compose logs --tail 80 auth tracking postgres")
step(3, "Prove the gateway", "")
code("curl -s http://127.0.0.1:4000/health")
expect('{"ok":true,"service":"gateway"}')
step(4, "Open the shop", "From your laptop use http://PUBLIC_IP:4173. If the page loads but register fails, the shop is still calling 127.0.0.1. Recreate the frontend with the public URL:")
code("GATEWAY_PUBLIC_URL=http://PUBLIC_IP:4000 docker compose up -d frontend")
step(5, "Register, verify, log in, and track", "Use a new email if you run register more than once.")
code("curl -s -X POST http://127.0.0.1:4000/api/register \\\n  -H 'content-type: application/json' \\\n  -d '{\"name\":\"Asha Menon\",\"email\":\"asha@example.com\",\"mobile\":\"9845012345\",\"password\":\"Relaymart123\"}'")
expect("HTTP 201 and a user id.")
code("curl -s -X POST http://127.0.0.1:4000/api/verify/email/send \\\n  -H 'content-type: application/json' \\\n  -d '{\"email\":\"asha@example.com\"}'\ndocker compose logs --tail 30 verification")
expect("A JSON line msg otp_issued with a 6-digit code. It expires in 300 seconds. It is not sent as email.")
code("curl -s -X POST http://127.0.0.1:4000/api/verify/email/confirm \\\n  -H 'content-type: application/json' \\\n  -d '{\"email\":\"asha@example.com\",\"code\":\"THE_CODE\"}'")
body("Repeat send and confirm for the mobile. Login is rejected until both succeed.")
code("curl -s -X POST http://127.0.0.1:4000/api/verify/mobile/send \\\n  -H 'content-type: application/json' \\\n  -d '{\"mobile\":\"9845012345\"}'\ndocker compose logs --tail 20 verification\ncurl -s -X POST http://127.0.0.1:4000/api/verify/mobile/confirm \\\n  -H 'content-type: application/json' \\\n  -d '{\"mobile\":\"9845012345\",\"code\":\"THE_CODE\"}'\ncurl -s -X POST http://127.0.0.1:4000/api/login \\\n  -H 'content-type: application/json' \\\n  -d '{\"email\":\"asha@example.com\",\"password\":\"Relaymart123\"}'")
expect("A token. invalid_login means the password did not match. verification_required means an OTP is still missing.")
code("curl -s -X POST http://127.0.0.1:4000/api/tracking/shipments \\\n  -H 'content-type: application/json' \\\n  -d '{\"orderId\":\"ord_demo\",\"pincode\":\"560001\"}'")
body("Copy the id, which starts with trk_, into the scan call.")
code("curl -s -X POST http://127.0.0.1:4000/api/tracking/shipments/trk_ab12cd34/scan \\\n  -H 'content-type: application/json' \\\n  -d '{\"status\":\"picked_up\",\"note\":\"hub scan\"}'")
code("curl -s -X POST http://127.0.0.1:4000/api/checkout \\\n  -H 'content-type: application/json' \\\n  -d '{\"lines\":[{\"productId\":\"meadow-tee\",\"qty\":1}],\"method\":\"upi\",\"pincode\":\"560001\",\"coupon\":\"STUDIO\"}'")
expect("HTTP 201, an order id, and a trace. STUDIO takes 100 off an order from 999.")
step(6, "Read the logs in Kibana", "Open http://PUBLIC_IP:5601. Create a data view named relaymart, index relaymart-*, time field @timestamp. In Discover, last 15 minutes:")
code('service: "verification" and msg: "otp_issued"')
expect("The same code you read from docker compose logs. Also filter service auth and msg login, and service tracking and msg scan.")
body("Grafana is on port 3000. The user is admin. The password is GF_SECURITY_ADMIN_PASSWORD in docker-compose.yml. RabbitMQ management is on port 15672, user relay, password relay. Prometheus is on port 9090. Query http_requests_total.")

h1("7. Part B. Frontend on one server, backend on another")
body("Clone the repository on both machines. Do not change service code. The browser downloads the page from server 1 and then calls server 2 on port 4000. The frontend process does not proxy those API calls, so server 2 must accept port 4000 from the internet, not only from server 1.")
step(7, "Start the backend", "On the larger server. This starts the gateway, all 15 services, Postgres, Redis, RabbitMQ, and the log stack. It does not start the shop.")
code("sh scripts/up-backend.sh\ndocker compose ps\ncurl -s http://127.0.0.1:4000/health")
expect("ok true, and no frontend container in docker compose ps.")
step(8, "Start the frontend", "On the second server. Replace the IP with the backend public IP.")
code("GATEWAY_PUBLIC_URL=http://BACKEND_PUBLIC_IP:4000 sh scripts/up-frontend.sh")
expect("A frontend container listening on 4173.")
step(9, "Prove the split", "On your laptop open http://FRONTEND_PUBLIC_IP:4173 and register. If the button fails, the page is calling the wrong host. On the frontend server check the value that was baked into the page:")
code("docker logs $(docker ps -q --filter name=frontend) | head")
body("The running process does not print the URL on each request. Trust the environment you passed. Recreate the container if you change it:")
code("GATEWAY_PUBLIC_URL=http://BACKEND_PUBLIC_IP:4000 \\\n  docker compose -f docker-compose.frontend.yml up -d --force-recreate")
body("Then repeat the register, OTP, login, tracking, and checkout calls from Part A against http://BACKEND_PUBLIC_IP:4000. Read OTP codes on the backend server:")
code("docker compose logs --tail 30 verification")

h1("8. Part C. Push images to ECR")
body("Run this on a machine that already has Docker and the AWS CLI, after Part A is healthy. The script creates 17 repositories and pushes the tag latest.")
step(10, "Confirm the AWS identity", "")
code("aws sts get-caller-identity")
expect("Your account id and the user or role you expect.")
step(11, "Build and push", "Replace the account and region.")
code("AWS_ACCOUNT_ID=123456789012 AWS_REGION=ap-south-1 sh scripts/ecr-push.sh")
step(12, "Count the repositories", "")
code("aws ecr describe-repositories --region ap-south-1 \\\n  --query 'repositories[?starts_with(repositoryName, `relaymart/`)].repositoryName' \\\n  --output text")
expect("Seventeen names, frontend through tracking.")
body("The prefix for Terraform and for EKS is:")
code("123456789012.dkr.ecr.ap-south-1.amazonaws.com/relaymart")
body("The IAM user needs ecr:GetAuthorizationToken, ecr:CreateRepository, ecr:DescribeRepositories, and ecr:PutImage, plus the layer upload actions. The ECS execution role needs permission to pull from these repositories and to write the log group /relaymart/mesh.")

h1("9. Part D. Database and cache on AWS")
body("Compose created Postgres and Redis for you. ECS and EKS do not. On AWS, Postgres is RDS and Redis is ElastiCache. RabbitMQ is not created by the Terraform in this repository. Leave rabbit_url empty until you have Amazon MQ or your own broker. Auth and verification still run without it. Events are then not published.")
step(13, "Set the RDS password", "Open deploy/ecs/elasticache.tf and replace the placeholder password. Do this before apply.")
step(14, "Create the data services and the cluster", "From deploy/ecs. You need a VPC, two subnets, and an ECS task execution role. Auth will fail on this first apply because the database URL is still empty. That is expected.")
code("cd deploy/ecs\nterraform init\nterraform apply \\\n  -var vpc_id=vpc-xxxx \\\n  -var 'subnet_ids=[\"subnet-a\",\"subnet-b\"]' \\\n  -var execution_role_arn=arn:aws:iam::123456789012:role/ecsTaskExecutionRole \\\n  -var image_prefix=123456789012.dkr.ecr.ap-south-1.amazonaws.com/relaymart \\\n  -var create_rds=true \\\n  -var create_elasticache=true")
code("terraform output rds_endpoint\nterraform output elasticache_endpoint")
step(15, "Load the schema", "Compose did this. RDS does not.")
code("psql \"postgres://relay:YOUR_PASSWORD@RDS_ENDPOINT:5432/relaymart\" \\\n  -f ../../db/init.sql")
expect("Tables users, payments, shipments, and tracking_events.")
body("The security group in this Terraform allows 5432 and 6379 from 10.0.0.0/8. A database outside that range will not match, and auth will keep restarting.")

h1("10. Part E. ECS")
step(16, "Apply with the real URLs", "Leave elasticsearch_host empty the first time. Logs stay in CloudWatch. Set it later to a host the tasks can reach on port 9200.")
code("terraform apply \\\n  -var vpc_id=vpc-xxxx \\\n  -var 'subnet_ids=[\"subnet-a\",\"subnet-b\"]' \\\n  -var execution_role_arn=arn:aws:iam::123456789012:role/ecsTaskExecutionRole \\\n  -var image_prefix=123456789012.dkr.ecr.ap-south-1.amazonaws.com/relaymart \\\n  -var database_url='postgres://relay:YOUR_PASSWORD@RDS_ENDPOINT:5432/relaymart' \\\n  -var redis_url='redis://ELASTICACHE_ENDPOINT:6379' \\\n  -var rabbit_url='' \\\n  -var elasticsearch_host=''")
expect("Cluster relaymart. One Fargate service per image. Names resolve as gateway.relaymart.local and auth.relaymart.local inside the VPC. frontend and gateway receive a public IP. The others do not.")
step(17, "Wait until the desired count is running", "")
code("aws ecs describe-services --cluster relaymart --region ap-south-1 \\\n  --services auth gateway frontend \\\n  --query 'services[].{name:serviceName,running:runningCount,desired:desiredCount}'")
expect("running equals desired. gateway and frontend want 2. auth wants 1.")
step(18, "Call the public gateway", "Find the network interface, then its public IPv4 address in EC2.")
code("TASK=$(aws ecs list-tasks --cluster relaymart --service-name gateway \\\n  --region ap-south-1 --query 'taskArns[0]' --output text)\naws ecs describe-tasks --cluster relaymart --tasks \"$TASK\" \\\n  --region ap-south-1 --query 'tasks[0].attachments[0].details'")
code("curl -s http://GATEWAY_PUBLIC_IP:4000/health")
body("Repeat the Part A register, OTP, login, tracking, and checkout calls against that IP. The frontend task also has a public IP on port 4173. Its GATEWAY_PUBLIC_URL inside the task is the Cloud Map name, which a laptop cannot resolve. For a public shop, point the frontend task environment at http://GATEWAY_PUBLIC_IP:4000 and open port 4173 in the security group to your users.")
step(19, "Read ECS logs", "")
code("aws logs tail /relaymart/mesh --region ap-south-1 --follow \\\n  --filter-pattern otp_issued")
expect("The same otp_issued JSON line.")
body("When you set elasticsearch_host, Terraform adds a Fluent Bit sidecar on every task and ships logs to that host, index prefix relaymart. The sample uses TLS off. Use TLS for Amazon OpenSearch. CloudWatch still stores the sidecar's own logs.")

h1("11. Part F. EKS")
body("The node role must be able to pull from ECR. AmazonEC2ContainerRegistryReadOnly on the node role is enough.")
step(20, "Point the manifests at ECR", "IMAGE_PREFIX has no trailing slash and no service name. Run this from the repository root, not from deploy/ecs.")
code("IMAGE_PREFIX=123456789012.dkr.ecr.ap-south-1.amazonaws.com/relaymart \\\n  node deploy/eks/render.mjs\nkubectl apply -f deploy/eks/mesh.yaml")
expect("Namespace relaymart. One Deployment and one Service per image. The gateway has 2 replicas and an autoscaler. The Ingress host is relaymart.local.")
step(21, "Point data URLs at RDS and ElastiCache", "Edit DATABASE_URL, REDIS_URL, and RABBIT_URL in deploy/eks/render.mjs. The file ships with the Compose hostnames. Render again and apply again. Rollouts follow.")
code("kubectl -n relaymart rollout status deploy/auth\nkubectl -n relaymart rollout status deploy/gateway\nkubectl -n relaymart get deploy")
step(22, "Prove it", "")
code("kubectl -n relaymart port-forward svc/gateway 4000:4000")
body("In a second terminal, repeat the Part A curls against http://127.0.0.1:4000. A 201 from register means the pod reached RDS. Port-forward svc/frontend 4173:4173 for the shop. If you use the Ingress, map relaymart.local to the load balancer and keep GATEWAY_PUBLIC_URL equal to the URL the browser will call.")

h1("12. Part G. Logs on EKS")
step(23, "Install Elasticsearch, Kibana, and Fluent Bit", "Elasticsearch requests 1 GB. A node smaller than that leaves the pod Pending.")
code("kubectl apply -f deploy/eks/efk.yaml\nkubectl -n logging get pods")
expect("elasticsearch and kibana Running, and one fluent-bit pod on each node.")
step(24, "Open Kibana and confirm a live line", "")
code("kubectl -n logging port-forward svc/kibana 5601:5601")
body("Create the data view relaymart-* again. Send another email OTP through the gateway port-forward. In Discover:")
code('service: "verification" and msg: "otp_issued"')
expect("A new line within a few seconds. That is the deploy: ECR images on EKS, and the log in Kibana.")
code("kubectl -n logging logs daemonset/fluent-bit --tail 30")
body("Prometheus is separate. The Deployments are annotated for a scrape on /metrics. Install a Prometheus stack in the cluster if you want the same Grafana boards you used on port 3000.")

h1("13. Done when all of these pass")
table(
    [
        ["Check", "Pass"],
        ["docker compose ps", "auth, gateway, postgres, redis healthy"],
        ["GET /health on :4000", "ok true"],
        ["POST /api/register", "201 and a user id"],
        ["verification log", "otp_issued, then confirm returns verified"],
        ["POST /api/login", "a token after both codes"],
        ["POST /api/checkout", "201 and a trace"],
        ["ECR", "17 relaymart repositories"],
        ["ECS services", "running count equals desired"],
        ["kubectl get deploy -n relaymart", "ready"],
        ["Kibana relaymart-*", "otp_issued from that environment"],
    ],
    [78, 100],
)

h1("14. When it fails")
h2("auth restarts")
body("DATABASE_URL is wrong, the security group blocks 5432, or init.sql was not loaded. Read docker compose logs auth or the ECS stopped-task reason.")
h2("The shop page loads and every button fails")
body("GATEWAY_PUBLIC_URL is 127.0.0.1 or a Docker name. Set it to the public gateway URL and recreate the frontend.")
h2("Login returns verification_required")
body("Confirm email and mobile. Registering the same email again returns email_or_mobile_taken.")
h2("Kibana is empty but docker compose logs shows JSON")
body("Fluent Bit on Compose reads /var/lib/docker/containers. Another container runtime will not match that path. On EKS, the fluent-bit DaemonSet must be Running and must see /var/log/containers.")
h2("ECS CannotPullContainerError")
body("image_prefix does not match the account that owns the repositories, or the execution role cannot pull from ECR.")
h2("EKS image pull fails")
body("The node role cannot read ECR, or render.mjs was run without IMAGE_PREFIX, so the manifest still says relaymart/frontend:latest.")
h2("elasticsearch Pending")
body("The node does not have 1 GB free. Use a larger node, or lower the memory request in deploy/eks/efk.yaml.")

h1("15. Stop")
code("docker compose down -v")
body("On the frontend server:")
code("docker compose -f docker-compose.frontend.yml down")
body("ECS, RDS, and ElastiCache. This deletes the RDS database. The file sets skip_final_snapshot, so there is no snapshot.")
code("cd deploy/ecs\nterraform destroy")
code("kubectl delete -f deploy/eks/mesh.yaml\nkubectl delete -f deploy/eks/efk.yaml")

h1("16. Order of work")
bullet("Install Docker and clone.")
bullet("Part A on one server until register, both codes, login, tracking, and checkout pass.")
bullet("Part B only if the shop and the API must be on different machines.")
bullet("Part C after Part A. Push the images that you already proved.")
bullet("Part D, then Part E. Load init.sql before you expect auth to stay up.")
bullet("Part F and Part G when the target is Kubernetes. Kibana is the last check, not the first.")

pdf.output(OUT)
print(OUT, "pages", pdf.page)
