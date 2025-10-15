# Post-Deployment Helper Script
# Common tasks after AWS deployment

param(
    [string]$Action,
    [switch]$Help
)

if ($Help -or [string]::IsNullOrWhiteSpace($Action)) {
    Write-Host "EmailTaskRouter Post-Deployment Helper" -ForegroundColor Blue
    Write-Host ""
    Write-Host "Usage: .\aws\post-deploy.ps1 -Action <action>" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Available actions:" -ForegroundColor Yellow
    Write-Host "  status        - Check deployment status"
    Write-Host "  logs          - View application logs"
    Write-Host "  restart       - Restart ECS services"
    Write-Host "  ses-setup     - Help with SES configuration"
    Write-Host "  dns-check     - Check DNS propagation"
    Write-Host "  health        - Check application health"
    Write-Host "  costs         - Check AWS costs"
    Write-Host "  cleanup       - Clean up old resources"
    Write-Host ""
    exit 0
}

function Get-TerraformOutput {
    param([string]$OutputName)
    
    Push-Location "aws\terraform"
    try {
        $output = terraform output -raw $OutputName 2>$null
        return $output
    }
    catch {
        Write-Warning "Could not get Terraform output: $OutputName"
        return $null
    }
    finally {
        Pop-Location
    }
}

function Show-DeploymentStatus {
    Write-Host "🔍 Checking deployment status..." -ForegroundColor Blue
    
    $clusterName = Get-TerraformOutput "ecs_cluster_name"
    $appUrl = Get-TerraformOutput "application_url"
    
    if ($clusterName) {
        Write-Host ""
        Write-Host "ECS Services:" -ForegroundColor Yellow
        aws ecs describe-services --cluster $clusterName --services emailtaskrouter-backend emailtaskrouter-frontend --query 'services[*].[serviceName,status,runningCount,desiredCount]' --output table
        
        Write-Host ""
        Write-Host "ECS Tasks:" -ForegroundColor Yellow
        aws ecs list-tasks --cluster $clusterName --query 'taskArns' --output table
    }
    
    if ($appUrl) {
        Write-Host ""
        Write-Host "Application URL: $appUrl" -ForegroundColor Green
        
        try {
            $response = Invoke-WebRequest -Uri $appUrl -Method Head -TimeoutSec 10
            Write-Host "✅ Application is responding (Status: $($response.StatusCode))" -ForegroundColor Green
        }
        catch {
            Write-Host "❌ Application is not responding: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

function Show-ApplicationLogs {
    Write-Host "📋 Fetching application logs..." -ForegroundColor Blue
    
    $services = @("backend", "frontend")
    
    foreach ($service in $services) {
        Write-Host ""
        Write-Host "=== $service logs ===" -ForegroundColor Yellow
        
        try {
            aws logs tail "/ecs/emailtaskrouter-$service" --since 1h --format short
        }
        catch {
            Write-Warning "Could not fetch logs for $service"
        }
    }
}

function Restart-EcsServices {
    Write-Host "🔄 Restarting ECS services..." -ForegroundColor Blue
    
    $clusterName = Get-TerraformOutput "ecs_cluster_name"
    
    if ($clusterName) {
        aws ecs update-service --cluster $clusterName --service emailtaskrouter-backend --force-new-deployment
        aws ecs update-service --cluster $clusterName --service emailtaskrouter-frontend --force-new-deployment
        
        Write-Host "✅ Services restart initiated. Check status in a few minutes." -ForegroundColor Green
    }
    else {
        Write-Error "Could not determine cluster name"
    }
}

function Show-SesSetup {
    Write-Host "📧 SES Configuration Guide" -ForegroundColor Blue
    Write-Host ""
    
    $domainName = Get-TerraformOutput "domain_name"
    
    Write-Host "1. Verify your domain in SES:" -ForegroundColor Yellow
    Write-Host "   - Go to AWS SES Console"
    Write-Host "   - Navigate to 'Verified identities'"
    Write-Host "   - Find your domain: $domainName"
    Write-Host "   - Complete DNS verification"
    Write-Host ""
    
    Write-Host "2. Create SMTP credentials:" -ForegroundColor Yellow
    Write-Host "   - In SES Console, go to 'SMTP settings'"
    Write-Host "   - Click 'Create SMTP credentials'"
    Write-Host "   - Save the username and password"
    Write-Host ""
    
    Write-Host "3. Update SSM parameters:" -ForegroundColor Yellow
    Write-Host "   Run these commands with your SMTP credentials:"
    Write-Host "   aws ssm put-parameter --name '/emailtaskrouter/SMTP_USER' --value 'YOUR_SMTP_USERNAME' --type 'SecureString' --overwrite"
    Write-Host "   aws ssm put-parameter --name '/emailtaskrouter/SMTP_PASS' --value 'YOUR_SMTP_PASSWORD' --type 'SecureString' --overwrite"
    Write-Host ""
    
    Write-Host "4. Move out of SES sandbox (for production):" -ForegroundColor Yellow
    Write-Host "   - In SES Console, request production access"
    Write-Host "   - This allows sending to any email address"
}

function Test-DnsPropagation {
    Write-Host "🌐 Checking DNS propagation..." -ForegroundColor Blue
    
    $domainName = Get-TerraformOutput "domain_name"
    $albDns = Get-TerraformOutput "alb_dns_name"
    
    if ($domainName -and $albDns) {
        Write-Host ""
        Write-Host "Domain: $domainName" -ForegroundColor Yellow
        Write-Host "Expected target: $albDns" -ForegroundColor Yellow
        Write-Host ""
        
        try {
            $dnsResult = Resolve-DnsName -Name $domainName -Type A
            Write-Host "Current DNS resolution:" -ForegroundColor Cyan
            $dnsResult | ForEach-Object { Write-Host "  $($_.IPAddress)" }
            
            # Check if it matches ALB
            $albIps = Resolve-DnsName -Name $albDns -Type A | Select-Object -ExpandProperty IPAddress
            $domainIps = $dnsResult | Select-Object -ExpandProperty IPAddress
            
            $matching = Compare-Object $albIps $domainIps -IncludeEqual -ExcludeDifferent
            if ($matching) {
                Write-Host "✅ DNS is correctly pointing to the load balancer!" -ForegroundColor Green
            }
            else {
                Write-Host "⚠️ DNS is not yet pointing to the load balancer. Wait for propagation." -ForegroundColor Yellow
            }
        }
        catch {
            Write-Host "❌ Could not resolve DNS for $domainName" -ForegroundColor Red
        }
    }
}

function Test-ApplicationHealth {
    Write-Host "🏥 Checking application health..." -ForegroundColor Blue
    
    $appUrl = Get-TerraformOutput "application_url"
    $albDns = Get-TerraformOutput "alb_dns_name"
    
    # Test direct ALB access
    if ($albDns) {
        Write-Host ""
        Write-Host "Testing direct ALB access..." -ForegroundColor Yellow
        try {
            $response = Invoke-WebRequest -Uri "http://$albDns" -Method Head -TimeoutSec 10
            Write-Host "✅ ALB is responding (Status: $($response.StatusCode))" -ForegroundColor Green
        }
        catch {
            Write-Host "❌ ALB is not responding: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
    # Test application URL
    if ($appUrl) {
        Write-Host ""
        Write-Host "Testing application URL..." -ForegroundColor Yellow
        try {
            $response = Invoke-WebRequest -Uri $appUrl -Method Head -TimeoutSec 10
            Write-Host "✅ Application URL is responding (Status: $($response.StatusCode))" -ForegroundColor Green
        }
        catch {
            Write-Host "❌ Application URL is not responding: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
    # Check target group health
    $clusterName = Get-TerraformOutput "ecs_cluster_name"
    if ($clusterName) {
        Write-Host ""
        Write-Host "Checking ECS service health..." -ForegroundColor Yellow
        
        $services = aws ecs describe-services --cluster $clusterName --services emailtaskrouter-backend emailtaskrouter-frontend --query 'services[*].[serviceName,status,runningCount,desiredCount]' --output json | ConvertFrom-Json
        
        foreach ($service in $services) {
            $name = $service[0]
            $status = $service[1]
            $running = $service[2]
            $desired = $service[3]
            
            if ($status -eq "ACTIVE" -and $running -eq $desired) {
                Write-Host "✅ $name is healthy ($running/$desired tasks)" -ForegroundColor Green
            }
            else {
                Write-Host "⚠️ $name has issues: Status=$status, Tasks=$running/$desired" -ForegroundColor Yellow
            }
        }
    }
}

function Show-AWSCosts {
    Write-Host "💰 Checking AWS costs..." -ForegroundColor Blue
    Write-Host ""
    
    $endDate = Get-Date
    $startDate = $endDate.AddDays(-30)
    
    try {
        $costs = aws ce get-cost-and-usage --time-period Start=$($startDate.ToString('yyyy-MM-dd')),End=$($endDate.ToString('yyyy-MM-dd')) --granularity MONTHLY --metrics BlendedCost --group-by Type=DIMENSION,Key=SERVICE --query 'ResultsByTime[0].Groups[?Metrics.BlendedCost.Amount>`"0`"].[Keys[0],Metrics.BlendedCost.Amount]' --output json | ConvertFrom-Json
        
        Write-Host "Last 30 days AWS costs by service:" -ForegroundColor Yellow
        $costs | ForEach-Object { 
            $service = $_[0]
            $amount = [math]::Round([decimal]$_[1], 2)
            Write-Host "  $service`: `$$amount" 
        }
        
        $total = $costs | ForEach-Object { [decimal]$_[1] } | Measure-Object -Sum | Select-Object -ExpandProperty Sum
        Write-Host ""
        Write-Host "Total: `$$([math]::Round($total, 2))" -ForegroundColor Cyan
    }
    catch {
        Write-Warning "Could not fetch cost data. Make sure you have billing permissions."
    }
}

function Invoke-Cleanup {
    Write-Host "🧹 Cleanup old resources..." -ForegroundColor Blue
    
    Write-Warning "This will clean up old Docker images and unused resources."
    $confirm = Read-Host "Are you sure? (y/N)"
    
    if ($confirm -match "^[Yy]$") {
        # Clean up old ECR images
        $backendRepo = Get-TerraformOutput "ecr_backend_repository_name"
        $frontendRepo = Get-TerraformOutput "ecr_frontend_repository_name"
        
        if ($backendRepo) {
            Write-Host "Cleaning up old backend images..." -ForegroundColor Yellow
            aws ecr list-images --repository-name $backendRepo --filter tagStatus=UNTAGGED --query 'imageIds[?imageDigest!=null]' --output json | ConvertFrom-Json | ForEach-Object {
                aws ecr batch-delete-image --repository-name $backendRepo --image-ids imageDigest=$_.imageDigest
            }
        }
        
        if ($frontendRepo) {
            Write-Host "Cleaning up old frontend images..." -ForegroundColor Yellow
            aws ecr list-images --repository-name $frontendRepo --filter tagStatus=UNTAGGED --query 'imageIds[?imageDigest!=null]' --output json | ConvertFrom-Json | ForEach-Object {
                aws ecr batch-delete-image --repository-name $frontendRepo --image-ids imageDigest=$_.imageDigest
            }
        }
        
        Write-Host "✅ Cleanup completed" -ForegroundColor Green
    }
}

# Main execution
switch ($Action.ToLower()) {
    "status" { Show-DeploymentStatus }
    "logs" { Show-ApplicationLogs }
    "restart" { Restart-EcsServices }
    "ses-setup" { Show-SesSetup }
    "dns-check" { Test-DnsPropagation }
    "health" { Test-ApplicationHealth }
    "costs" { Show-AWSCosts }
    "cleanup" { Invoke-Cleanup }
    default {
        Write-Error "Unknown action: $Action. Use -Help to see available actions."
    }
}
