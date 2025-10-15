param(
  [switch]$NoBuild,
  [string]$Profile = "",
  [string]$Region = ""
)

# Minimal, fast redeploy for ECS services
# - Builds (unless -NoBuild)
# - Pushes images
# - Forces new deployments for frontend and backend
# Relies on Terraform outputs already applied.

$ErrorActionPreference = "Stop"

function Write-Info($msg) { Write-Host "[update] $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "[update] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[update] $msg" -ForegroundColor Yellow }

# Optionally set AWS profile/region for this session
if ($Profile) { $env:AWS_PROFILE = $Profile }
if ($Region) { $env:AWS_REGION = $Region }

# Read outputs using Terraform
Set-Location (Join-Path $PSScriptRoot "terraform")
$cluster = terraform output -raw ecs_cluster_name
$backendService = terraform output -raw ecs_backend_service_name
$frontendService = terraform output -raw ecs_frontend_service_name
$repoBackend = terraform output -raw ecr_backend_repository_url
$repoFrontend = terraform output -raw ecr_frontend_repository_url
$tfRegion = terraform output -raw aws_region
Set-Location (Resolve-Path "$PSScriptRoot\..")

# Login to ECR
$awsRegion = if ($env:AWS_REGION) { $env:AWS_REGION } else { $tfRegion }
Write-Info "Logging into ECR in region $awsRegion..."
aws ecr get-login-password --region $awsRegion | docker login --username AWS --password-stdin $repoBackend.Split('/')[0]

# Build and push images
if (-not $NoBuild) {
  Write-Info "Building images (linux/amd64)..."
  docker build --platform linux/amd64 -t $repoBackend:latest -f Dockerfile.backend .
  docker build --platform linux/amd64 -t $repoFrontend:latest -f Dockerfile.frontend .
}

Write-Info "Pushing images..."
docker push $repoBackend:latest
docker push $repoFrontend:latest

# Force new deployments
Write-Info "Forcing ECS deployments..."
aws ecs update-service --cluster $cluster --service $backendService --force-new-deployment | Out-Null
aws ecs update-service --cluster $cluster --service $frontendService --force-new-deployment | Out-Null

Write-Ok "Triggered new deployments for $backendService and $frontendService in $cluster"
