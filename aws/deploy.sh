#!/bin/bash
# AWS Deployment Script for EmailTaskRouter (Bash)
# This script automates the deployment process on Unix/Linux/macOS

set -e  # Exit on any error

# Command line parameters
SKIP_PREREQUISITES=false
SKIP_PLAN=false
TERRAFORM_VARS_FILE="terraform.tfvars"
UPDATE_ONLY=false
SKIP_SECRETS=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-prerequisites)
            SKIP_PREREQUISITES=true
            shift
            ;;
        --skip-plan)
            SKIP_PLAN=true
            shift
            ;;
        --terraform-vars-file)
            TERRAFORM_VARS_FILE="$2"
            shift 2
            ;;
        --update-only)
            UPDATE_ONLY=true
            shift
            ;;
        --skip-secrets)
            SKIP_SECRETS=true
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --skip-prerequisites    Skip checking prerequisites"
            echo "  --skip-plan            Skip Terraform plan step"
            echo "  --terraform-vars-file  Specify terraform vars file (default: terraform.tfvars)"
            echo "  --update-only          Only build/push images and update ECS services"
            echo "  --skip-secrets         Skip secrets/SSM parameter updates"
            echo "  --help                 Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Color functions
print_blue() { echo -e "\033[34m$1\033[0m"; }
print_cyan() { echo -e "\033[36m[INFO] $1\033[0m"; }
print_green() { echo -e "\033[32m[SUCCESS] $1\033[0m"; }
print_yellow() { echo -e "\033[33m[WARNING] $1\033[0m"; }
print_red() { echo -e "\033[31m[ERROR] $1\033[0m"; }

print_blue "🚀 Starting AWS deployment for EmailTaskRouter..."

# Check prerequisites
check_prerequisites() {
    if [[ "$SKIP_PREREQUISITES" == "true" ]]; then
        print_cyan "Skipping prerequisites check..."
        return
    fi
    
    print_cyan "Checking prerequisites..."
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        print_red "AWS CLI is not installed. Please install it first."
        exit 1
    fi
    
    # Check Terraform
    if ! command -v terraform &> /dev/null; then
        print_red "Terraform is not installed. Please install it first."
        exit 1
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_red "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        print_red "Docker daemon is not running. Please start Docker."
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        print_red "AWS credentials not configured. Run 'aws configure' first."
        exit 1
    fi
    
    print_green "All prerequisites met!"
}

# Initialize Terraform
initialize_terraform() {
    print_cyan "Initializing Terraform..."
    cd "$(dirname "$0")/terraform"
    
    if [[ ! -f "$TERRAFORM_VARS_FILE" ]]; then
        print_yellow "$TERRAFORM_VARS_FILE not found. Copying example file..."
        cp terraform.tfvars.example "$TERRAFORM_VARS_FILE"
        print_yellow "Please edit $TERRAFORM_VARS_FILE with your actual values before continuing."
        
        # Open the file in default editor
        if command -v code &> /dev/null; then
            code "$TERRAFORM_VARS_FILE"
        elif command -v nano &> /dev/null; then
            nano "$TERRAFORM_VARS_FILE"
        elif command -v vim &> /dev/null; then
            vim "$TERRAFORM_VARS_FILE"
        else
            print_yellow "Please manually edit $TERRAFORM_VARS_FILE with your preferred editor."
        fi
        
        read -p "Press Enter to continue after editing $TERRAFORM_VARS_FILE..."
    fi
    
    terraform init
    print_green "Terraform initialized!"
}

# Plan deployment
terraform_plan() {
    if [[ "$SKIP_PLAN" == "true" ]]; then
        print_cyan "Skipping Terraform plan..."
        return
    fi
    
    print_cyan "Planning deployment..."
    terraform plan -out=tfplan
    
    echo ""
    print_yellow "Please review the plan above carefully."
    read -p "Do you want to proceed with the deployment? (y/N): " proceed
    
    if [[ ! "$proceed" =~ ^[Yy]$ ]]; then
        print_cyan "Deployment cancelled."
        exit 0
    fi
}

