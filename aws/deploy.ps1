# AWS Deployment Script for EmailTaskRouter (PowerShell)
# This script automates the deployment process on Windows

param(
    [switch]$SkipPrerequisites,
    [switch]$SkipPlan,
    [string]$TerraformVarsFile = "terraform.tfvars",
    [switch]$UpdateOnly,
    [switch]$SkipSecrets
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting AWS deployment for EmailTaskRouter..." -ForegroundColor Blue

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Check prerequisites
function Test-Prerequisites {
    if ($SkipPrerequisites) {
        Write-Status "Skipping prerequisites check..."
        return
    }
    
    Write-Status "Checking prerequisites..."
    
    # Check AWS CLI
    try {
        aws --version | Out-Null
    } catch {
        Write-Error "AWS CLI is not installed. Please install it first."
        exit 1
    }
    
    # Check Terraform
    try {
        terraform version | Out-Null
    } catch {
        Write-Error "Terraform is not installed. Please install it first."
        exit 1
    }
    
    # Check Docker
    try {
        docker --version | Out-Null
        # Check if Docker daemon is running
        docker info | Out-Null
    } catch {
        Write-Error "Docker is not installed or not running. Please install Docker and ensure it's running."
        exit 1
    }
    
    # Check AWS credentials
    try {
        aws sts get-caller-identity | Out-Null
    } catch {
        Write-Error "AWS credentials not configured. Run 'aws configure' first."
        exit 1
    }
    
    Write-Success "All prerequisites met!"
}

# Initialize Terraform
function Initialize-Terraform {
    Write-Status "Initializing Terraform..."
    Set-Location "$PSScriptRoot\terraform"
    
    if (!(Test-Path $TerraformVarsFile)) {
        Write-Warning "$TerraformVarsFile not found. Copying example file..."
        Copy-Item "terraform.tfvars.example" $TerraformVarsFile
        Write-Warning "Please edit $TerraformVarsFile with your actual values before continuing."
        
        # Open the file in default editor
        Start-Process $TerraformVarsFile
        
        $continue = Read-Host "Press Enter to continue after editing $TerraformVarsFile"
    }
    
    terraform init
    Write-Success "Terraform initialized!"
}

# Plan deployment
function Invoke-TerraformPlan {
    if ($SkipPlan) {
        Write-Status "Skipping Terraform plan..."
        return
    }
    
    Write-Status "Planning deployment..."
    terraform plan -out=tfplan
    
    Write-Host ""
    Write-Warning "Please review the plan above carefully."
    $proceed = Read-Host "Do you want to proceed with the deployment? (y/N)"
    
    if ($proceed -notmatch "^[Yy]$") {
        Write-Status "Deployment cancelled."
        exit 0
    }
}

# Apply infrastructure
function Deploy-Infrastructure {
    Write-Status "Applying infrastructure..."
    
    if (Test-Path "tfplan") {
        terraform apply tfplan
    } else {
        terraform apply -auto-approve
    }
    
    Write-Success "Infrastructure deployed!"
}

# Build and push Docker images
function Build-AndPushImages {
    Write-Status "Building and pushing Docker images..."
    
    # Go back to project root
    Set-Location "..\.."
    
    # Get ECR URLs from Terraform output
    $originalLocation = Get-Location
    Set-Location "$PSScriptRoot\terraform"
    $backendEcrUrl = terraform output -raw ecr_backend_repository_url
    $frontendEcrUrl = terraform output -raw ecr_frontend_repository_url
    $awsAccountId = aws sts get-caller-identity --query Account --output text
    $awsRegion = terraform output -raw aws_region
    
    Set-Location $originalLocation.Path
    
    Write-Status "ECR Backend URL: $backendEcrUrl"
    Write-Status "ECR Frontend URL: $frontendEcrUrl"
    
    # Login to ECR
    Write-Status "Logging into ECR..."
    try {
        $ecrPassword = aws ecr get-login-password --region $awsRegion
        docker login -u AWS -p $ecrPassword "$awsAccountId.dkr.ecr.$awsRegion.amazonaws.com"
        Write-Success "Successfully logged into ECR"
    }
    catch {
        Write-Error "Failed to login to ECR. Please check your AWS credentials and region."
        Write-Status "Attempting to refresh AWS credentials..."
        # Try to get fresh credentials
        try {
            aws sts get-caller-identity | Out-Null
            Write-Status "AWS credentials are valid, retrying ECR login..."
            $ecrPassword = aws ecr get-login-password --region $awsRegion
            docker login -u AWS -p $ecrPassword "$awsAccountId.dkr.ecr.$awsRegion.amazonaws.com"
            Write-Success "ECR login successful on retry"
        }
        catch {
            Write-Error "ECR login failed. Please run 'aws configure' to refresh your credentials or check your AWS session."
            throw
        }
    }
    
    # Build backend image
    Write-Status "Building backend image..."
    try {
        docker build -f Dockerfile.backend -t emailtaskrouter-backend .
        docker tag emailtaskrouter-backend:latest "$backendEcrUrl`:latest"
        Write-Success "Backend image built successfully"
    }
    catch {
        Write-Error "Failed to build backend image"
        throw
    }
    
    # Build frontend image
    Write-Status "Building frontend image..."
    try {
        docker build -f Dockerfile.frontend -t emailtaskrouter-frontend .
        docker tag emailtaskrouter-frontend:latest "$frontendEcrUrl`:latest"
        Write-Success "Frontend image built successfully"
    }
    catch {
        Write-Error "Failed to build frontend image"
        throw
    }
    
    # Push images with retry logic
    Write-Status "Pushing backend image..."
    $maxRetries = 3
    $retryCount = 0
    $backendPushed = $false
    
    while ($retryCount -lt $maxRetries -and -not $backendPushed) {
        try {
            docker push "$backendEcrUrl`:latest"
            $backendPushed = $true
            Write-Success "Backend image pushed successfully"
        }
        catch {
            $retryCount++
            Write-Warning "Backend push attempt $retryCount failed. Retrying..."
            if ($retryCount -eq $maxRetries) {
                Write-Error "Failed to push backend image after $maxRetries attempts"
                throw
            }
            Start-Sleep -Seconds 5
        }
    }
    
    Write-Status "Pushing frontend image..."
    $retryCount = 0
    $frontendPushed = $false
    
    while ($retryCount -lt $maxRetries -and -not $frontendPushed) {
        try {
            docker push "$frontendEcrUrl`:latest"
            $frontendPushed = $true
            Write-Success "Frontend image pushed successfully"
        }
        catch {
            $retryCount++
            Write-Warning "Frontend push attempt $retryCount failed. Retrying..."
            if ($retryCount -eq $maxRetries) {
                Write-Error "Failed to push frontend image after $maxRetries attempts"
                throw
            }
            Start-Sleep -Seconds 5
        }
    }
    
    Write-Success "Docker images built and pushed!"
}

# Configure environment variables
function Set-EnvironmentVariables {
    Write-Status "Configuring environment variables..."
    
    if ($SkipSecrets) {
        Write-Status "Skipping secrets/SSM parameter updates (-SkipSecrets specified)."
        return
    }

    Set-Location "$PSScriptRoot\terraform"
    
    # Get outputs from Terraform (excluding database-related ones since we're using Neon)
    $appUrl = terraform output -raw application_url
    $awsRegion = terraform output -raw aws_region

    # Derive the SSM prefix from terraform.tfvars (app_name-environment)
    $tfvarsPath = "terraform.tfvars"
    $appName = "inboxleap-us"
    $environment = "production"
    if (Test-Path $tfvarsPath) {
        $tfvarsContent = Get-Content $tfvarsPath -Raw
        $appNameMatch = [regex]::Match($tfvarsContent, 'app_name\s*=\s*"([^"]+)"')
        $envMatch = [regex]::Match($tfvarsContent, 'environment\s*=\s*"([^"]+)"')
        if ($appNameMatch.Success) { $appName = $appNameMatch.Groups[1].Value }
        if ($envMatch.Success) { $environment = $envMatch.Groups[1].Value }
    }
    $namePrefix = "$appName-$environment"
    Write-Status "Using SSM prefix: /$namePrefix/*"

    # Helper to read an SSM parameter value if it exists (returns empty string if missing)
    function Get-SSMOrEmpty([string]$name, [switch]$Secure) {
        try {
            if ($Secure) {
                return (aws ssm get-parameter --with-decryption --name "$name" --query "Parameter.Value" --output text 2>$null)
            } else {
                return (aws ssm get-parameter --name "$name" --query "Parameter.Value" --output text 2>$null)
            }
        } catch { return "" }
    }

    # Read existing values first; prompt only if missing
    $googleClientId = Get-SSMOrEmpty "/$namePrefix/GOOGLE_CLIENT_ID"
    if (-not $googleClientId) { $googleClientId = Read-Host "Google OAuth Client ID" }

    $googleClientSecretPlain = Get-SSMOrEmpty "/$namePrefix/GOOGLE_CLIENT_SECRET" -Secure
    if (-not $googleClientSecretPlain) {
        $googleClientSecret = Read-Host "Google OAuth Client Secret" -AsSecureString
        $googleClientSecretPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($googleClientSecret))
    }

    $sessionSecretPlain = Get-SSMOrEmpty "/$namePrefix/SESSION_SECRET" -Secure
    if (-not $sessionSecretPlain) {
        $sessionSecret = Read-Host "Session secret" -AsSecureString
        $sessionSecretPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sessionSecret))
    }

    $claudeApiKeyPlain = Get-SSMOrEmpty "/$namePrefix/CLAUDE_API_KEY" -Secure
    # Optional: only prompt if you want to set it when missing
    if (-not $claudeApiKeyPlain) {
        # Leave empty if not provided
        $tmp = Read-Host "Claude API key (optional, press Enter to skip)" -AsSecureString
        if ($tmp.Length -gt 0) { $claudeApiKeyPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($tmp)) }
    }

    # Read Postmark settings from existing SSM or prompt
    $postmarkTokenPlain = Get-SSMOrEmpty "/$namePrefix/POSTMARK_SERVER_TOKEN" -Secure
    if (-not $postmarkTokenPlain) {
        $postmarkToken = Read-Host "Postmark Server Token" -AsSecureString
        $postmarkTokenPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($postmarkToken))
    }
    $postmarkFrom = Get-SSMOrEmpty "/$namePrefix/POSTMARK_FROM_EMAIL"
    if (-not $postmarkFrom) {
        $postmarkFrom = Read-Host "Postmark FROM email (e.g., service@yourdomain.com)"
    }

    # Read Neon database URL from .env file (secure approach)
    $envPath = "$PSScriptRoot\..\.env"
    $databaseUrl = ""
    if (Test-Path $envPath) {
        $envContent = Get-Content $envPath
        foreach ($line in $envContent) {
            if ($line -match "^DATABASE_URL=(.+)$") {
                $databaseUrl = $matches[1]
                break
            }
        }
    }
    
    if (-not $databaseUrl) {
        Write-Error "DATABASE_URL not found in .env file. Please ensure your .env file contains the Neon database URL."
        exit 1
    }
    
    Write-Status "Using DATABASE_URL from .env file"

    # Create/overwrite SSM parameters expected by ECS task definition (use leading slash)
    aws ssm put-parameter --name "/$namePrefix/SESSION_SECRET" --value "$sessionSecretPlain" --type "SecureString" --overwrite | Out-Null
    aws ssm put-parameter --name "/$namePrefix/GOOGLE_CLIENT_ID" --value "$googleClientId" --type "String" --overwrite | Out-Null
    aws ssm put-parameter --name "/$namePrefix/GOOGLE_CLIENT_SECRET" --value "$googleClientSecretPlain" --type "SecureString" --overwrite | Out-Null
    if ($claudeApiKeyPlain) {
        aws ssm put-parameter --name "/$namePrefix/CLAUDE_API_KEY" --value "$claudeApiKeyPlain" --type "SecureString" --overwrite | Out-Null
    }

    # Postmark
    if ($postmarkTokenPlain) {
        aws ssm put-parameter --name "/$namePrefix/POSTMARK_SERVER_TOKEN" --value "$postmarkTokenPlain" --type "SecureString" --overwrite | Out-Null
    }
    if ($postmarkFrom) {
        aws ssm put-parameter --name "/$namePrefix/POSTMARK_FROM_EMAIL" --value "$postmarkFrom" --type "String" --overwrite | Out-Null
    }

    # Optional app settings
    aws ssm put-parameter --name "/$namePrefix/APP_URL" --value "$appUrl" --type "String" --overwrite | Out-Null
    aws ssm put-parameter --name "/$namePrefix/DATABASE_URL" --value "$databaseUrl" --type "SecureString" --overwrite | Out-Null

    # SES SMTP convenience values
    aws ssm put-parameter --name "/$namePrefix/SMTP_HOST" --value "email-smtp.$awsRegion.amazonaws.com" --type "String" --overwrite | Out-Null
    aws ssm put-parameter --name "/$namePrefix/SMTP_PORT" --value "587" --type "String" --overwrite | Out-Null
    
    Set-Location $PSScriptRoot\..
    
    Write-Success "Environment variables stored in SSM under $namePrefix/*"
    Write-Warning "Ensure your Google OAuth redirect URI is $appUrl/api/auth/google/callback"
}

