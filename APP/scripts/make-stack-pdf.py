#!/usr/bin/env python3
"""RelayMart technical stack diagram."""

from fpdf import FPDF

OUT = "/workspace/public/RelayMart-Technical-Stack.pdf"
PINE = (31, 107, 74)
INK = (28, 36, 48)
PAPER = (244, 239, 230)
WHITE = (255, 253, 248)
COPPER = (166, 92, 42)
SLATE = (48, 62, 78)
MUTED = (90, 98, 108)
LINE = (196, 186, 168)

pdf = FPDF(orientation="L", unit="mm", format="A4")
pdf.set_auto_page_break(auto=False)
pdf.add_page()


def box(x, y, w, h, title, sub="", fill=PINE, fg=(255, 255, 255), ts=9, ss=7):
    pdf.set_fill_color(*fill)
    pdf.rect(x, y, w, h, "F")
    pdf.set_text_color(*fg)
    pdf.set_font("Helvetica", "B", ts)
    pdf.set_xy(x, y + (2.2 if sub else (h - 4) / 2))
    pdf.cell(w, 4.2, title, align="C")
    if sub:
        pdf.set_font("Helvetica", "", ss)
        pdf.set_xy(x, y + 7.2)
        pdf.cell(w, 3.6, sub, align="C")


def v_arrow(x, y1, y2):
    pdf.set_draw_color(*PINE)
    pdf.set_line_width(0.45)
    pdf.line(x, y1, x, y2 - 1.6)
    pdf.line(x - 1.3, y2 - 2.2, x, y2)
    pdf.line(x + 1.3, y2 - 2.2, x, y2)


def h_arrow(x1, x2, y):
    pdf.set_draw_color(*PINE)
    pdf.set_line_width(0.45)
    step = 1 if x2 > x1 else -1
    pdf.line(x1, y, x2 - 1.6 * step, y)
    pdf.line(x2 - 2.2 * step, y - 1.3, x2, y)
    pdf.line(x2 - 2.2 * step, y + 1.3, x2, y)


def label(x, y, w, text, size=8, style="", color=INK):
    pdf.set_text_color(*color)
    pdf.set_font("Helvetica", style, size)
    pdf.set_xy(x, y)
    pdf.cell(w, 4, text, align="C")


# ----- page 1: runtime -----
pdf.set_fill_color(*PINE)
pdf.rect(0, 0, 297, 16, "F")
pdf.set_text_color(255, 255, 255)
pdf.set_font("Helvetica", "B", 16)
pdf.set_xy(12, 4)
pdf.cell(200, 8, "RelayMart technical stack")
pdf.set_font("Helvetica", "", 9)
pdf.set_xy(180, 5.5)
pdf.cell(105, 6, "Frontend  /  API  /  Backend  /  Data", align="R")

cx = 148.5
box(118, 22, 61, 12, "Browser", fill=INK)
v_arrow(cx, 34, 42)
label(90, 35.5, 50, "HTTPS", size=7, color=MUTED)
box(78, 42, 141, 14, "Frontend", "Node.js 22    port 4173    shop UI only", fill=PINE, ts=11)
v_arrow(cx, 56, 66)
label(158, 58, 70, "calls the gateway only", size=7, color=MUTED)
box(48, 66, 201, 14, "API gateway", "Node.js    port 4000    routing, logs, checkout saga", fill=SLATE, ts=11)
v_arrow(cx, 80, 90)

pdf.set_fill_color(*PAPER)
pdf.set_draw_color(*LINE)
pdf.set_line_width(0.3)
pdf.rect(10, 90, 277, 58, "F")
pdf.rect(10, 90, 277, 58, "D")
pdf.set_text_color(*PINE)
pdf.set_font("Helvetica", "B", 8)
pdf.set_xy(14, 92)
pdf.cell(80, 4, "BACKEND    one process and one image each")

services = [
    ("catalog", "4001"),
    ("search", "4002"),
    ("pricing", "4003"),
    ("inventory", "4004"),
    ("cart", "4005"),
    ("order", "4006"),
    ("payment", "4007"),
    ("shipping", "4008"),
    ("review", "4009"),
    ("user", "4010"),
    ("notification", "4011"),
    ("recommendation", "4012"),
    ("auth", "4013"),
    ("verification", "4014"),
    ("tracking", "4015"),
]
bw, bh, gap = 52, 12, 3
origin_x = 14
for i, (name, port) in enumerate(services):
    col, row = i % 5, i // 5
    x = origin_x + col * (bw + gap)
    y = 98 + row * (bh + 3)
    box(x, y, bw, bh, name, f"Node.js   :{port}", fill=WHITE, fg=INK, ts=8, ss=6.5)
    pdf.set_draw_color(*LINE)
    pdf.set_line_width(0.25)
    pdf.rect(x, y, bw, bh, "D")

