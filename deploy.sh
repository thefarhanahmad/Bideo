#!/bin/bash

# Exit on any error
set -e

echo "🚀 Starting deployment of Bideo (Option A: Docker Backend + Host Nginx)..."

# 1. Pull latest code (if in git repo)
if [ -d .git ]; then
    echo "📥 Pulling latest code from Git..."
    git pull origin main || echo "⚠️ Git pull failed. Continuing with local files..."
fi

# 2. Build and start backend
echo "📦 Starting backend container..."
docker compose up -d backend --build

# 3. Build frontend Docker image
echo "⚛️ Building frontend Docker image..."
docker build \
  --build-arg VITE_API_URL=https://bideo.in/api \
  -t bideo-frontend ./adminDashboard

# 4. Clear old live files
echo "🧹 Cleaning up /var/www/bideo..."
sudo rm -rf /var/www/bideo/*

# 5. Extract built files to host Nginx directory
echo "📤 Extracting built frontend files..."
sudo docker run --rm \
  -v /var/www/bideo:/host_dist \
  bideo-frontend sh -c "cp -r /usr/share/nginx/html/* /host_dist/"

# 6. Reload Host Nginx
echo "⚙️ Reloading host Nginx..."
sudo systemctl reload nginx

echo "✅ Bideo deployment completed successfully!"
