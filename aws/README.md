# AWS Deployment for EmailTaskRouter

This directory contains everything you need to deploy EmailTaskRouter to AWS using managed services.

## 🚀 Quick Start

### Option 1: Automated Deployment (Recommended)

1. **Setup Configuration**
   ```powershell
   .\aws\setup.ps1
   ```
   This will create your `terraform.tfvars` file with your specific settings.

2. **Deploy to AWS**
   ```powershell
   .\aws\deploy.ps1
   ```
   This script will handle the entire deployment process automatically.

3. **Post-Deployment Tasks**
   ```powershell
   # Check status
   .\aws\post-deploy.ps1 -Action status
   
   # Configure SES
   .\aws\post-deploy.ps1 -Action ses-setup
   
   # Check DNS propagation
   .\aws\post-deploy.ps1 -Action dns-check
   ```

### Option 2: Manual Deployment

Follow the detailed guide in [`AWS_DEPLOYMENT_GUIDE.md`](./AWS_DEPLOYMENT_GUIDE.md).

### Fast updates (no Terraform)

- Quick redeploy of latest code/images:
  ```powershell
  # Rebuild, push, and force ECS redeploy for both services
  .\aws\update.ps1
  
  # Skip builds (push existing :latest tags only)
  .\aws\update.ps1 -NoBuild
  
  # Use specific AWS profile/region for the session
  .\aws\update.ps1 -Profile yourProfile -Region us-east-1
  ```

- Alternatively, use the full deploy script in update-only mode:
  ```powershell
  # Build, push, and redeploy only (skip Terraform and secrets)
  .\aws\deploy.ps1 -UpdateOnly
  
  # Skip secrets when running full deploy flow
  .\aws\deploy.ps1 -SkipSecrets
  ```

## 📁 File Structure

```
aws/
├── AWS_DEPLOYMENT_GUIDE.md     # Detailed manual deployment guide
├── setup.ps1                   # Quick setup wizard
├── deploy.ps1                  # Automated deployment script
├── update.ps1                  # Fast image rebuild/push/redeploy
├── post-deploy.ps1             # Post-deployment helper tools
└── terraform/
    ├── main.tf                 # Main Terraform configuration
    ├── vpc.tf                  # VPC and networking
    ├── security_groups.tf      # Security groups
    ├── rds.tf                  # PostgreSQL database
    ├── ecr.tf                  # Container registry
    ├── ecs.tf                  # Container services
    ├── alb.tf                  # Load balancer
    ├── route53.tf              # DNS and SSL certificates
    ├── ses.tf                  # Email services
    ├── outputs.tf              # Terraform outputs
    ├── terraform.tfvars.example # Configuration template
    └── terraform.tfvars        # Your configuration (created by setup)
```

## 🏗️ AWS Infrastructure

The deployment creates the following AWS resources:

### Core Infrastructure
- **VPC** with public/private subnets across 2 AZs
- **Application Load Balancer** for high availability
- **ECS Fargate** cluster for containerized applications
- **ECR** repositories for Docker images

### Database & Storage
- **RDS PostgreSQL** (managed database)
- **Parameter Store** for configuration management

### Email Services
- **Amazon SES** for sending emails
- **Route 53** for DNS management
- **ACM** for SSL certificates

### Security
- Security groups with least-privilege access
- IAM roles for ECS tasks
- Encrypted database and parameter store

## 💰 Cost Estimation

**Monthly costs for production deployment:**

| Service | Configuration | Estimated Cost |
|---------|---------------|----------------|
| RDS PostgreSQL | db.t3.micro | ~$13 |
| ECS Fargate | Small containers | ~$15-30 |
| Application Load Balancer | Standard | ~$18 |
| Route 53 | Hosted zone | ~$0.50 |
| Data Transfer | Moderate usage | ~$5-10 |
| **Total** | | **~$50-70/month** |

*Costs may vary based on usage and AWS region.*

## 🔧 Configuration

### Required Variables

Edit `terraform.tfvars` with your settings:

```hcl
domain_name = "yourdomain.com"      # Your domain
admin_email = "admin@yourdomain.com" # Admin email
db_password = "secure-password"      # Database password
aws_region = "us-east-1"            # AWS region
```

### Optional Scaling Settings