# Apply infrastructure
deploy_infrastructure() {
    print_cyan "Applying infrastructure..."
    
    if [[ -f "tfplan" ]]; then
        terraform apply tfplan
    else
        terraform apply -auto-approve
    fi
    
    print_green "Infrastructure deployed!"
}

# Build and push Docker images
build_and_push_images() {
    print_cyan "Building and pushing Docker images..."
    
    # Go back to project root
    cd "../.."
    
    # Get ECR URLs from Terraform output
    cd "$(dirname "$0")/terraform"
    backend_ecr_url=$(terraform output -raw ecr_backend_repository_url)
    frontend_ecr_url=$(terraform output -raw ecr_frontend_repository_url)
    aws_account_id=$(aws sts get-caller-identity --query Account --output text)
    aws_region=$(terraform output -raw aws_region)
    
    cd "../.."
    
    print_cyan "ECR Backend URL: $backend_ecr_url"
    print_cyan "ECR Frontend URL: $frontend_ecr_url"
    
    # Login to ECR
    print_cyan "Logging into ECR..."
    max_retries=3
    retry_count=0
    
    while [[ $retry_count -lt $max_retries ]]; do
        if aws ecr get-login-password --region "$aws_region" | docker login --username AWS --password-stdin "$aws_account_id.dkr.ecr.$aws_region.amazonaws.com"; then
            print_green "Successfully logged into ECR"
            break
        else
            ((retry_count++))
            print_yellow "ECR login attempt $retry_count failed. Retrying..."
            if [[ $retry_count -eq $max_retries ]]; then
                print_red "Failed to login to ECR after $max_retries attempts"
                print_cyan "Please check your AWS credentials and region."
                exit 1
            fi
            sleep 5
        fi
    done
    
    # Build backend image
    print_cyan "Building backend image..."
    if docker build -f Dockerfile.backend -t emailtaskrouter-backend .; then
        docker tag emailtaskrouter-backend:latest "$backend_ecr_url:latest"
        print_green "Backend image built successfully"
    else
        print_red "Failed to build backend image"
        exit 1
    fi
    
    # Build frontend image
    print_cyan "Building frontend image..."
    if docker build -f Dockerfile.frontend -t emailtaskrouter-frontend .; then
        docker tag emailtaskrouter-frontend:latest "$frontend_ecr_url:latest"
        print_green "Frontend image built successfully"
    else
        print_red "Failed to build frontend image"
        exit 1
    fi
    
    # Push images with retry logic
    print_cyan "Pushing backend image..."
    retry_count=0
    while [[ $retry_count -lt $max_retries ]]; do
        if docker push "$backend_ecr_url:latest"; then
            print_green "Backend image pushed successfully"
            break
        else
            ((retry_count++))
            print_yellow "Backend push attempt $retry_count failed. Retrying..."
            if [[ $retry_count -eq $max_retries ]]; then
                print_red "Failed to push backend image after $max_retries attempts"
                exit 1
            fi
            sleep 5
        fi
    done
    
    print_cyan "Pushing frontend image..."
    retry_count=0
    while [[ $retry_count -lt $max_retries ]]; do
        if docker push "$frontend_ecr_url:latest"; then
            print_green "Frontend image pushed successfully"
            break
        else
            ((retry_count++))
            print_yellow "Frontend push attempt $retry_count failed. Retrying..."
            if [[ $retry_count -eq $max_retries ]]; then
                print_red "Failed to push frontend image after $max_retries attempts"
                exit 1
            fi
        fi
    done
    
    print_green "Docker images built and pushed!"
}

# Helper function to get SSM parameter value or return empty string
get_ssm_or_empty() {
    local name="$1"
    local secure="$2"
    
    if [[ "$secure" == "true" ]]; then
        aws ssm get-parameter --with-decryption --name "$name" --query "Parameter.Value" --output text 2>/dev/null || echo ""
    else
        aws ssm get-parameter --name "$name" --query "Parameter.Value" --output text 2>/dev/null || echo ""
    fi
}

