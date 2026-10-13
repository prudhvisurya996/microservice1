#!/usr/bin/env python3
"""RelayMart runbook: clone through Kibana."""

from fpdf import FPDF

OUT = "/workspace/public/RelayMart-DevOps-Lifecycle.pdf"
INK = (28, 36, 48)
PINE = (31, 107, 74)
MUTED = (90, 98, 108)
PAPER = (244, 239, 230)
CODE_BG = (23, 32, 42)
CODE_FG = (231, 238, 246)
WHITE = (255, 253, 248)


class Doc(FPDF):
    def header(self):
        if self.page_no() == 1:
            return
        self.set_fill_color(*PINE)
        self.rect(0, 0, 210, 9, "F")
        self.set_xy(16, 2.5)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(255, 255, 255)
        self.cell(170, 5, "RelayMart   DevOps lifecycle   clone to monitoring")
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
    pdf.ln(2)
    pdf.set_font("Helvetica", "B", 15)
    pdf.set_text_color(*PINE)
    mc(7.5, text)
    y = pdf.get_y()
    pdf.set_draw_color(*PINE)
    pdf.set_line_width(0.4)
    pdf.line(16, y, 194, y)
    pdf.ln(3)
    pdf.set_text_color(*INK)


def h2(text):
    pdf.ln(1)
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(*INK)
    mc(6.2, text)
    pdf.ln(0.6)


def body(text):
    pdf.set_font("Helvetica", "", 10.5)
    pdf.set_text_color(*INK)
    mc(5.3, text)
    pdf.ln(1.2)


def bullet(text):
    pdf.set_font("Helvetica", "", 10.5)
    pdf.set_text_color(*INK)
    mc(5.2, "-  " + text)


def step(n, title, text):
    pdf.ln(0.4)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(*PINE)
    mc(6, f"Step {n}.  {title}")
    if text:
        body(text)


def code(text):
    pdf.ln(0.4)
    pdf.set_font("Courier", "", 8)
    pdf.set_fill_color(*CODE_BG)
    pdf.set_text_color(*CODE_FG)
    for raw in text.split("\n"):
        line = raw
        while len(line) > 86:
            pdf.set_x(16)
            pdf.cell(0, 4.2, "  " + line[:86], new_x="LMARGIN", new_y="NEXT", fill=True)
            line = "  " + line[86:]
        pdf.set_x(16)
        pdf.cell(0, 4.2, "  " + line, new_x="LMARGIN", new_y="NEXT", fill=True)
    pdf.ln(2)
    pdf.set_text_color(*INK)


def expect(text):
    pdf.set_font("Helvetica", "I", 10)
    pdf.set_text_color(40, 80, 60)
    mc(5, "Expected: " + text)
    pdf.ln(1.4)
    pdf.set_text_color(*INK)


def table(rows, widths):
    pdf.set_auto_page_break(False)
    for i, row in enumerate(rows):
        if pdf.get_y() + 8 > 278:
            pdf.add_page()
            pdf.set_xy(16, 16)
        pdf.set_fill_color(*(PINE if i == 0 else (WHITE if i % 2 else PAPER)))
        pdf.set_text_color(*(WHITE if i == 0 else INK))
        pdf.set_font("Helvetica", "B" if i == 0 else "", 8)
        pdf.set_x(16)
        for cell, w in zip(row, widths):
            pdf.cell(w, 6.2, " " + cell, border=0, fill=True)
        pdf.ln(6.2)
    pdf.ln(2)
    pdf.set_text_color(*INK)
    pdf.set_auto_page_break(True, margin=16)


