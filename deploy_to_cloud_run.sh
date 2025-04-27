#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Print colored messages
info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

# Check if Google Cloud SDK is installed
if ! [ -x "$(command -v gcloud)" ]; then
    error "Google Cloud SDK not found. Please install it first."
    echo "Visit https://cloud.google.com/sdk/docs/install for installation instructions."
    exit 1
fi

# Configuration variables
PROJECT_ID=$(gcloud config get-value project)
if [ -z "$PROJECT_ID" ]; then
    error "No Google Cloud project selected. Please run 'gcloud config set project YOUR_PROJECT_ID' first."
    exit 1
fi

# Ask for service name
read -p "Enter service name for deployment [web-chat]: " SERVICE_NAME
SERVICE_NAME=${SERVICE_NAME:-web-chat}

# Ask for region
read -p "Enter region for deployment [us-central1]: " REGION
REGION=${REGION:-us-central1}

# Build the Docker image
info "Building Docker image..."
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"
docker build -t "$IMAGE_NAME" .

if [ $? -ne 0 ]; then
    error "Docker build failed. Please check your Dockerfile and try again."
    exit 1
fi

# Push the Docker image to Google Container Registry
info "Pushing Docker image to Google Container Registry..."
docker push "$IMAGE_NAME"

if [ $? -ne 0 ]; then
    error "Failed to push Docker image. Please check if you're authenticated with gcloud."
    echo "Run 'gcloud auth configure-docker' to authenticate Docker with GCR."
    exit 1
fi

# Deploy to Cloud Run
info "Deploying to Cloud Run in region $REGION..."
gcloud run deploy "$SERVICE_NAME" \
    --image "$IMAGE_NAME" \
    --platform managed \
    --region "$REGION" \
    --allow-unauthenticated

if [ $? -ne 0 ]; then
    error "Deployment to Cloud Run failed."
    exit 1
fi

# Get the URL of the deployed service
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --platform managed --region "$REGION" --format 'value(status.url)')

success "Deployment completed successfully!"
echo -e "Your application is now available at: ${GREEN}$SERVICE_URL${NC}"