```hcl
backend_cpu = 512      # Backend CPU units
backend_memory = 1024  # Backend memory (MB)
frontend_cpu = 256     # Frontend CPU units
frontend_memory = 512  # Frontend memory (MB)
```

## 🚦 Deployment Process

1. **Infrastructure Setup** (5-10 minutes)
   - VPC and networking
   - Security groups
   - RDS database
   - ECR repositories

2. **Container Deployment** (5-10 minutes)
   - Build Docker images
   - Push to ECR
   - Deploy to ECS

3. **DNS Configuration** (5 minutes + propagation time)
   - Create Route 53 hosted zone
   - SSL certificate generation
   - DNS record creation

4. **Email Setup** (Manual)
   - SES domain verification
   - SMTP credentials creation

## 📋 Post-Deployment Checklist

- [ ] Update domain nameservers to Route 53
- [ ] Verify domain in SES console
- [ ] Create SES SMTP credentials
- [ ] Update SMTP parameters in SSM
- [ ] Test application functionality
- [ ] Set up monitoring and alerts

## 🛠️ Management Commands

### Check Deployment Status
```powershell
.\aws\post-deploy.ps1 -Action status
```

### View Application Logs
```powershell
.\aws\post-deploy.ps1 -Action logs
```

### Restart Services
```powershell
.\aws\post-deploy.ps1 -Action restart
```

### Check DNS Propagation
```powershell
.\aws\post-deploy.ps1 -Action dns-check
```

### Monitor Health
```powershell
.\aws\post-deploy.ps1 -Action health
```

### Check AWS Costs
```powershell
.\aws\post-deploy.ps1 -Action costs
```

## 🔒 Security Best Practices

### Database Security
- Database in private subnets only
- Strong password required
- Encrypted at rest
- Automated backups enabled

### Network Security
- ALB in public subnets
- ECS tasks in private subnets
- Security groups with minimal access
- NAT Gateway for outbound traffic

### Application Security
- HTTPS enforced via ALB
- SSL certificates from ACM
- Environment variables in Parameter Store
- Non-root container users

## 🔄 DNS Migration to Route 53

### Step 1: Get Nameservers
```powershell
cd aws\terraform
terraform output route53_name_servers
```

### Step 2: Update Domain Registrar
1. Log into your domain registrar
2. Find DNS/nameserver settings
3. Replace nameservers with Route 53 values
4. Save changes

### Step 3: Wait for Propagation
- Propagation typically takes 1-48 hours
- Use `.\aws\post-deploy.ps1 -Action dns-check` to monitor

## 🐛 Troubleshooting

### Common Issues

**ECS Tasks Not Starting**
```powershell
# Check logs
.\aws\post-deploy.ps1 -Action logs

# Check service status
.\aws\post-deploy.ps1 -Action status
```

**Database Connection Issues**
- Verify DATABASE_URL in Parameter Store
- Check RDS security group rules
- Ensure ECS tasks have correct IAM permissions

**Email Not Working**
- Complete SES domain verification
- Move SES out of sandbox mode
- Verify SMTP credentials in Parameter Store

**SSL Certificate Issues**
- Ensure domain is verified in Route 53
- Wait for ACM certificate validation
- Check ALB listener configuration

### Getting Help

1. Check CloudWatch logs for detailed error messages
2. Review Terraform output for resource information
3. Use AWS Console to inspect individual services
4. Run health checks with post-deployment tools

## 🔄 Updates and Maintenance

### Updating Application Code
1. Push new images to ECR
2. Update ECS services to use new images
3. Monitor deployment progress

### Scaling Resources
1. Update `terraform.tfvars` with new resource allocations
2. Run `terraform plan` and `terraform apply`
3. Update ECS service with new task definition

### Backup and Recovery
- RDS automated backups enabled (7-day retention)
- Point-in-time recovery available
- Use RDS snapshots for major version upgrades

## 🧹 Cleanup

To destroy all AWS resources:

```powershell
cd aws\terraform
terraform destroy
```

**⚠️ Warning**: This will permanently delete all resources including the database. Export any important data first.

## 📞 Support

For deployment issues:
1. Check the logs: `.\aws\post-deploy.ps1 -Action logs`
2. Review the detailed guide: [`AWS_DEPLOYMENT_GUIDE.md`](./AWS_DEPLOYMENT_GUIDE.md)
3. Check AWS documentation for specific services
4. Monitor CloudWatch for error patterns
