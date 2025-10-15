# DNS Status Checker Script
# This script helps you check the status of your DNS setup and AWS resources

param(
    [switch]$Help
)

if ($Help) {
    Write-Host "AWS DNS Status Checker" -ForegroundColor Blue
    Write-Host ""
    Write-Host "This script checks the status of your AWS deployment and DNS setup."
    Write-Host ""
    Write-Host "Usage: .\aws\dns-status.ps1" -ForegroundColor Gray
    Write-Host ""
    exit 0
}

Write-Host "🔍 Checking AWS Deployment Status for inboxleap.com..." -ForegroundColor Blue
Write-Host ""

# Check if we're in the right directory
if (!(Test-Path "terraform.tfvars")) {
    Write-Host "❌ Please run this script from the aws/terraform directory" -ForegroundColor Red
    exit 1
}

# Function to get Terraform output safely
function Get-TerraformOutput {
    param([string]$OutputName)
    
    try {
        $output = terraform output -raw $OutputName 2>$null
        return $output
    }
    catch {
        return $null
    }
}

# Check Terraform state
Write-Host "📋 Terraform Status:" -ForegroundColor Yellow
try {
    $state = terraform show -json 2>$null | ConvertFrom-Json
    if ($state) {
        $resources = $state.values.root_module.resources.Count
        Write-Host "✅ Terraform state exists with $resources resources" -ForegroundColor Green
    }
    else {
        Write-Host "⚠️ No Terraform state found. Run 'terraform apply' first." -ForegroundColor Yellow
        exit 1
    }
}
catch {
    Write-Host "❌ Cannot read Terraform state" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Get Route 53 Nameservers
Write-Host "🌐 Route 53 Nameservers:" -ForegroundColor Yellow
$nameservers = Get-TerraformOutput "route53_name_servers"
if ($nameservers) {
    $ns = $nameservers | ConvertFrom-Json
    Write-Host "Use these nameservers in your domain registrar:" -ForegroundColor Cyan
    foreach ($server in $ns) {
        Write-Host "  $server" -ForegroundColor White
    }
}
else {
    Write-Host "⚠️ Route 53 nameservers not available yet" -ForegroundColor Yellow
}

Write-Host ""

# Check current DNS resolution
Write-Host "🔍 Current DNS Status:" -ForegroundColor Yellow
$domain = "inboxleap.com"

try {
    $dnsResult = Resolve-DnsName -Name $domain -Type A -ErrorAction SilentlyContinue
    if ($dnsResult) {
        Write-Host "Current DNS resolution for $domain" ":" -ForegroundColor Cyan
        $dnsResult | ForEach-Object { 
            Write-Host "  $($_.IPAddress)" -ForegroundColor White
        }
        
        # Check if pointing to AWS
        $albDns = Get-TerraformOutput "load_balancer_dns"
        if ($albDns) {
            try {
                $albIps = Resolve-DnsName -Name $albDns -Type A | Select-Object -ExpandProperty IPAddress
                $domainIps = $dnsResult | Select-Object -ExpandProperty IPAddress
                
                $matching = Compare-Object $albIps $domainIps -IncludeEqual -ExcludeDifferent
                if ($matching) {
                    Write-Host "✅ DNS is correctly pointing to AWS Load Balancer!" -ForegroundColor Green
                }
                else {
                    Write-Host "⚠️ DNS is not yet pointing to AWS. Update your nameservers." -ForegroundColor Yellow
                }
            }
            catch {
                Write-Host "⚠️ Could not verify AWS Load Balancer IPs" -ForegroundColor Yellow
            }
        }
    }
    else {
        Write-Host "❌ Domain $domain does not resolve" -ForegroundColor Red
    }
}
catch {
    Write-Host "❌ Could not check DNS for $domain" -ForegroundColor Red
}

Write-Host ""

# Check SSL Certificate Status
Write-Host "🔐 SSL Certificate Status:" -ForegroundColor Yellow
try {
    $certArn = Get-TerraformOutput "certificate_arn"
    if ($certArn) {
        $certStatus = aws acm describe-certificate --certificate-arn $certArn --query 'Certificate.Status' --output text 2>$null
        if ($certStatus) {
            switch ($certStatus) {
                "ISSUED" { 
                    Write-Host "✅ SSL Certificate: ISSUED" -ForegroundColor Green 
                }
                "PENDING_VALIDATION" { 
                    Write-Host "⏳ SSL Certificate: Waiting for DNS validation" -ForegroundColor Yellow 
                }
                "FAILED" { 
                    Write-Host "❌ SSL Certificate: FAILED" -ForegroundColor Red 
                }
                default { 
                    Write-Host "⚠️ SSL Certificate: $certStatus" -ForegroundColor Yellow 
                }
            }
        }
        else {
            Write-Host "⚠️ Could not check certificate status" -ForegroundColor Yellow
        }
    }
    else {
        Write-Host "⚠️ Certificate ARN not available" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "❌ Error checking SSL certificate" -ForegroundColor Red
}

Write-Host ""

# Check SES Domain Status
Write-Host "📧 SES Domain Verification:" -ForegroundColor Yellow
try {
    $sesStatus = aws ses get-identity-verification-attributes --identities inboxleap.com --query 'VerificationAttributes."inboxleap.com".VerificationStatus' --output text 2>$null
    if ($sesStatus) {
        switch ($sesStatus) {
            "Success" { 
                Write-Host "✅ SES Domain: Verified" -ForegroundColor Green 
            }
            "Pending" { 
                Write-Host "⏳ SES Domain: Waiting for verification" -ForegroundColor Yellow 
            }
            "Failed" { 
                Write-Host "❌ SES Domain: Verification failed" -ForegroundColor Red 
            }
            default { 
                Write-Host "⚠️ SES Domain: $sesStatus" -ForegroundColor Yellow 
            }
        }
    }
    else {
        Write-Host "⚠️ Could not check SES domain status" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "❌ Error checking SES domain" -ForegroundColor Red
}

Write-Host ""

# Check ECS Services
Write-Host "🐳 ECS Services Status:" -ForegroundColor Yellow
try {
    $clusterName = Get-TerraformOutput "ecs_cluster_name"
    if ($clusterName) {
        $services = aws ecs describe-services --cluster $clusterName --services inboxleap-production-backend inboxleap-production-frontend --query 'services[*].[serviceName,status,runningCount,desiredCount]' --output json 2>$null
        if ($services) {
            $serviceData = $services | ConvertFrom-Json
            foreach ($service in $serviceData) {
                $name = $service[0]
                $status = $service[1]
                $running = $service[2]
                $desired = $service[3]
                
                if ($status -eq "ACTIVE" -and $running -eq $desired) {
                    Write-Host "✅ $name : ACTIVE ($running/$desired tasks)" -ForegroundColor Green
                }
                else {
                    Write-Host "⚠️ $name : $status ($running/$desired tasks)" -ForegroundColor Yellow
                }
            }
        }
        else {
            Write-Host "⚠️ Could not get ECS service status" -ForegroundColor Yellow
        }
    }
    else {
        Write-Host "⚠️ ECS cluster name not available" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "❌ Error checking ECS services" -ForegroundColor Red
}

Write-Host ""

# Check Application URL
Write-Host "🌐 Application URLs:" -ForegroundColor Yellow
$appUrl = Get-TerraformOutput "application_url"
$albDns = Get-TerraformOutput "load_balancer_dns"

if ($appUrl) {
    Write-Host "Target URL: $appUrl" -ForegroundColor Cyan
}
if ($albDns) {
    Write-Host "Direct ALB: http://$albDns" -ForegroundColor Cyan
}

Write-Host ""

# Summary and Next Steps
Write-Host "📋 Summary & Next Steps:" -ForegroundColor Blue

$dnsReady = $false
try {
    $dnsTest = Resolve-DnsName -Name $domain -Type A -ErrorAction SilentlyContinue
    $albDnsCheck = Get-TerraformOutput "load_balancer_dns"
    if ($dnsTest -and $albDnsCheck) {
        $albIps = Resolve-DnsName -Name $albDnsCheck -Type A | Select-Object -ExpandProperty IPAddress
        $domainIps = $dnsTest | Select-Object -ExpandProperty IPAddress
        $matching = Compare-Object $albIps $domainIps -IncludeEqual -ExcludeDifferent
        $dnsReady = $matching -ne $null
    }
}
catch {
    $dnsReady = $false
}

if (-not $dnsReady) {
    Write-Host ""
    Write-Host "🎯 IMMEDIATE ACTION REQUIRED:" -ForegroundColor Red
    Write-Host "1. Update your domain registrar with the Route 53 nameservers above" -ForegroundColor Yellow
    Write-Host "2. Wait 1-4 hours for DNS propagation" -ForegroundColor Yellow
    Write-Host "3. Run this script again to check progress" -ForegroundColor Yellow
    Write-Host "4. See aws\DNS_SETUP_GUIDE.md for detailed instructions" -ForegroundColor Yellow
}
else {
    Write-Host ""
    Write-Host "🎉 DNS LOOKS GOOD!" -ForegroundColor Green
    Write-Host "1. Run 'terraform apply' to complete validation" -ForegroundColor Yellow
    Write-Host "2. Build and deploy Docker images" -ForegroundColor Yellow
    Write-Host "3. Configure SES SMTP credentials" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "💡 Helpful commands:" -ForegroundColor Cyan
Write-Host "  terraform apply              # Complete the deployment" -ForegroundColor Gray
Write-Host "  .\dns-status.ps1            # Check status again" -ForegroundColor Gray
Write-Host "  ..\post-deploy.ps1 -Action status  # Check service health" -ForegroundColor Gray
