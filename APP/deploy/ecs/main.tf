# RelayMart on ECS Fargate.
# One image per service, pushed by scripts/ecr-push.sh.
# Set image_prefix to 123456789012.dkr.ecr.ap-south-1.amazonaws.com/relaymart
# Redis on AWS is ElastiCache: set redis_url to the primary endpoint.
# Logs go to CloudWatch, and to Elasticsearch/Kibana when elasticsearch_host is set (FireLens).

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

variable "region" { default = "ap-south-1" }
variable "vpc_id" { type = string }
variable "subnet_ids" { type = list(string) }
variable "execution_role_arn" { type = string }
variable "image_prefix" {
  type        = string
  description = "ECR prefix without the service name. Example: 123456789012.dkr.ecr.ap-south-1.amazonaws.com/relaymart"
}
variable "image_tag" { default = "latest" }
variable "database_url" { default = "" }
variable "redis_url" {
  default     = ""
  description = "ElastiCache primary endpoint, redis://relaymart.xxxx.cache.amazonaws.com:6379"
}
variable "rabbit_url" { default = "" }
variable "elasticsearch_host" {
  default     = ""
  description = "Kibana reads this cluster. Empty keeps CloudWatch only."
}
variable "elasticsearch_port" { default = "9200" }
variable "create_elasticache" { default = false }
variable "create_rds" { default = false }

locals {
  services = {
    frontend       = { port = 4173, entry = "frontend/server.js", public = true }
    gateway        = { port = 4000, entry = "gateway/server.js", public = true }
    catalog        = { port = 4001, entry = "services/catalog/server.js" }
    search         = { port = 4002, entry = "services/search/server.js" }
    pricing        = { port = 4003, entry = "services/pricing/server.js" }
    inventory      = { port = 4004, entry = "services/inventory/server.js" }
    cart           = { port = 4005, entry = "services/cart/server.js" }
    order          = { port = 4006, entry = "services/order/server.js" }
    payment        = { port = 4007, entry = "services/payment/server.js" }
    shipping       = { port = 4008, entry = "services/shipping/server.js" }
    review         = { port = 4009, entry = "services/review/server.js" }
    user           = { port = 4010, entry = "services/user/server.js" }
    notification   = { port = 4011, entry = "services/notification/server.js" }
    recommendation = { port = 4012, entry = "services/recommendation/server.js" }
    auth           = { port = 4013, entry = "services/auth/server.js" }
    verification   = { port = 4014, entry = "services/verification/server.js" }
    tracking       = { port = 4015, entry = "services/tracking/server.js" }
  }
  mesh_env = [
    { name = "DATABASE_URL", value = var.database_url },
    { name = "REDIS_URL", value = var.redis_url },
    { name = "RABBIT_URL", value = var.rabbit_url },
    { name = "CATALOG_URL", value = "http://catalog.relaymart.local:4001" },
    { name = "SEARCH_URL", value = "http://search.relaymart.local:4002" },
    { name = "PRICING_URL", value = "http://pricing.relaymart.local:4003" },
    { name = "INVENTORY_URL", value = "http://inventory.relaymart.local:4004" },
    { name = "CART_URL", value = "http://cart.relaymart.local:4005" },
    { name = "ORDER_URL", value = "http://order.relaymart.local:4006" },
    { name = "PAYMENT_URL", value = "http://payment.relaymart.local:4007" },
    { name = "SHIPPING_URL", value = "http://shipping.relaymart.local:4008" },
    { name = "REVIEW_URL", value = "http://review.relaymart.local:4009" },
    { name = "USER_URL", value = "http://user.relaymart.local:4010" },
    { name = "NOTIFICATION_URL", value = "http://notification.relaymart.local:4011" },
    { name = "RECOMMENDATION_URL", value = "http://recommendation.relaymart.local:4012" },
    { name = "AUTH_URL", value = "http://auth.relaymart.local:4013" },
    { name = "VERIFICATION_URL", value = "http://verification.relaymart.local:4014" },
    { name = "TRACKING_URL", value = "http://tracking.relaymart.local:4015" },
    { name = "GATEWAY_PUBLIC_URL", value = "http://gateway.relaymart.local:4000" },
  ]
}

resource "aws_ecs_cluster" "mesh" {
  name = "relaymart"
}

resource "aws_cloudwatch_log_group" "mesh" {
  name              = "/relaymart/mesh"
  retention_in_days = 7
}

resource "aws_service_discovery_private_dns_namespace" "ns" {
  name = "relaymart.local"
  vpc  = var.vpc_id
}

resource "aws_security_group" "mesh" {
  name   = "relaymart-mesh"
  vpc_id = var.vpc_id
  ingress {
    from_port   = 4000
    to_port     = 4173
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
  }
  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
  }
  ingress {
    from_port   = 5672
    to_port     = 5672
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
  }
  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_service_discovery_service" "svc" {
  for_each = local.services
  name     = each.key
  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.ns.id
    dns_records {
      ttl  = 10
      type = "A"
    }
  }
}

resource "aws_ecs_task_definition" "svc" {
  for_each                 = local.services
  family                   = "relaymart-${each.key}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.execution_role_arn
  container_definitions = jsonencode(concat(
    [
      {
        name      = each.key
        image     = "${var.image_prefix}/${each.key}:${var.image_tag}"
        essential = true
        portMappings = [{ containerPort = each.value.port, protocol = "tcp" }]
        environment = concat(
          [
            { name = "PORT", value = tostring(each.value.port) },
            { name = "SERVICE_NAME", value = each.key },
          ],
          local.mesh_env,
        )
        logConfiguration = var.elasticsearch_host == "" ? {
          logDriver = "awslogs"
          options = {
            awslogs-group         = aws_cloudwatch_log_group.mesh.name
            awslogs-region        = var.region
            awslogs-stream-prefix = each.key
          }
          } : {
          logDriver = "awsfirelens"
          options = {
            Name               = "es"
            Host               = var.elasticsearch_host
            Port               = var.elasticsearch_port
            tls                = "Off"
            Suppress_Type_Name = "On"
            Logstash_Format    = "On"
            Logstash_Prefix    = "relaymart"
          }
        }
      }
    ],
    var.elasticsearch_host == "" ? [] : [
      {
        name      = "log_router"
        image     = "public.ecr.aws/aws-observability/aws-for-fluent-bit:stable"
        essential = true
        firelensConfiguration = {
          type = "fluentbit"
          options = { enable-ecs-log-metadata = "true" }
        }
        logConfiguration = {
          logDriver = "awslogs"
          options = {
            awslogs-group         = aws_cloudwatch_log_group.mesh.name
            awslogs-region        = var.region
            awslogs-stream-prefix = "firelens-${each.key}"
          }
        }
      }
    ],
  ))
}

resource "aws_ecs_service" "svc" {
  for_each        = local.services
  name            = each.key
  cluster         = aws_ecs_cluster.mesh.id
  task_definition = aws_ecs_task_definition.svc[each.key].arn
  desired_count   = each.key == "gateway" || each.key == "frontend" ? 2 : 1
  launch_type     = "FARGATE"
  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = [aws_security_group.mesh.id]
    assign_public_ip = try(each.value.public, false)
  }
  service_registries {
    registry_arn = aws_service_discovery_service.svc[each.key].arn
  }
}

output "cluster" { value = aws_ecs_cluster.mesh.name }
output "log_group" { value = aws_cloudwatch_log_group.mesh.name }
output "images" {
  value = [for name in keys(local.services) : "${var.image_prefix}/${name}:${var.image_tag}"]
}
