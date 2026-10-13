# Optional. Set create_elasticache = true to provision the Redis ElastiCache
# this mesh reads through REDIS_URL. Copy the output into var.redis_url and
# apply again so the tasks pick it up. RDS is the same idea for DATABASE_URL.

resource "aws_elasticache_subnet_group" "redis" {
  count      = var.create_elasticache ? 1 : 0
  name       = "relaymart"
  subnet_ids = var.subnet_ids
}

resource "aws_elasticache_cluster" "redis" {
  count                = var.create_elasticache ? 1 : 0
  cluster_id           = "relaymart"
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = "cache.t4g.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  subnet_group_name    = aws_elasticache_subnet_group.redis[0].name
  security_group_ids   = [aws_security_group.mesh.id]
  port                 = 6379
}

resource "aws_db_subnet_group" "postgres" {
  count      = var.create_rds ? 1 : 0
  name       = "relaymart"
  subnet_ids = var.subnet_ids
}

resource "aws_db_instance" "postgres" {
  count                  = var.create_rds ? 1 : 0
  identifier             = "relaymart"
  engine                 = "postgres"
  engine_version         = "16"
  instance_class         = "db.t4g.micro"
  allocated_storage      = 20
  db_name                = "relaymart"
  username               = "relay"
  password               = "classroom-change-me"
  db_subnet_group_name   = aws_db_subnet_group.postgres[0].name
  vpc_security_group_ids = [aws_security_group.mesh.id]
  skip_final_snapshot    = true
  publicly_accessible    = false
}

output "elasticache_endpoint" {
  value = var.create_elasticache ? aws_elasticache_cluster.redis[0].cache_nodes[0].address : null
}

output "rds_endpoint" {
  value = var.create_rds ? aws_db_instance.postgres[0].address : null
}
