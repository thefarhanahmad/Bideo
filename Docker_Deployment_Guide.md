# Docker Deployment Guide for Bideo

This guide provides instructions on how to containerize and deploy the Bideo application (Frontend and Backend) on an Ubuntu VPS using Docker and Docker Compose.

---

## 🛠️ Prerequisites on Ubuntu VPS

Ensure Docker and Docker Compose are installed on your VPS. If not, run the following commands:

```bash
# Update package index
sudo apt update

# Install Docker
sudo apt install -y docker.io

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Install Docker Compose (v2)
sudo apt install -y docker-compose-v2
```

---

## 🏗️ Architecture Options

We have provided two deployment options. Choose the one that best fits your VPS:

### 🔹 Option A: Containerized Backend + Host Nginx (Recommended & Safest)
*   **How it works**: The backend runs inside a Docker container (mapping port `5000` to `127.0.0.1:5000`). The frontend is built inside a temporary Docker build container, and the output files are extracted directly to your host's `/var/www/bideo` folder. Your host Nginx server serves the frontend files and reverse-proxies `/api` to the backend.
*   **Why choose this**: You do not have to change your existing Nginx configurations or SSL setup on the host VPS. It is very stable and handles SSL renewal automatically using your host Certbot.

### 🔹 Option B: Fully Containerized Setup (Everything in Docker)
*   **How it works**: Both the frontend (Nginx container serving static files) and the backend run inside Docker containers. The frontend container maps ports `80` and `443` to the host and mounts the SSL certificates from `/etc/letsencrypt` on the host VPS.
*   **Why choose this**: Zero dependencies on the host VPS. You can turn off Nginx on the host entirely.

---

## 🚀 Step-by-Step Deployment: Option A (Recommended)

### Step 1: Configure Backend Environment
Create/edit `~/Bideo/backend/.env` on your VPS and configure your production environment variables (MongoDB URI, JWT secret, Cloudinary, etc.):

```env
PORT=5000
NODE_ENV=production
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your_super_secret_key
JWT_EXPIRE=30d
CLIENT_URL=https://bideo.in
```

### Step 2: Run the Automation Script (Quickest)
We have provided an automated deployment script `deploy.sh` at the root of the project. You can run it on your VPS to automatically pull the latest changes, build/start the backend container, build/extract the frontend, and reload Nginx:

```bash
# Make the script executable
chmod +x deploy.sh

# Run the deployment
./deploy.sh
```

---

### Step 3: Manual Execution (Alternative to Step 2)
If you prefer to execute the steps manually:

1.  **Launch the Backend Container**:
    ```bash
    docker compose up -d backend
    ```

2.  **Build the Frontend Image** (passing your production backend API URL as a build argument):
    ```bash
    docker build \
      --build-arg VITE_API_URL=https://bideo.in/api \
      -t bideo-frontend ./adminDashboard
    ```

3.  **Clean Host Frontend Directory**:
    ```bash
    sudo rm -rf /var/www/bideo/*
    ```

4.  **Extract Built Files from Container to Host**:
    ```bash
    sudo docker run --rm \
      -v /var/www/bideo:/host_dist \
      bideo-frontend sh -c "cp -r /usr/share/nginx/html/* /host_dist/"
    ```

### Step 4: Configure Host Nginx
Your host Nginx configuration at `/etc/nginx/sites-available/bideo.in` should look like this:

```nginx
server {
    listen 80;
    server_name bideo.in www.bideo.in;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name bideo.in www.bideo.in;

    ssl_certificate /etc/letsencrypt/live/bideo.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bideo.in/privkey.pem;

    client_max_body_size 100M; # Essential for large video uploads

    # Serve static frontend files
    location / {
        root /var/www/bideo;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to backend Docker container
    location /api {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Reload Nginx:
```bash
sudo systemctl reload nginx
```

---

## 🚀 Step-by-Step Deployment: Option B (Fully Containerized)

In this option, we run both backend and frontend inside Docker and let Docker's Nginx handle ports `80` and `443` and SSL certificates.

### Step 1: Configure Backend Environment
Create/edit `~/Bideo/backend/.env` on your VPS.

### Step 2: Stop Host Nginx
Since Docker Nginx will bind to port `80` and `443`, you must stop the Nginx service running on your host VPS:
```bash
sudo systemctl stop nginx
sudo systemctl disable nginx
```

### Step 3: Edit `docker-compose.yml`
Uncomment the `frontend` service definition block in the `docker-compose.yml` file.

### Step 4: Run the Complete Stack
Build and launch all services in the background:
```bash
docker compose up -d --build
```
This command automatically:
1. Builds the backend Node image.
2. Builds the frontend React image with Vite variables.
3. Configures Nginx with the mounted SSL certificates and proxies `/api` requests to the backend service internally inside the Docker network.

---

## 📈 Useful Docker Management Commands

*   **View status of running containers**:
    ```bash
    docker compose ps
    ```
*   **View live container logs**:
    ```bash
    # View all logs
    docker compose logs -f

    # View backend logs only
    docker compose logs -f backend
    ```
*   **Restart the backend service**:
    ```bash
    docker compose restart backend
    ```
*   **Stop and remove containers**:
    ```bash
    docker compose down
    ```