pdf.set_fill_color(*PINE)
pdf.rect(0, 0, 210, 64, "F")
pdf.set_xy(16, 18)
pdf.set_text_color(255, 255, 255)
pdf.set_font("Helvetica", "", 11)
mc(6, "DEVOPS RUNBOOK")
pdf.set_text_color(255, 255, 255)
pdf.set_font("Helvetica", "B", 26)
mc(11, "RelayMart")
pdf.set_text_color(255, 255, 255)
pdf.set_font("Helvetica", "", 13)
mc(6.5, "DevOps lifecycle")
pdf.set_text_color(255, 255, 255)
mc(6.5, "from the clone to live monitoring")
pdf.set_text_color(*INK)
pdf.set_y(72)
body(
    "This is the procedure for the RelayMart services in the APP folder. "
    "Clone the source, prove it with Docker Compose, push one image per service to ECR, "
    "run those same images on ECS and on EKS, and read the logs in Kibana."
)
body("Do the phases in order. Do not open ECS until Compose and Kibana have already shown a register and an OTP.")

h2("The ten phases")
for line in [
    "1   Get the source onto the server",
    "2   See how frontend, API, and backend are split",
    "3   Start the stack with Docker Compose",
    "4   Prove register, email OTP, mobile OTP, login, tracking, and checkout",
    "5   Watch those events in Kibana, Grafana, and RabbitMQ",
    "6   Build one Docker image per service",
    "7   Push every image to Amazon ECR",
    "8   Put Postgres and Redis on AWS (RDS and ElastiCache)",
    "9   Run the images on ECS, then run the same images on EKS",
    "10  Stream logs with EFK and confirm monitoring",
]:
    bullet(line)
pdf.ln(2)

h1("1. What you are deploying")
body(
    "The browser opens the frontend. The frontend calls only the API gateway. "
    "The gateway calls the backend services. Services publish events to RabbitMQ. "
    "Every process writes JSON to stdout. Fluent Bit reads those lines into Elasticsearch. Kibana is where you read them."
)
table(
    [
        ["Layer", "Service", "Port", "Image"],
        ["Frontend", "frontend", "4173", "relaymart/frontend"],
        ["API", "gateway", "4000", "relaymart/gateway"],
        ["Backend", "catalog search pricing inventory cart order", "4001-4006", "one image each"],
        ["Backend", "payment", "4007", "relaymart/payment"],
        ["Backend", "shipping review user notification recommendation", "4008-4012", "one image each"],
        ["Backend", "auth   register and login", "4013", "relaymart/auth"],
        ["Backend", "verification   email and mobile OTP", "4014", "relaymart/verification"],
        ["Backend", "tracking", "4015", "relaymart/tracking"],
        ["Data", "Postgres", "5432", "users, payments, shipments"],
        ["Data", "Redis (ElastiCache on AWS)", "6379", "sessions and OTP"],
        ["Data", "RabbitMQ", "5672", "events between services"],
        ["Logs", "Fluent Bit, Elasticsearch, Kibana", "5601", "index relaymart-*"],
        ["Metrics", "Prometheus and Grafana", "9090 / 3000", "scrapes /metrics"],
    ],
    [28, 78, 28, 44],
)
body("RabbitMQ routing keys: user.registered, otp.email, otp.mobile, payment.authorized, tracking.updated.")
body(
    "Honest limits. Payment writes an authorized row. It does not call a bank. "
    "Email and mobile codes are not sent by SES or SNS. They sit in Redis for five minutes, "
    "go out on RabbitMQ, and are printed in the verification log so Kibana can show them. "
    "Elasticsearch here is one node with security off. Use Amazon OpenSearch in production."
)

h1("2. What to install first")
body("On the Compose machine:")
bullet("Docker Engine 24 or newer, with docker compose version.")
bullet("The unzipped APP folder.")
bullet("Node.js 22 only if you want the checkout smoke test without Docker.")
body("On the deploy machine, also:")
bullet("AWS CLI v2. aws sts get-caller-identity must succeed.")
bullet("Terraform 1.6 or newer, for ECS.")
bullet("kubectl pointed at your EKS cluster, for the EKS phase only.")
body("You do not need AWS for the Compose test. You need it from the ECR phase onward: a VPC, two subnets, and an ECS task execution role that can pull from ECR and write CloudWatch logs.")