# Update ECS services
function Update-EcsServices {
    Write-Status "Updating ECS services..."
    
    Set-Location "$PSScriptRoot\terraform"
    
    $clusterName = terraform output -raw ecs_cluster_name
    $backendServiceName = terraform output -raw ecs_backend_service_name
    $frontendServiceName = terraform output -raw ecs_frontend_service_name
    
    # Force new deployment with latest images
    aws ecs update-service --cluster $clusterName --service $backendServiceName --force-new-deployment | Out-Null
    aws ecs update-service --cluster $clusterName --service $frontendServiceName --force-new-deployment | Out-Null
    
    Set-Location $PSScriptRoot\..
    
    Write-Success "ECS services updated!"
}

# Display final information
function Show-FinalInfo {
    Write-Success "🎉 Deployment completed!"
    
    Set-Location "$PSScriptRoot\terraform"
    
    Write-Host ""
    Write-Host "=== Deployment Information ===" -ForegroundColor Yellow
    
    $appUrl = terraform output -raw application_url
    $albDns = terraform output -raw load_balancer_dns
    $nameServers = terraform output -json route53_name_servers | ConvertFrom-Json
    
    Write-Host "Application URL: $appUrl"
    Write-Host "ALB DNS Name: $albDns"
    Write-Host "Route 53 Name Servers:"
    foreach ($ns in $nameServers) {
        Write-Host "  $ns"
    }
    Write-Host ""
    
    Set-Location $PSScriptRoot\..
    
    Write-Warning "Next Steps:"
    Write-Host "1. Update your domain's nameservers to the Route 53 nameservers above"
    Write-Host "2. Verify your domain in SES console"
    Write-Host "3. Set up SES SMTP credentials and update SSM parameters"
    Write-Host "4. Wait for DNS propagation (up to 48 hours)"
    Write-Host "5. Test your application at the URL above"
    Write-Host ""
    
    Write-Status "For detailed instructions, see aws\AWS_DEPLOYMENT_GUIDE.md"
}

# Main execution
function Main {
    try {
        if ($UpdateOnly) {
            Write-Status "Quick update mode: building, pushing images and forcing ECS redeploy (no Terraform, no secrets)."
            Build-AndPushImages
            Update-EcsServices
            Show-FinalInfo
            return
        }

        Test-Prerequisites
        Initialize-Terraform
        Invoke-TerraformPlan
        Deploy-Infrastructure
        Build-AndPushImages
        Set-EnvironmentVariables
        Update-EcsServices
        Show-FinalInfo
    }
    catch {
        Write-Error "Deployment failed: $($_.Exception.Message)"
        Write-Host $_.ScriptStackTrace -ForegroundColor Red
        exit 1
    }
}

# Run main function
Main
