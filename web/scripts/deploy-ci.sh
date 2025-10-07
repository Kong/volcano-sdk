#!/bin/bash

# CI/CD deployment script for Volcano SDK Site
# This script is optimized for automated deployments with proper state management

set -e

# Configuration
ENVIRONMENT="${ENVIRONMENT:-prod}"
AWS_REGION="${AWS_REGION:-us-east-1}"
TERRAFORM_VERSION="${TERRAFORM_VERSION:-latest}"

# Colors for output (detect if running in CI)
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    NC='\033[0m'
else
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    NC=''
fi

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Error handler
error_handler() {
    log_error "Deployment failed at line $1"
    exit 1
}

trap 'error_handler $LINENO' ERR

# Check prerequisites
check_prerequisites() {
    log_step "Checking prerequisites..."

    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed"
        exit 1
    fi

    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials are not configured or invalid"
        exit 1
    fi

    # Check Terraform
    if ! command -v terraform &> /dev/null; then
        log_error "Terraform is not installed"
        exit 1
    fi

    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi

    log_info "All prerequisites met"
}

# Build application
build_application() {
    log_step "Building application..."

    # Install dependencies if needed
    if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
        log_info "Installing dependencies..."
        npm ci --prefer-offline --no-audit
    fi

    # Run build
    log_info "Running build process..."
    npm run build

    # Verify build output
    if [ ! -d "dist" ]; then
        log_error "Build failed - dist directory not found"
        exit 1
    fi

    log_info "Build completed successfully"
}

# Initialize Terraform with state management
init_terraform() {
    log_step "Initializing Terraform..."
    cd terraform

    # Check for remote backend configuration
    if grep -q "backend \"s3\"" backend.tf 2>/dev/null && ! grep -q "^#.*backend \"s3\"" backend.tf 2>/dev/null; then
        log_info "Remote backend configured. Initializing with state sync..."

        # Force reconfigure to ensure we have the latest backend config
        terraform init -backend=true -reconfigure

        # Pull the latest state
        log_info "Pulling latest state from remote backend..."
        terraform refresh -lock=true -lock-timeout=30s

        # Verify we can access the state
        if ! terraform state list &>/dev/null; then
            log_error "Cannot access Terraform state. Check backend configuration and permissions."
            exit 1
        fi

        log_info "Remote state synchronized successfully"
    else
        log_info "Using local backend"
        terraform init
    fi

    # Validate configuration
    log_info "Validating Terraform configuration..."
    terraform validate

    cd ..
}

# Deploy infrastructure
deploy_infrastructure() {
    log_step "Deploying infrastructure..."
    cd terraform

    # Create detailed plan
    log_info "Creating deployment plan..."
    terraform plan \
        -lock=true \
        -lock-timeout=30s \
        -out=tfplan \
        -detailed-exitcode || PLAN_EXIT_CODE=$?

    # Check plan exit code
    # 0 = no changes, 1 = error, 2 = changes present
    if [ "${PLAN_EXIT_CODE:-0}" -eq 1 ]; then
        log_error "Terraform plan failed"
        rm -f tfplan
        exit 1
    elif [ "${PLAN_EXIT_CODE:-0}" -eq 0 ]; then
        log_info "No infrastructure changes needed"
        rm -f tfplan
    else
        log_info "Applying infrastructure changes..."
        terraform apply \
            -lock=true \
            -lock-timeout=30s \
            tfplan

        rm -f tfplan
        log_info "Infrastructure deployed successfully"
    fi

    # Export outputs for later use
    export S3_BUCKET=$(terraform output -raw s3_bucket_name)
    export CLOUDFRONT_ID=$(terraform output -raw cloudfront_distribution_id)
    export WEBSITE_URL=$(terraform output -raw website_url)

    cd ..
}

# Upload files to S3
upload_to_s3() {
    log_step "Uploading files to S3..."

    if [ -z "$S3_BUCKET" ]; then
        log_error "S3 bucket name not found"
        exit 1
    fi

    # Upload static assets with long cache
    log_info "Uploading static assets..."
    aws s3 sync dist/ "s3://$S3_BUCKET/" \
        --delete \
        --cache-control "public, max-age=31536000" \
        --exclude "*.html" \
        --exclude "*.json" \
        --exclude "service-worker.js" \
        --exclude "manifest.json"

    # Upload HTML/JSON with no cache
    log_info "Uploading HTML and JSON files..."
    aws s3 sync dist/ "s3://$S3_BUCKET/" \
        --delete \
        --cache-control "public, max-age=0, must-revalidate" \
        --exclude "*" \
        --include "*.html" \
        --include "*.json" \
        --include "service-worker.js" \
        --include "manifest.json"

    log_info "Files uploaded successfully"
}

# Invalidate CloudFront cache
invalidate_cache() {
    log_step "Invalidating CloudFront cache..."

    if [ -z "$CLOUDFRONT_ID" ]; then
        log_error "CloudFront distribution ID not found"
        exit 1
    fi

    # Create invalidation
    INVALIDATION_ID=$(aws cloudfront create-invalidation \
        --distribution-id "$CLOUDFRONT_ID" \
        --paths "/*" \
        --query 'Invalidation.Id' \
        --output text)

    log_info "Invalidation created: $INVALIDATION_ID"

    # Optionally wait for completion (can be skipped in CI to save time)
    if [ "${WAIT_FOR_INVALIDATION:-false}" == "true" ]; then
        log_info "Waiting for invalidation to complete..."
        aws cloudfront wait invalidation-completed \
            --distribution-id "$CLOUDFRONT_ID" \
            --id "$INVALIDATION_ID"
        log_info "Invalidation completed"
    fi
}

# Health check
health_check() {
    log_step "Performing health check..."

    if [ -z "$WEBSITE_URL" ]; then
        log_warning "Website URL not found, skipping health check"
        return
    fi

    # Wait a bit for propagation
    sleep 5

    # Check if site is accessible
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$WEBSITE_URL")

    if [ "$HTTP_STATUS" -eq 200 ]; then
        log_info "Health check passed - site is accessible at $WEBSITE_URL"
    else
        log_warning "Health check failed - HTTP status $HTTP_STATUS"
        log_warning "This might be normal if DNS is still propagating"
    fi
}

# Main deployment flow
main() {
    log_info "Starting deployment for environment: $ENVIRONMENT"
    log_info "AWS Region: $AWS_REGION"

    check_prerequisites
    build_application
    init_terraform
    deploy_infrastructure
    upload_to_s3
    invalidate_cache
    health_check

    # Summary
    echo ""
    echo "=========================================="
    log_info "Deployment completed successfully!"
    echo "=========================================="
    echo "Website URL: ${WEBSITE_URL}"
    echo "S3 Bucket: ${S3_BUCKET}"
    echo "CloudFront Distribution: ${CLOUDFRONT_ID}"
    echo "Environment: ${ENVIRONMENT}"
    echo "=========================================="
}

# Run main function
main "$@"