h1("3. Get the source")
step(1, "Copy the project onto the server", "Unzip RelayMart-source.zip. Work inside APP. Every command below assumes that directory unless it says otherwise.")
code("cd APP\nls")
expect("You see docker-compose.yml, frontend, gateway, services, db, observability, deploy, and scripts.")
step(2, "Confirm one Dockerfile per service", "Each process is its own image. That file is the build contract.")
code("ls frontend/Dockerfile gateway/Dockerfile\nls services/auth/Dockerfile services/verification/Dockerfile\nls services/payment/Dockerfile services/tracking/Dockerfile")
expect("Each path exists. scripts/ecr-push.sh builds all of them.")
body("Folders you use later:")
bullet("db/init.sql creates users, payments, shipments, and tracking_events. Compose applies it. RDS does not.")
bullet("observability/fluent-bit is the Compose log shipper.")
bullet("deploy/ecs/main.tf is the Fargate mesh. deploy/ecs/elasticache.tf is optional RDS and ElastiCache.")
bullet("deploy/eks/mesh.yaml is the Kubernetes mesh. deploy/eks/efk.yaml is Elasticsearch, Kibana, and Fluent Bit.")
bullet("docs/RelayMart-DevOps-Lifecycle.pdf is this runbook.")

h1("4. Start it with Docker Compose")
step(3, "Build and start every container", "The first start is slow. Each image runs npm install, and Elasticsearch needs memory.")
code("docker compose up --build")
body("After the first good start you can detach:")
code("docker compose up --build -d")
step(4, "Wait until the app containers are healthy", "Do not call the API while auth or elasticsearch is still starting.")
code("docker compose ps")
expect("frontend, gateway, the backends, postgres, redis, and rabbitmq are healthy. Elasticsearch can take a minute. Kibana waits for it.")
body("If auth, verification, or tracking is restarting:")
code("docker compose logs --tail 80 auth verification tracking")
h2("Addresses on the server")
table(
    [
        ["What", "URL", "Login"],
        ["Shop UI", "http://127.0.0.1:4173", "none"],
        ["API gateway", "http://127.0.0.1:4000", "none"],
        ["Kibana", "http://127.0.0.1:5601", "security off"],
        ["RabbitMQ", "http://127.0.0.1:15672", "relay / relay"],
        ["Grafana", "http://127.0.0.1:3000", "admin / see compose file"],
        ["Prometheus", "http://127.0.0.1:9090", "none"],
    ],
    [36, 78, 64],
)
body("If you are on a laptop and the stack is on a server, tunnel the ports with ssh -L.")

