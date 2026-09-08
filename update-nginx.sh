#!/bin/bash
set -e

echo "⚙️ Configuring Nginx for Bideo SEO, Deep Linking, and App Links..."

cat << 'EOF' > /etc/nginx/sites-available/bideo
server {
    server_name bideo.in www.bideo.in;
    client_max_body_size 500M;
    root /var/www/bideo;
    index index.html;

    # 1. Public video and channel pages (rich preview + Open In App button)
    location ~ ^/(v|c|video|channel)/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 2. Android App Links verification & SEO
    location ~ ^/(sitemap\.xml|robots\.txt|app-ads\.txt|\.well-known/assetlinks\.json) {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 3. Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Prevent 504 gateway timeout on large video uploads
        client_body_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # 4. Frontend React SPA
    location / {
        try_files $uri $uri/ /index.html;
    }

    listen [::]:443 ssl ipv6only=on; # managed by Certbot
    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/bideo.in/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/bideo.in/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if ($host = www.bideo.in) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    if ($host = bideo.in) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    listen 80;
    listen [::]:80;

    server_name bideo.in www.bideo.in;
    return 404; # managed by Certbot
}
EOF

echo "🔍 Testing Nginx configuration..."
nginx -t

echo "🔄 Reloading Nginx..."
systemctl reload nginx

echo "✅ Nginx successfully updated and reloaded!"
