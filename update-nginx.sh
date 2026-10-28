#!/bin/bash
set -e

echo "⚙️ Configuring Nginx for Bideo SEO, Deep Linking, and App Links..."

cat << 'EOF' > /etc/nginx/sites-available/bideo
# 1. Main Bideo server (HTTPS)
server {
    server_name bideo.in;
    client_max_body_size 2048M;
    root /var/www/bideo;
    index index.html;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml application/xml application/json application/javascript application/xml+rss application/atom+xml image/svg+xml;

    # Production Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # 1. Public video, channel, and post pages (rich preview + Open In App button)
    location ~ ^/(v|c|p|video|channel|post)/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 2. Search engine crawlers, AI discovery & Android App Links
    location ~ ^/(sitemap(-[a-z]+(-[0-9]+)?)?\.xml|robots\.txt|app-ads\.txt|llms\.txt|\.well-known/assetlinks\.json) {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 3. Backend API
    # Bideo media moved to Cloudflare R2: files still on this server are served as before;
    # a file that is no longer here is redirected to its R2 copy, so old links keep working.
    location ~ ^/api/uploads/(videos|images)/([A-Za-z0-9._-]+)$ {
        set $bideo_media_folder $1;
        set $bideo_media_file $2;
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header If-None-Match "";
        proxy_set_header If-Modified-Since "";
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        proxy_intercept_errors on;
        error_page 404 = @bideo_media_r2;
    }
    location @bideo_media_r2 {
        return 302 https://pub-39d197c890b64644a9a1869b8f6740b1.r2.dev/$bideo_media_folder/$bideo_media_file;
    }

    # Video upload through the server (used when direct-to-R2 upload is unavailable): stream the
    # body straight to the backend instead of first buffering up to 2GB in nginx's temp files
    location = /api/videos/upload {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_request_buffering off;
        client_body_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 600s;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Prevent 304 Not Modified caching on dynamic API
        proxy_set_header If-None-Match "";
        proxy_set_header If-Modified-Since "";

        # Prevent 504 gateway timeout on large video uploads
        client_body_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # 4. Real-time WebSocket / Socket.IO
    location /socket.io/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        proxy_connect_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_read_timeout 86400s;
    }

    # 5. Built JS/CSS/images have content-hashed names: cache for a year, never fall back to index.html
    location /assets/ {
        expires 1y;
        try_files $uri =404;
    }

    # 6. Homepage: pre-rendered HTML (falls back to the SPA shell if missing)
    location = / {
        try_files /home.html /index.html;
    }

    # 7. Frontend React SPA (pre-rendered public pages live in <page>/index.html;
    #    served directly so /about does not redirect to /about/)
    location / {
        try_files $uri $uri/index.html /index.html;
    }

    listen [::]:443 ssl ipv6only=on; # managed by Certbot
    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/bideo.in/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/bideo.in/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

# 2. HTTPS www redirect to non-www (except .well-known for Android App Links)
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name www.bideo.in;

    ssl_certificate /etc/letsencrypt/live/bideo.in/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/bideo.in/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot

    location = /.well-known/assetlinks.json {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host bideo.in;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        return 301 https://bideo.in$request_uri;
    }
}

# 3. HTTP redirect all traffic to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name bideo.in www.bideo.in;

    return 301 https://bideo.in$request_uri;
}
EOF

echo "🔍 Testing Nginx configuration..."
nginx -t

echo "🔄 Reloading Nginx..."
systemctl reload nginx

echo "✅ Nginx successfully updated and reloaded!"