h1("5. Prove the application")
body("This is the gate. If these calls fail, stop. Do not push images and do not apply Terraform. Use a new email if you register twice.")
step(5, "Register a shopper", "Auth writes the user in Postgres and publishes user.registered.")
code("curl -s -X POST http://127.0.0.1:4000/api/register \\\n  -H 'content-type: application/json' \\\n  -d '{\"name\":\"Asha Menon\",\"email\":\"asha@example.com\",\"mobile\":\"9845012345\",\"password\":\"Relaymart123\"}'")
expect("HTTP 201 and a user id. Login is refused until both OTPs are confirmed.")
step(6, "Send the email code", "Verification stores a 6-digit code in Redis and prints it to stdout.")
code("curl -s -X POST http://127.0.0.1:4000/api/verify/email/send \\\n  -H 'content-type: application/json' \\\n  -d '{\"email\":\"asha@example.com\"}'\ndocker compose logs --tail 40 verification")
expect('A JSON line with msg otp_issued, channel email, and code. The code expires in 300 seconds.')
step(7, "Confirm the email", "Replace THE_CODE with the six digits from that log.")
code("curl -s -X POST http://127.0.0.1:4000/api/verify/email/confirm \\\n  -H 'content-type: application/json' \\\n  -d '{\"email\":\"asha@example.com\",\"code\":\"THE_CODE\"}'")
expect("verified true, and account.ok true. Auth has marked the email verified in Postgres.")
step(8, "Send and confirm the mobile code", "Login stays blocked until this succeeds.")
code("curl -s -X POST http://127.0.0.1:4000/api/verify/mobile/send \\\n  -H 'content-type: application/json' \\\n  -d '{\"mobile\":\"9845012345\"}'\ndocker compose logs --tail 20 verification\ncurl -s -X POST http://127.0.0.1:4000/api/verify/mobile/confirm \\\n  -H 'content-type: application/json' \\\n  -d '{\"mobile\":\"9845012345\",\"code\":\"THE_CODE\"}'")
step(9, "Log in", "Auth checks the password and both verified flags, then stores a session in Redis.")
code("curl -s -X POST http://127.0.0.1:4000/api/login \\\n  -H 'content-type: application/json' \\\n  -d '{\"email\":\"asha@example.com\",\"password\":\"Relaymart123\"}'")
expect("A token and the user. A wrong password returns invalid_login. A missing OTP returns verification_required.")
step(10, "Create a shipment and scan it", "Tracking writes Postgres rows and publishes tracking.updated.")
code("curl -s -X POST http://127.0.0.1:4000/api/tracking/shipments \\\n  -H 'content-type: application/json' \\\n  -d '{\"orderId\":\"ord_demo\",\"pincode\":\"560001\"}'")
body("Copy the id (trk_ followed by 8 characters) into the next call.")
code("curl -s -X POST http://127.0.0.1:4000/api/tracking/shipments/trk_ab12cd34/scan \\\n  -H 'content-type: application/json' \\\n  -d '{\"status\":\"picked_up\",\"note\":\"hub scan\"}'")
expect("status picked_up and two events. Allowed: created, picked_up, in_transit, out_for_delivery, delivered.")
step(11, "Place an order through the gateway", "This saga prices, reserves stock, gets an ETA, authorizes payment, creates the order, and notifies.")
code("curl -s -X POST http://127.0.0.1:4000/api/checkout \\\n  -H 'content-type: application/json' \\\n  -d '{\"lines\":[{\"productId\":\"meadow-tee\",\"qty\":1}],\"method\":\"upi\",\"pincode\":\"560001\",\"coupon\":\"STUDIO\"}'")
expect("HTTP 201, an order id, and a trace of about nine hops. Coupon STUDIO takes 100 off an order from 999.")
body("The shop page on port 4173 does the same register, verify, login, and tracking clicks. Read the OTP from the verification log, not from an inbox.")

h1("6. Monitor it locally")
body("Local monitoring is the same pipeline you will use on EKS. Prove it here.")
step(12, "Create the Kibana data view", "Open http://127.0.0.1:5601. Stack Management, Data Views, Create data view.")
bullet("Name: relaymart")
bullet("Index pattern: relaymart-*")
bullet("Timestamp field: @timestamp")
body("Open Discover. Set the time picker to the last 15 minutes. If it is empty, send one more OTP and refresh.")
step(13, "Filter the log stream", "Paste these into the Discover search bar.")
code('service: "verification" and msg: "otp_issued"\nservice: "auth" and msg: "login"\nservice: "tracking" and msg: "scan"\nservice: "payment" and msg: "recorded"\nservice: "notification" and msg: "delivered"')
expect("otp_issued shows the address and the code. delivered means notification consumed the RabbitMQ message. If Discover is empty but docker compose logs shows JSON, Fluent Bit is not reading the Docker log files. See the fault list.")
step(14, "Check the other consoles", "")
bullet("RabbitMQ on port 15672, user relay, password relay. Queues should include notification.otp.email, notification.otp.mobile, notification.tracking.updated, notification.payment.authorized, and notification.user.registered.")
bullet("Grafana on port 3000. User admin. Password is GF_SECURITY_ADMIN_PASSWORD in docker-compose.yml. Grafana reads Prometheus.")
bullet("Prometheus on port 9090. Query http_requests_total. The gateway count must have moved after your curls.")
code("docker compose logs -f gateway verification auth")

