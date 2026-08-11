# Production Deployment Guide: Ubuntu Server + Nginx + PM2 + PostgreSQL

This document provides step-by-step instructions and a copy-paste automation prompt to deploy the **Creativeprocess Office** virtual workspace on a fresh Ubuntu 22.04 or 24.04 LTS server.

---

## Quick Navigation
1. [Prerequisites & System Preparation](#1-prerequisites--system-preparation)
2. [Node.js & PostgreSQL Installation](#2-nodejs--postgresql-installation)
3. [Application Setup & Build](#3-application-setup--build)
4. [PM2 Process Management](#4-pm2-process-management)
5. [Nginx Reverse Proxy & WebSockets Config](#5-nginx-reverse-proxy--websockets-config)
6. [SSL / HTTPS with Let's Encrypt Certbot](#6-ssl--https-with-lets-encrypt-certbot)
7. [Copy-Paste Automation Prompt for Server Agent](#7-copy-paste-automation-prompt-for-server-agent)

---

## 1. Prerequisites & System Preparation

Log in to your Ubuntu server via SSH:

```bash
ssh user@your-server-ip
```

Update your system packages:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential ufw
```

Configure basic firewall rules:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## 2. Node.js & PostgreSQL Installation

### Install Node.js 20 LTS (NodeSource)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v # Should display v20.x.x
npm -v  # Should display 10.x.x
```

### Install Global PM2 Process Manager

```bash
sudo npm install -g pm2
```

### Install & Configure PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib

# Start and enable PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create Database and User
sudo -u postgres psql -c "CREATE DATABASE office_db;"
sudo -u postgres psql -c "CREATE USER office_user WITH PASSWORD 'YourSecurePasswordHere';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE office_db TO office_user;"
```

---

## 3. Application Setup & Build

Clone or transfer your repository code to `/var/www/roam-office`:

```bash
sudo mkdir -p /var/www/roam-office
sudo chown -R $USER:$USER /var/www/roam-office
cd /var/www/roam-office

# Copy your project files here, or git clone:
# git clone <your-repo-url> .
```

### Configure Production Environment Variables

Create `.env` file in the project root:

```bash
nano .env
```

Add the following environment configuration:

```env
NODE_ENV=production
PORT=3000
APP_URL=https://yourdomain.com
DATABASE_URL=postgresql://office_user:YourSecurePasswordHere@localhost:5432/office_db
GEMINI_API_KEY=your_gemini_api_key_here
```

### Install Dependencies & Build Application

```bash
npm install
npm run build
```

The build command compiles Vite frontend static assets and bundles the Express + Socket.IO server into `dist/server.cjs`.

---

## 4. PM2 Process Management

Start the application with PM2:

```bash
pm2 start npm --name "roam-office" -- run start
```

Verify application status:

```bash
pm2 status
pm2 logs roam-office
```

Configure PM2 to start automatically on system reboots:

```bash
pm2 startup
# Copy and execute the command line output provided by PM2 startup
pm2 save
```

---

## 5. Nginx Reverse Proxy & WebSockets Config

Install Nginx:

```bash
sudo apt install -y nginx
```

Create a new Nginx configuration file:

```bash
sudo nano /etc/nginx/sites-available/roam-office
```

Paste the following configuration (replace `yourdomain.com` or `your-server-ip`):

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com; # Or replace with your IP address

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # WebSocket Support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Proxy Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Max upload size
    client_max_body_size 50M;
}
```

Enable the site and verify syntax:

```bash
sudo ln -s /etc/nginx/sites-available/roam-office /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

---

## 6. SSL / HTTPS with Let's Encrypt Certbot

Secure your domain with free SSL certificate:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Certbot will automatically configure SSL inside your Nginx server block and set up auto-renewal timer.

---

## 7. Copy-Paste Automation Prompt for Server Agent

If you are using an AI agent (such as SSH AI assistant, Ansible, or server agent) directly on your Ubuntu server, copy and paste the prompt below:

```text
Please setup and deploy this application on my Ubuntu server:

1. Install Node.js 20 LTS, PostgreSQL, Nginx, PM2, and Certbot.
2. Setup PostgreSQL database 'office_db' with user 'office_user' and password 'YourSecurePasswordHere'.
3. In directory /var/www/roam-office, create a .env file with:
   NODE_ENV=production
   PORT=3000
   APP_URL=https://yourdomain.com
   DATABASE_URL=postgresql://office_user:YourSecurePasswordHere@localhost:5432/office_db
   GEMINI_API_KEY=your_gemini_api_key
4. Run 'npm install' and 'npm run build'.
5. Launch the app with PM2: 'pm2 start npm --name "roam-office" -- run start' and configure 'pm2 startup' and 'pm2 save'.
6. Configure Nginx reverse proxy at /etc/nginx/sites-available/roam-office pointing to http://127.0.0.1:3000 with full WebSocket upgrade headers (Upgrade $http_upgrade, Connection "upgrade").
7. Symlink site to /etc/nginx/sites-enabled/, test nginx with 'nginx -t', reload nginx, and issue SSL cert via 'certbot --nginx -d yourdomain.com'.
