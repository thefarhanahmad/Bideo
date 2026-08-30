#!/bin/bash

# Exit on any error
set -e

echo "🚀 Starting deployment of Bideo (Option A: Docker Backend + Host Nginx)..."

# 1. Pull latest code (if in git repo)
if [ -d .git ]; then
    echo "📥 Pulling latest code from Git..."
    git fetch origin
    git checkout production
    git pull origin production || echo "⚠️ Git pull failed. Continuing with local files..."
fi

# 2. Build and start backend
echo "📦 Starting backend container..."
docker compose up -d backend --build

# 3. Load VITE_APP_DOWNLOAD_URL from env if configured
VITE_APP_DOWNLOAD_URL=""
ENV_PATH=""

if [ -f ./adminDashboard/.env ]; then
    ENV_PATH="./adminDashboard/.env"
elif [ -f ./.env ]; then
    ENV_PATH="./.env"
fi

if [ -n "$ENV_PATH" ]; then
    echo "🔑 Loading environment variables from $ENV_PATH..."
    VITE_APP_DOWNLOAD_URL=$(grep -E '^VITE_APP_DOWNLOAD_URL=' "$ENV_PATH" | cut -d'=' -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
fi

if [ -z "$VITE_APP_DOWNLOAD_URL" ]; then
    echo "⚠️ VITE_APP_DOWNLOAD_URL is not set or empty. The download button on the landing page will be disabled."
else
    echo "ℹ️ Found VITE_APP_DOWNLOAD_URL: $VITE_APP_DOWNLOAD_URL"
fi

# 4. Build frontend Docker image
echo "⚛️ Building frontend Docker image..."
docker build \
  --build-arg VITE_API_URL=https://bideo.in \
  --build-arg VITE_APP_DOWNLOAD_URL="$VITE_APP_DOWNLOAD_URL" \
  -t bideo-frontend ./adminDashboard

# 5. Clear old live files
echo "🧹 Cleaning up /var/www/bideo..."
sudo rm -rf /var/www/bideo/*

# 6. Extract built files to host Nginx directory
echo "📤 Extracting built frontend files..."
sudo docker run --rm \
  -v /var/www/bideo:/host_dist \
  bideo-frontend sh -c "cp -r /usr/share/nginx/html/* /host_dist/"

# 7. Reload Host Nginx
echo "⚙️ Reloading host Nginx..."
sudo systemctl reload nginx

# 8. Automatic Docker Storage Housekeeping
echo "🧹 Pruning old dangling images and build artifacts..."
docker image prune -f > /dev/null 2>&1 || true

echo "✅ Bideo deployment completed successfully!"