# Helper function to read password securely
read_password() {
    local prompt="$1"
    echo -n "$prompt: "
    read -s password
    echo
    echo "$password"
}

# Configure environment variables
set_environment_variables() {
    print_cyan "Configuring environment variables..."
    
    if [[ "$SKIP_SECRETS" == "true" ]]; then
        print_cyan "Skipping secrets/SSM parameter updates (--skip-secrets specified)."
        return
    fi

    cd "$(dirname "$0")/terraform"
    
    # Get outputs from Terraform
    app_url=$(terraform output -raw application_url)
    aws_region=$(terraform output -raw aws_region)

    # Derive the SSM prefix from terraform.tfvars
    app_name="inboxleap-us"
    environment="production"
    if [[ -f "$TERRAFORM_VARS_FILE" ]]; then
        if grep -q 'app_name.*=' "$TERRAFORM_VARS_FILE"; then
            app_name=$(grep 'app_name.*=' "$TERRAFORM_VARS_FILE" | sed 's/.*=\s*"\([^"]*\)".*/\1/')
        fi
        if grep -q 'environment.*=' "$TERRAFORM_VARS_FILE"; then
            environment=$(grep 'environment.*=' "$TERRAFORM_VARS_FILE" | sed 's/.*=\s*"\([^"]*\)".*/\1/')
        fi
    fi
    name_prefix="$app_name-$environment"
    print_cyan "Using SSM prefix: /$name_prefix/*"

    # Read existing values first; prompt only if missing
    google_client_id=$(get_ssm_or_empty "/$name_prefix/GOOGLE_CLIENT_ID" "false")
    if [[ -z "$google_client_id" ]]; then
        read -p "Google OAuth Client ID: " google_client_id
    fi

    google_client_secret=$(get_ssm_or_empty "/$name_prefix/GOOGLE_CLIENT_SECRET" "true")
    if [[ -z "$google_client_secret" ]]; then
        google_client_secret=$(read_password "Google OAuth Client Secret")
    fi

    session_secret=$(get_ssm_or_empty "/$name_prefix/SESSION_SECRET" "true")
    if [[ -z "$session_secret" ]]; then
        session_secret=$(read_password "Session secret")
    fi

    claude_api_key=$(get_ssm_or_empty "/$name_prefix/CLAUDE_API_KEY" "true")
    if [[ -z "$claude_api_key" ]]; then
        claude_api_key=$(read_password "Claude API key (optional, press Enter to skip)")
    fi

    # Read Postmark settings
    postmark_token=$(get_ssm_or_empty "/$name_prefix/POSTMARK_SERVER_TOKEN" "true")
    if [[ -z "$postmark_token" ]]; then
        postmark_token=$(read_password "Postmark Server Token")
    fi
    
    postmark_from=$(get_ssm_or_empty "/$name_prefix/POSTMARK_FROM_EMAIL" "false")
    if [[ -z "$postmark_from" ]]; then
        read -p "Postmark FROM email (e.g., service@yourdomain.com): " postmark_from
    fi

    # Read Neon database URL from .env file
    env_path="$(dirname "$0")/../.env"
    database_url=""
    if [[ -f "$env_path" ]]; then
        database_url=$(grep "^DATABASE_URL=" "$env_path" | cut -d'=' -f2- | tr -d '"')
    fi
    
    if [[ -z "$database_url" ]]; then
        print_red "DATABASE_URL not found in .env file. Please ensure your .env file contains the Neon database URL."
        exit 1
    fi
    
    print_cyan "Using DATABASE_URL from .env file"

    # Create/overwrite SSM parameters
    aws ssm put-parameter --name "/$name_prefix/SESSION_SECRET" --value "$session_secret" --type "SecureString" --overwrite > /dev/null
    aws ssm put-parameter --name "/$name_prefix/GOOGLE_CLIENT_ID" --value "$google_client_id" --type "String" --overwrite > /dev/null
    aws ssm put-parameter --name "/$name_prefix/GOOGLE_CLIENT_SECRET" --value "$google_client_secret" --type "SecureString" --overwrite > /dev/null
    
    if [[ -n "$claude_api_key" ]]; then
        aws ssm put-parameter --name "/$name_prefix/CLAUDE_API_KEY" --value "$claude_api_key" --type "SecureString" --overwrite > /dev/null
    fi

    # Postmark
    if [[ -n "$postmark_token" ]]; then
        aws ssm put-parameter --name "/$name_prefix/POSTMARK_SERVER_TOKEN" --value "$postmark_token" --type "SecureString" --overwrite > /dev/null
    fi
    if [[ -n "$postmark_from" ]]; then
        aws ssm put-parameter --name "/$name_prefix/POSTMARK_FROM_EMAIL" --value "$postmark_from" --type "String" --overwrite > /dev/null
    fi

    # Optional app settings
    aws ssm put-parameter --name "/$name_prefix/APP_URL" --value "$app_url" --type "String" --overwrite > /dev/null
    aws ssm put-parameter --name "/$name_prefix/DATABASE_URL" --value "$database_url" --type "SecureString" --overwrite > /dev/null

    # SES SMTP convenience values
    aws ssm put-parameter --name "/$name_prefix/SMTP_HOST" --value "email-smtp.$aws_region.amazonaws.com" --type "String" --overwrite > /dev/null
    aws ssm put-parameter --name "/$name_prefix/SMTP_PORT" --value "587" --type "String" --overwrite > /dev/null
    
    cd "../.."
    
    print_green "Environment variables stored in SSM under $name_prefix/*"
    print_yellow "Ensure your Google OAuth redirect URI is $app_url/api/auth/google/callback"
}