h1("7. Build one image per service")
step(15, "Build and list the images", "Compose already built them if you used --build. This script tags them relaymart/<service>:local.")
code("sh scripts/build-images.sh\ndocker images | grep relaymart")
expect("Seventeen images: frontend, gateway, catalog, search, pricing, inventory, cart, order, payment, shipping, review, user, notification, recommendation, auth, verification, tracking.")
body("That image list is the only artifact that moves to AWS. ECS and EKS run these images. They do not compile the app a second way.")

h1("8. Push the images to ECR")
step(16, "Create the repositories and push", "The script creates relaymart/<service> if it is missing, then pushes the tag latest.")
code("aws sts get-caller-identity\nAWS_ACCOUNT_ID=123456789012 AWS_REGION=ap-south-1 sh scripts/ecr-push.sh")
body("Replace the account and region. The script logs Docker in to ECR.")
step(17, "Count the repositories", "")
code("aws ecr describe-repositories --region ap-south-1 \\\n  --query 'repositories[?starts_with(repositoryName, `relaymart/`)].repositoryName' \\\n  --output text")
expect("Seventeen names, from relaymart/frontend through relaymart/tracking.")
body("The prefix you paste into Terraform and into the EKS renderer is:")
code("123456789012.dkr.ecr.ap-south-1.amazonaws.com/relaymart")
body("A full image looks like that prefix, then /auth:latest.")

h1("9. Data services on AWS")
body("Compose started Postgres, Redis, and RabbitMQ for you. ECS and EKS do not. On AWS, Redis is ElastiCache and Postgres is RDS. The broker can be Amazon MQ, or a RabbitMQ you run yourself.")
step(18, "Change the RDS password first", "Open deploy/ecs/elasticache.tf and replace the placeholder database password before the first apply.")
step(19, "Create RDS and ElastiCache", "From deploy/ecs. This apply also starts the ECS services. Auth will fail until you set the database URL. That is expected on this pass.")
code("cd deploy/ecs\nterraform init\nterraform apply \\\n  -var vpc_id=vpc-xxxx \\\n  -var 'subnet_ids=[\"subnet-a\",\"subnet-b\"]' \\\n  -var execution_role_arn=arn:aws:iam::123456789012:role/ecsTaskExecutionRole \\\n  -var image_prefix=123456789012.dkr.ecr.ap-south-1.amazonaws.com/relaymart \\\n  -var create_rds=true \\\n  -var create_elasticache=true")
code("terraform output elasticache_endpoint\nterraform output rds_endpoint")
step(20, "Load the schema", "Compose loaded db/init.sql. RDS will not.")
code("psql \"postgres://relay:YOUR_PASSWORD@RDS_ENDPOINT:5432/relaymart\" \\\n  -f ../../db/init.sql")
expect("Tables users, payments, shipments, and tracking_events.")
body("RabbitMQ is not created by this Terraform. Set rabbit_url on the next apply if you have a broker. Leave it empty and auth still runs, but no events are published and the notification consumer stays idle.")

