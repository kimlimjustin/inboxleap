# Outputs
output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}



output "ecr_backend_repository_url" {
  description = "ECR backend repository URL"
  value       = aws_ecr_repository.backend.repository_url
}

output "ecr_frontend_repository_url" {
  description = "ECR frontend repository URL"
  value       = aws_ecr_repository.frontend.repository_url
}

output "load_balancer_dns" {
  description = "Load balancer DNS name"
  value       = aws_lb.main.dns_name
}

output "load_balancer_zone_id" {
  description = "Load balancer hosted zone ID"
  value       = aws_lb.main.zone_id
}

output "route53_name_servers" {
  description = "Route 53 name servers for domain"
  value       = aws_route53_zone.main.name_servers
}

output "ses_smtp_endpoint" {
  description = "SES SMTP endpoint"
  value       = "email-smtp.${var.aws_region}.amazonaws.com"
}

output "ses_domain_identity" {
  description = "SES domain identity"
  value       = aws_ses_domain_identity.main.domain
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "ecs_backend_service_name" {
  description = "ECS backend service name"
  value       = aws_ecs_service.backend.name
}

output "ecs_frontend_service_name" {
  description = "ECS frontend service name"
  value       = aws_ecs_service.frontend.name
}

output "aws_region" {
  description = "AWS region"
  value       = var.aws_region
}

output "application_url" {
  description = "Application URL"
  value       = "https://${var.domain_name}"
}

output "email_storage_bucket" {
  description = "S3 bucket for storing incoming emails"
  value       = aws_s3_bucket.email_storage.bucket
}

output "email_storage_bucket_arn" {
  description = "S3 bucket ARN for storing incoming emails"
  value       = aws_s3_bucket.email_storage.arn
}

output "lambda_webhook_processor_function_name" {
  description = "Lambda function name for email webhook processing"
  value       = aws_lambda_function.email_webhook_processor.function_name
}

output "ses_receipt_rule_set" {
  description = "SES receipt rule set name"
  value       = aws_ses_receipt_rule_set.main.rule_set_name
}

output "dmarc_record" {
  description = "DMARC record that should be added to DNS"
  value       = "v=DMARC1; p=quarantine; rua=mailto:dmarc@${var.domain_name}; ruf=mailto:dmarc@${var.domain_name}; sp=quarantine; adkim=r; aspf=r"
}

output "mx_record" {
  description = "MX record for receiving emails"
  value       = "10 inbound-smtp.${var.aws_region}.amazonaws.com"
}
