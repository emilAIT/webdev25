@echo off
SETLOCAL EnableDelayedExpansion

ECHO ===== Blink Application Deployment to Google Cloud Run =====
ECHO.

SET PROJECT_ID=vivid-gantry-458115-v3
SET REGION=europe-north2
SET SERVICE_NAME=blink
SET REGISTRY=%REGION%-docker.pkg.dev/%PROJECT_ID%/blink
SET IMAGE_NAME=%REGISTRY%/%SERVICE_NAME%
SET IMAGE_TAG=%IMAGE_NAME%:latest

REM Check if .env file exists and load SECRET_KEY
SET "SECRET_KEY=YOUR_SECRET_KEY_GOES_HERE"
IF EXIST .env (
    FOR /F "tokens=1,2 delims==" %%a IN (.env) DO (
        IF "%%a"=="SECRET_KEY" SET "SECRET_KEY=%%b"
    )
)


ECHO.
ECHO Step 1: Building Docker image...
ECHO.
docker build -t %IMAGE_TAG% .
IF %ERRORLEVEL% NEQ 0 (
    ECHO Error: Docker build failed!
    EXIT /B %ERRORLEVEL%
)

@REM ECHO.
@REM ECHO Step 2: Configure Docker to authenticate with GCP Artifact Registry...
@REM ECHO.
@REM gcloud auth configure-docker %REGION%-docker.pkg.dev
@REM IF %ERRORLEVEL% NEQ 0 (
@REM     ECHO Error: Docker authentication with GCP failed!
@REM     EXIT /B %ERRORLEVEL%
@REM )

ECHO.
ECHO Step 3: Pushing image to GCP Artifact Registry...
ECHO.
docker push %IMAGE_TAG%
IF %ERRORLEVEL% NEQ 0 (
    ECHO Error: Docker push failed!
    EXIT /B %ERRORLEVEL%
)

ECHO.
ECHO Step 4: Deploying to Cloud Run...
ECHO.
gcloud run deploy %SERVICE_NAME% ^
  --image=%IMAGE_TAG% ^
  --platform=managed ^
  --region=%REGION% ^
  --allow-unauthenticated ^
  --memory=512Mi ^
  --min-instances=0 ^
  --max-instances=10 ^
  --cpu=1 ^
  --port=8080 ^
  --set-env-vars="SECRET_KEY=%SECRET_KEY%"
IF %ERRORLEVEL% NEQ 0 (
    ECHO Error: Deployment to Cloud Run failed!
    EXIT /B %ERRORLEVEL%
)

ECHO.
ECHO ===== Deployment Complete =====
ECHO.

REM Get and display the deployed service URL
ECHO Fetching application URL...
FOR /F "tokens=*" %%i IN ('gcloud run services describe %SERVICE_NAME% --platform=managed --region=%REGION% --format="value(status.url)"') DO (
    SET SERVICE_URL=%%i
)
ECHO.
ECHO Your application is deployed and available at: !SERVICE_URL!
ECHO.

REM Ask if user wants to clean up old images
SET /P CLEANUP="Do you want to clean up old/unused images? (y/n, default=n): "
IF /I "%CLEANUP%"=="y" (
    ECHO.
    ECHO Cleaning up old Docker images...
    docker image prune -f
    ECHO Cleanup complete.
)

ENDLOCAL