h1("10. Run it on ECS")
step(21, "Apply again with the real URLs", "Leave elasticsearch_host empty the first time. Logs stay in CloudWatch. Set it later when the tasks can reach Elasticsearch on port 9200.")
code("terraform apply \\\n  -var vpc_id=vpc-xxxx \\\n  -var 'subnet_ids=[\"subnet-a\",\"subnet-b\"]' \\\n  -var execution_role_arn=arn:aws:iam::123456789012:role/ecsTaskExecutionRole \\\n  -var image_prefix=123456789012.dkr.ecr.ap-south-1.amazonaws.com/relaymart \\\n  -var database_url='postgres://relay:YOUR_PASSWORD@RDS_ENDPOINT:5432/relaymart' \\\n  -var redis_url='redis://ELASTICACHE_ENDPOINT:6379' \\\n  -var rabbit_url='' \\\n  -var elasticsearch_host=''")
expect("Cluster relaymart. One Fargate service per process. DNS is gateway.relaymart.local, auth.relaymart.local, and the same pattern for the others. frontend and gateway get public IPs.")
step(22, "Confirm the services", "")
code("aws ecs list-services --cluster relaymart --region ap-south-1\naws ecs describe-services --cluster relaymart \\\n  --services auth gateway frontend --region ap-south-1 \\\n  --query 'services[].{name:serviceName,running:runningCount,desired:desiredCount}'")
expect("runningCount equals desiredCount. gateway and frontend want 2. The others want 1.")
step(23, "Call the public gateway", "Find the gateway task network interface, open it in EC2, and copy the public IPv4 address. Then repeat phase 5 against that IP.")
code("TASK=$(aws ecs list-tasks --cluster relaymart --service-name gateway \\\n  --region ap-south-1 --query 'taskArns[0]' --output text)\naws ecs describe-tasks --cluster relaymart --tasks \"$TASK\" \\\n  --region ap-south-1 --query 'tasks[0].attachments[0].details'")
body("curl http://THAT_IP:4000/health must return ok before you repeat register and checkout.")
step(24, "Read the ECS logs", "With elasticsearch_host empty, the group is /relaymart/mesh and the stream prefix is the service name.")
code("aws logs tail /relaymart/mesh --region ap-south-1 --follow \\\n  --filter-pattern otp_issued")
expect("The same otp_issued JSON you saw from docker compose logs.")
body("When elasticsearch_host is set, Terraform adds a FireLens Fluent Bit sidecar on every task and ships application logs to that host, index prefix relaymart. The sample uses TLS off. Turn TLS on for Amazon OpenSearch. CloudWatch still keeps the sidecar logs.")

h1("11. Run the same images on EKS")
body("The node role must be able to pull from ECR. AmazonEC2ContainerRegistryReadOnly on the node role is enough. There is no imagePullSecret in this manifest.")
step(25, "Render the manifests with your ECR prefix and apply them", "IMAGE_PREFIX has no trailing slash and no service name.")
code("cd ../..\nIMAGE_PREFIX=123456789012.dkr.ecr.ap-south-1.amazonaws.com/relaymart \\\n  node deploy/eks/render.mjs\nkubectl apply -f deploy/eks/mesh.yaml")
expect("Namespace relaymart. One Deployment and one Service per process. Gateway has 2 replicas and an HPA. The Ingress host is relaymart.local.")
step(26, "Point the data URLs at AWS", "render.mjs writes DATABASE_URL, REDIS_URL, and RABBIT_URL. The defaults are the Compose hostnames. Edit those three in deploy/eks/render.mjs to the RDS, ElastiCache, and broker endpoints. Render again and apply again.")
code("kubectl -n relaymart get deploy\nkubectl -n relaymart rollout status deploy/auth\nkubectl -n relaymart rollout status deploy/gateway")
step(27, "Open the gateway and repeat the proof", "")
code("kubectl -n relaymart port-forward svc/gateway 4000:4000")
body("In another terminal, repeat the phase 5 curls against http://127.0.0.1:4000. A 201 from register means the pod reached RDS. Port-forward svc/frontend 4173:4173 if you want the shop page.")