# Update ECS services
update_ecs_services() {
    print_cyan "Updating ECS services..."
    
    cd "$(dirname "$0")/terraform"
    
    cluster_name=$(terraform output -raw ecs_cluster_name)
    backend_service_name=$(terraform output -raw ecs_backend_service_name)
    frontend_service_name=$(terraform output -raw ecs_frontend_service_name)
    
    # Force new deployment with latest images
    aws ecs update-service --cluster "$cluster_name" --service "$backend_service_name" --force-new-deployment > /dev/null
    aws ecs update-service --cluster "$cluster_name" --service "$frontend_service_name" --force-new-deployment > /dev/null
    
    cd "../.."
    
    print_green "ECS services updated!"
}

# Display final information
show_final_info() {
    print_green "🎉 Deployment completed!"
    
    cd "$(dirname "$0")/terraform"
    
    echo ""
    print_yellow "=== Deployment Information ==="
    
    app_url=$(terraform output -raw application_url)
    alb_dns=$(terraform output -raw load_balancer_dns)
    name_servers=$(terraform output -json route53_name_servers | jq -r '.[]')
    
    echo "Application URL: $app_url"
    echo "ALB DNS Name: $alb_dns"
    echo "Route 53 Name Servers:"
    echo "$name_servers" | while read -r ns; do
        echo "  $ns"
    done
    echo ""
    
    cd "../.."
    
    print_yellow "Next Steps:"
    echo "1. Update your domain's nameservers to the Route 53 nameservers above"
    echo "2. Verify your domain in SES console"
    echo "3. Set up SES SMTP credentials and update SSM parameters"
    echo "4. Wait for DNS propagation (up to 48 hours)"
    echo "5. Test your application at the URL above"
    echo ""
    
    print_cyan "For detailed instructions, see aws/AWS_DEPLOYMENT_GUIDE.md"
}

# Main execution
main() {
    if [[ "$UPDATE_ONLY" == "true" ]]; then
        print_cyan "Quick update mode: building, pushing images and forcing ECS redeploy (no Terraform, no secrets)."
        build_and_push_images
        update_ecs_services
        show_final_info
        return
    fi

    check_prerequisites
    initialize_terraform
    terraform_plan
    deploy_infrastructure
    build_and_push_images
    set_environment_variables
    update_ecs_services
    show_final_info
}

# Run main function
main "$@"