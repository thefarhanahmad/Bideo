# Bideo Infrastructure & Network Setup

## Overview

This document records the production network architecture, Cloudflare CDN setup, and server storage configuration.

---

## 1. Domain & DNS Architecture (Cloudflare CDN)

To prevent Wi-Fi ISP routing drops (common across Indian broadband providers like ACT, Excitel, JioFiber) and avoid Hostinger's data-center level Anti-DDoS false-positive IP bans, **all traffic to `bideo.in` is proxied through Cloudflare**.

- **Cloudflare Account**: `bideoapps@gmail.com`
- **Zone ID**: `1158a3df8e1f0542a1694444c2304947`
- **Assigned Cloudflare Nameservers**:
  - `kobe.ns.cloudflare.com`
  - `ullis.ns.cloudflare.com`
- **Domain Registrar**: Hostinger (nameservers point to the two Cloudflare NS above).

### Cloudflare DNS Configuration
- `A` record: `bideo.in` -> `200.97.169.18` (Proxy Status: **Proxied / Orange Cloud ☁️**)
- `CNAME` record: `www` -> `bideo.in` (Proxy Status: **Proxied / Orange Cloud ☁️**)
- `TXT` record: `google-site-verification` (DNS only)

### Cloudflare SSL/TLS & Network Settings
- **SSL/TLS Encryption Mode**: `Full (strict)` or `Full` (Origin Nginx uses Let's Encrypt certificates).
- **WebSockets**: `ON` (required for real-time chat & notifications via Socket.io).
- **HTTP/2 & HTTP/3 (QUIC)**: Enabled by default on Cloudflare edge.

---

## 2. Origin Server Details

- **Hosting Provider**: Hostinger VPS (Mumbai, India - AS47583)
- **Public Origin IP**: `200.97.169.18`
- **SSH Access**: `ssh root@200.97.169.18`
- **SSH Password**: `Bideo@#12345`
- **Process Management**: Docker Compose (`bideo-backend` container on `127.0.0.1:5000`)
- **Web Server / Reverse Proxy**: Host Nginx (`/etc/nginx/sites-available/bideo`)
  - Configured with `CF-Connecting-IP` header support to log real client IPs.

---

## 3. Storage & Uploads Architecture

- **Active / New Uploads**: Uploaded directly to **Cloudflare R2** object storage.
- **Legacy Storage Alert**:
  - Server disk (`/dev/sda1` - 96 GB) was detected at **98% capacity** (~2.7 GB free).
  - `/root/Bideo/backend/uploads/videos` currently holds **~82 GB** of legacy videos from before the Cloudflare R2 migration.
  - **Action Item**: Legacy files can be backed up or cleaned up to free disk space on the Hostinger VPS.

---

## 4. Troubleshooting Network / Connectivity

If users experience timeouts on certain Wi-Fi or broadband networks:
1. Verify that `bideo.in` Proxy status in Cloudflare is **Orange Cloud (Proxied)**, NOT Gray Cloud (DNS only).
2. Ensure SSL/TLS mode in Cloudflare is set to **Full** (never Flexible, which causes redirect loops with Nginx).
3. Check origin server status via SSH:
   ```bash
   ssh root@200.97.169.18
   docker ps
   df -h /
   systemctl status nginx
   ```
