# Blink Application Deployment Guide

This guide explains how to deploy your Blink application to Google Cloud Run using the provided `deploy.bat` script.

## Prerequisites

Before deploying, ensure you have the following installed and configured:

1. **Docker Desktop** - Used to build and push container images
2. **Google Cloud SDK** - For interacting with Google Cloud services
3. **GCP Project** - A project in Google Cloud with the necessary APIs enabled:
   - Cloud Run API
   - Artifact Registry API
   - Container Registry API

## Environment Setup

### Google Cloud Authentication

Before deployment, make sure you're authenticated with Google Cloud:

```bash
gcloud auth login
gcloud config set project vivid-gantry-458115-v3
```

### Artifact Registry Setup

If this is your first deployment, you may need to create an Artifact Registry repository:

```bash
gcloud artifacts repositories create blink \
    --repository-format=docker \
    --location=europe-north2 \
    --description="Blink application container repository"
```

## Deployment Steps Explained

The `deploy.bat` script automates the following steps:

1. **Build Docker Image**

   - Creates a container image of your application based on your Dockerfile
   - Includes all required dependencies from requirements.txt

2. **Configure Docker Authentication with GCP**

   - Sets up Docker to work with Google Cloud Artifact Registry
   - You may see a warning if credentials are already configured (this is normal)

3. **Push Image to Artifact Registry**

   - Uploads your container image to Google Cloud
   - This allows Cloud Run to access and deploy your application

4. **Deploy to Cloud Run**

   - Creates or updates a Cloud Run service with your latest image
   - Configures compute resources, scaling settings, and environment variables

5. **Display Service URL**

   - Shows the public URL where your application is accessible

6. **Clean Up (Optional)**
   - Removes unused Docker images to free up space

## Common Issues and Troubleshooting

### Authentication Warnings

If you see warnings about credential helpers already being registered, this is informational and not an error.

### Docker Build Failures

- Check that Docker Desktop is running
- Ensure your Dockerfile is valid
- Verify that all required files are present in your project directory

### Push Failures

- Verify your Google Cloud authentication is current: `gcloud auth login`
- Check that you have the necessary permissions to push to the repository

### Deployment Failures

- Ensure the necessary APIs are enabled in your GCP project
- Check your quota limits in Google Cloud
- Verify your SECRET_KEY is properly set

## Managing Environment Variables

The deployment script can handle your application's SECRET_KEY in multiple ways:

1. Use the default value
2. Read from a local `.env` file
3. Enter a custom value during deployment

For security in production, it's recommended to use a custom value or a secret management solution.

## Custom Configurations

If you need to modify the deployment settings:

- Edit the variables at the top of `deploy.bat`
- Adjust Cloud Run parameters like memory, CPU, and scaling settings

## Database Considerations

The current deployment uses SQLite, which is stored in the container. For production:

- Consider migrating to a persistent database like Cloud SQL
- Update your application's database connection settings

## Monitoring and Logs

After deployment, you can monitor your application:

- View logs: `gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=blink"`
- Monitor performance: Visit the Cloud Run dashboard in Google Cloud Console