h1("12. EFK monitoring on EKS")
step(28, "Install Elasticsearch, Kibana, and Fluent Bit", "Elasticsearch requests 1 GB. A tiny node leaves the pod Pending.")
code("kubectl apply -f deploy/eks/efk.yaml\nkubectl -n logging get pods")
expect("elasticsearch and kibana Running. One fluent-bit pod per node, also Running.")
step(29, "Open Kibana", "")
code("kubectl -n logging port-forward svc/kibana 5601:5601")
body("Create the data view relaymart-* again, timestamp @timestamp. Fluent Bit tails /var/log/containers, keeps lines that contain service, parses the JSON, and writes index relaymart-*.")
step(30, "Generate traffic and confirm the live stream", "With the gateway port-forward still up, send another email OTP. In Discover, filter:")
code('service: "verification" and msg: "otp_issued"')
expect("A new line within a few seconds. That is the end of the path: the Compose proof is now ECR images on EKS, and the log is in Kibana.")
code("kubectl -n logging logs daemonset/fluent-bit --tail 30")
body("Prometheus did not move with EFK. On EKS, install kube-prometheus-stack if you want the Grafana boards from port 3000. Each Deployment is already annotated prometheus.io/scrape, prometheus.io/port, and prometheus.io/path.")

h1("13. Definition of done")
table(
    [
        ["Check", "Where", "Pass"],
        ["Compose healthy", "docker compose ps", "auth gateway postgres redis up"],
        ["Register", "POST /api/register", "201 and a user id"],
        ["Both OTPs", "verification log and Kibana", "otp_issued then verified"],
        ["Login", "POST /api/login", "a token after both OTPs"],
        ["Tracking", "POST .../scan", "picked_up stored"],
        ["Checkout", "POST /api/checkout", "201 and a trace"],
        ["ECR", "describe-repositories", "17 relaymart/* repos"],
        ["ECS", "describe-services", "running equals desired"],
        ["EKS", "kubectl get deploy", "namespace relaymart ready"],
        ["Kibana", "Discover relaymart-*", "otp_issued from the cluster"],
    ],
    [36, 70, 72],
)

h1("14. When something fails")
h2("auth keeps restarting")
body("The database URL is wrong, the task cannot reach RDS, or init.sql was never applied. This Terraform allows port 5432 and 6379 from 10.0.0.0/8 only.")
h2("Login says verification_required")
body("Confirm email and mobile. Registering the same email again returns email_or_mobile_taken. Use a new address.")
h2("Kibana is empty but the container log has JSON")
body("On Compose, Fluent Bit reads /var/lib/docker/containers. That is the Docker json-file driver. containerd, rootless Docker, or another log driver will not match observability/fluent-bit/fluent-bit.conf. On EKS it reads /var/log/containers, and the fluent-bit DaemonSet must be Running.")
h2("elasticsearch is Pending")
body("It requests 1 GB. Free a node, or lower that request in deploy/eks/efk.yaml on a small cluster.")
h2("ECS cannot pull the image")
body("image_prefix does not match the account that owns the repositories, or the execution role cannot call ecr:GetAuthorizationToken and ecr:BatchGetImage.")
h2("FireLens tasks fail")
body("elasticsearch_host is not reachable from the task subnet on port 9200, or the cluster requires TLS and this sample sets tls Off.")

h1("15. Stop it")
code("docker compose down -v")
body("That deletes the Compose database volume.")
code("cd deploy/ecs\nterraform destroy")
body("This Terraform file sets skip_final_snapshot = true. Destroy deletes the database with no snapshot. Do not point it at data you must keep.")
code("kubectl delete -f deploy/eks/mesh.yaml\nkubectl delete -f deploy/eks/efk.yaml")

h1("16. How the pieces fit")
body("One set of images. Compose proves the images, the schema, the OTP, and the log pipeline. ECR stores them. ECS runs them on Fargate with Cloud Map. EKS runs the same tags as Deployments. Stdout stays the contract: JSON lines, shipped by Fluent Bit, read in Kibana. Grafana answers how many and how slow. Kibana answers what one register, OTP, payment, or scan did.")
body("For production, swap the stand-ins: SES or SNS in the notification consumer, a real payment provider, and Amazon OpenSearch with TLS.")

pdf.output(OUT)
print(OUT, "pages", pdf.page)
