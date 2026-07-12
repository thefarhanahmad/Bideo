# Bideo Production Deployment Guide (Dockerized)

## Server Information

- **Server Password**: Bideo@#12345
- **SSH Command**: `ssh root@200.97.169.18`

### Domain

- **Website URL**: `https://bideo.in`
- **API Base URL**: `https://bideo.in/api`

### VPS Details

- **OS**: Ubuntu
- **Process Management**: Docker & Docker Compose (replacing PM2)
- **Web Server**: Host Nginx (serves static files and reverse-proxies API requests)
- **SSL**: Let's Encrypt (Certbot) on Host

### Important Paths

- **Project Root**: `~/Bideo`
- **Backend Source**: `~/Bideo/backend`
- **Frontend Source**: `~/Bideo/adminDashboard`
- **Live Frontend Assets (Host)**: `/var/www/bideo`
- **Nginx Config (Host)**: `/etc/nginx/sites-available/bideo.in`

---

## 🛠️ First-Time Setup on the VPS

If you are setting up the server for the first time, follow these steps:

### Step 1: Login to your VPS

```bash
ssh root@200.97.169.18
# Enter password: Bideo@#12345
```

### Step 2: Install Docker and Docker Compose

Run the following commands to install Docker:

```bash
# Update Ubuntu packages
sudo apt update

# Install Docker
sudo apt install -y docker.io

# Start and enable Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Install Docker Compose (v2)
sudo apt install -y docker-compose-v2
```

### Step 3: Install Nginx & Certbot (for SSL)

If Nginx and Certbot are not already installed:

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### Step 4: Configure Nginx & SSL

1. Open the Nginx config file:
   ```bash
   sudo nano /etc/nginx/sites-available/bideo.in
   ```
2. Paste the following configuration (make sure the root directory `/var/www/bideo` exists):

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

       client_max_body_size 100M; # Essential for video uploads

       # Serve static React frontend files
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

3. Enable the config & test it:

   ```bash
   # Enable site (if not already enabled)
   sudo ln -sf /etc/nginx/sites-available/bideo.in /etc/nginx/sites-enabled/

   # Test Nginx config syntax
   sudo nginx -t

   # Restart Nginx
   sudo systemctl restart nginx
   ```

4. Get SSL Certificate (if you haven't yet):
   ```bash
   sudo certbot --nginx -d bideo.in -d www.bideo.in
   ```

### Step 5: Configure Environment Variables

1. Create the backend `.env` file on the VPS:
   ```bash
   mkdir -p ~/Bideo/backend
   nano ~/Bideo/backend/.env
   ```
2. Paste your production environment variables (MongoDB URI, JWT, Cloudinary, etc.):

   ```env
   PORT=5000
   NODE_ENV=production
   MONGODB_URI=mongodb+srv://your-db-uri
   JWT_SECRET=your-jwt-secret-key
   JWT_EXPIRE=30d
   CLIENT_URL=https://bideo.in

   # Add Cloudinary credentials
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

### Step 6: Initial Build and Deployment

Make the deployment script executable and run it:

```bash
cd ~/Bideo
chmod +x deploy.sh
./deploy.sh
```

---

## 🔄 How to Deploy Updates (Subsequent Deploys)

Whenever you push code updates to Git and want to deploy them to the server, you only need to run these commands:

```bash
# 1. SSH into the VPS
ssh root@200.97.169.18

# 2. Go to the project directory
cd ~/Bideo

# 3. Run the automated deploy script
./deploy.sh
```

The `./deploy.sh` script will automatically:

1. Pull the latest code from `origin main`.
2. Rebuild and restart the backend container (`bideo-backend`).
3. Build the frontend inside Docker using `VITE_API_URL=https://bideo.in/api`.
4. Replace the live files in `/var/www/bideo` with the new build.
5. Reload Nginx.

---

## 📈 Docker Management Cheat Sheet

### View logs

```bash
# View all container logs
docker compose logs -f

# View backend logs only
docker compose logs -f backend
```

### View container status

```bash
docker compose ps
```

### Restart backend container

```bash
docker compose restart backend
```

### Stop all containers

```bash
docker compose down
```

---

## 🌐 Nginx Commands

### Test Configuration

```bash
sudo nginx -t
```

### Reload Config (Zero Downtime)

```bash
sudo systemctl reload nginx
```

### View Access/Error Logs

```bash
# Access logs
tail -f /var/log/nginx/access.log

# Error logs
tail -f /var/log/nginx/error.log
```

---

## 🔒 SSL Commands

### Check Certificate Expiry

```bash
sudo certbot certificates
```

### Test SSL Certificate Renewal

```bash
sudo certbot renew --dry-run
```