# data
box(16, 162, 82, 22, "Postgres 16", "users, payments, shipments    RDS on AWS", fill=COPPER, ts=11, ss=7)
box(108, 162, 82, 22, "Redis 7", "sessions and OTP    ElastiCache on AWS", fill=COPPER, ts=11, ss=7)
box(200, 162, 82, 22, "RabbitMQ 3", "events between services", fill=COPPER, ts=11, ss=7)

pdf.set_draw_color(*COPPER)
pdf.set_line_width(0.35)
pdf.line(57, 148, 57, 162)
pdf.line(149, 148, 149, 162)
pdf.line(241, 148, 241, 162)

pdf.set_text_color(*INK)
pdf.set_font("Helvetica", "", 7.5)
pdf.set_xy(12, 188)
pdf.multi_cell(
    273,
    3.6,
    "Postgres is used by auth, tracking, and payment.  Redis is used by auth and verification.  "
    "RabbitMQ keys: user.registered, otp.email, otp.mobile, payment.authorized, tracking.updated.  "
    "Notification consumes those queues.  Catalog, search, pricing, inventory, cart, order, shipping, review, user, and recommendation keep their own state and are reached only through the gateway.",
    new_x="LMARGIN",
    new_y="NEXT",
)

# ----- page 2: delivery and monitoring -----
pdf.add_page()
pdf.set_fill_color(*PINE)
pdf.rect(0, 0, 297, 16, "F")
pdf.set_text_color(255, 255, 255)
pdf.set_font("Helvetica", "B", 16)
pdf.set_xy(12, 4)
pdf.cell(180, 8, "Delivery and monitoring")
pdf.set_font("Helvetica", "", 9)
pdf.set_xy(160, 5.5)
pdf.cell(125, 6, "Same images on Compose, ECS, and EKS", align="R")

pdf.set_text_color(*PINE)
pdf.set_font("Helvetica", "B", 11)
pdf.set_xy(12, 22)
pdf.cell(120, 6, "Image path")

steps = [
    (12, 32, "APP source", "frontend, gateway, 15 services"),
    (12, 52, "Docker Compose", "local prove    ports 4173 and 4000"),
    (12, 72, "17 Docker images", "one Dockerfile per service"),
    (12, 92, "Amazon ECR", "relaymart/<service>:latest"),
]
for x, y, title, sub in steps:
    box(x, y, 120, 16, title, sub, fill=SLATE, ts=11, ss=7.5)
for y in (48, 68, 88):
    v_arrow(72, y, y + 4)

box(16, 118, 54, 18, "ECS Fargate", "Cloud Map DNS", fill=PINE, ts=10, ss=7)
box(78, 118, 54, 18, "EKS", "Deployment per image", fill=PINE, ts=10, ss=7)
pdf.set_draw_color(*PINE)
pdf.set_line_width(0.45)
pdf.line(72, 108, 72, 112)
pdf.line(43, 112, 105, 112)
pdf.line(43, 112, 43, 118)
pdf.line(105, 112, 105, 118)

pdf.set_text_color(*PINE)
pdf.set_font("Helvetica", "B", 11)
pdf.set_xy(156, 22)
pdf.cell(120, 6, "Observability")

box(156, 32, 128, 16, "Every Node service", "JSON line on stdout    /metrics", fill=INK, ts=11, ss=7.5)
v_arrow(196, 48, 58)
v_arrow(244, 48, 58)
box(156, 58, 60, 18, "Fluent Bit", "tails container logs", fill=SLATE, ts=10, ss=7)
box(224, 58, 60, 18, "Prometheus", "scrape /metrics  5s", fill=SLATE, ts=10, ss=7)
v_arrow(186, 76, 86)
v_arrow(254, 76, 86)
box(156, 86, 60, 18, "Elasticsearch", "index relaymart-*", fill=COPPER, ts=9, ss=7)
box(224, 86, 60, 18, "Grafana", "dashboards", fill=COPPER, ts=10, ss=7)
v_arrow(186, 104, 114)
box(156, 114, 60, 18, "Kibana", "live log stream", fill=PINE, ts=11, ss=7)

pdf.set_fill_color(*PAPER)
pdf.rect(12, 150, 273, 42, "F")
pdf.set_text_color(*INK)
pdf.set_font("Helvetica", "B", 10)
pdf.set_xy(16, 153)
pdf.cell(80, 5, "Stack")
rows = [
    "Runtime     Node.js 22 on Alpine, one container per service",
    "Edge        Frontend :4173  calls  API gateway :4000  only",
    "Data        Postgres 16, Redis 7, RabbitMQ 3.  On AWS: RDS, ElastiCache, and a broker",
    "Registry    Amazon ECR.  Compute: Docker Compose, then ECS Fargate or EKS",
    "Logs        stdout JSON  ->  Fluent Bit  ->  Elasticsearch  ->  Kibana",
    "Metrics     Prometheus scrapes /metrics.  Grafana reads Prometheus",
]
pdf.set_font("Helvetica", "", 9)
y = 160
for row in rows:
    pdf.set_xy(16, y)
    pdf.cell(260, 4.6, row)
    y += 5

pdf.output(OUT)
print(OUT)
