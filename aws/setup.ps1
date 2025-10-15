# Quick Setup Script for AWS Deployment
# Run this script to set up your terraform.tfvars file quickly

Write-Host "🚀 EmailTaskRouter AWS Setup Wizard" -ForegroundColor Blue
Write-Host "This script will help you create the terraform.tfvars file with your settings." -ForegroundColor Gray
Write-Host ""

# Get user inputs
$domainName = Read-Host "Enter your domain name (e.g., myapp.com)"
$adminEmail = Read-Host "Enter your admin email address"
$awsRegion = Read-Host "Enter AWS region [us-east-1]"
if ([string]::IsNullOrWhiteSpace($awsRegion)) { $awsRegion = "us-east-1" }

$appName = Read-Host "Enter application name [emailtaskrouter]"
if ([string]::IsNullOrWhiteSpace($appName)) { $appName = "emailtaskrouter" }

Write-Host ""
Write-Host "Database Configuration:" -ForegroundColor Yellow
$dbUsername = Read-Host "Enter database username [emailtaskrouter]"
if ([string]::IsNullOrWhiteSpace($dbUsername)) { $dbUsername = "emailtaskrouter" }

$dbPassword = Read-Host "Enter a secure database password (min 8 characters)" -AsSecureString
$dbPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassword))

Write-Host ""
Write-Host "Container Resources (you can adjust these later):" -ForegroundColor Yellow
$backendCpu = Read-Host "Backend CPU units [512]"
if ([string]::IsNullOrWhiteSpace($backendCpu)) { $backendCpu = "512" }

$backendMemory = Read-Host "Backend Memory MB [1024]"
if ([string]::IsNullOrWhiteSpace($backendMemory)) { $backendMemory = "1024" }

$frontendCpu = Read-Host "Frontend CPU units [256]"
if ([string]::IsNullOrWhiteSpace($frontendCpu)) { $frontendCpu = "256" }

$frontendMemory = Read-Host "Frontend Memory MB [512]"
if ([string]::IsNullOrWhiteSpace($frontendMemory)) { $frontendMemory = "512" }

# Create terraform.tfvars content
$terraformVars = @"
# Domain and application settings
domain_name = "$domainName"
app_name = "$appName"

# AWS Region
aws_region = "$awsRegion"

# Database settings
db_username = "$dbUsername"
db_password = "$dbPasswordPlain"

# Email settings
admin_email = "$adminEmail"

# Container resource allocation
backend_cpu = $backendCpu
backend_memory = $backendMemory
frontend_cpu = $frontendCpu
frontend_memory = $frontendMemory

# Environment
environment = "production"
"@

# Write to file
$terraformVarsPath = "aws\terraform\terraform.tfvars"
$terraformVars | Out-File -FilePath $terraformVarsPath -Encoding UTF8

Write-Host ""
Write-Host "✅ Configuration saved to $terraformVarsPath" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Review and edit $terraformVarsPath if needed"
Write-Host "2. Run the deployment script: .\aws\deploy.ps1"
Write-Host "3. Or follow the manual steps in aws\AWS_DEPLOYMENT_GUIDE.md"
Write-Host ""
Write-Host "Estimated AWS costs:" -ForegroundColor Cyan
Write-Host "- RDS PostgreSQL (db.t3.micro): ~`$13/month"
Write-Host "- ECS Fargate: ~`$15-30/month (depending on usage)"
Write-Host "- Application Load Balancer: ~`$18/month"
Write-Host "- Route 53 Hosted Zone: `$0.50/month"
Write-Host "- Data transfer and other services: varies"
Write-Host "Total estimated: ~`$50-70/month for small-medium usage"
Write-Host ""

$openFile = Read-Host "Would you like to review the terraform.tfvars file now? (y/N)"
if ($openFile -match "^[Yy]$") {
    Start-Process $terraformVarsPath
}
