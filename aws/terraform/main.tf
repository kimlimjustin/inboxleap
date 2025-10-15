# InboxLeap AWS Infrastructure
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# Variables
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "app_name" {
  description = "Application name"
  type        = string
  default     = "inboxleap-us"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  # You'll need to set this value
}



variable "admin_email" {
  description = "Admin email address"
  type        = string
}

variable "ses_webhook_secret" {
  description = "Webhook secret for SES Lambda to backend authentication"
  type        = string
  default     = "changeme-webhook-secret-random-string"
  sensitive   = true
}

variable "backend_cpu" {
  description = "CPU units for backend container"
  type        = number
  default     = 512
}

variable "backend_memory" {
  description = "Memory (MB) for backend container"
  type        = number
  default     = 1024
}

variable "frontend_cpu" {
  description = "CPU units for frontend container"
  type        = number
  default     = 256
}

variable "frontend_memory" {
  description = "Memory (MB) for frontend container"
  type        = number
  default     = 512
}

# Local values
locals {
  name_prefix = "${var.app_name}-${var.environment}"
  
  tags = {
    Environment = var.environment
    Application = var.app_name
    ManagedBy   = "terraform"
  }
}
