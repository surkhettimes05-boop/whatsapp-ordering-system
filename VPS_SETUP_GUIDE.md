# 🚀 VPS Production Setup Guide

## Overview
Complete guide for setting up the WhatsApp ordering system on a VPS with Docker, SSL, monitoring, and automated backups.

---

## 📋 Prerequisites

### System Requirements
- **OS**: Ubuntu 20.04 LTS or newer
- **RAM**: Minimum 4GB, Recommended 8GB+
- **CPU**: Minimum 2 cores, Recommended 4+ cores
- **Storage**: Minimum 50GB SSD, Recommended 100GB+
- **Network**: Static IP address and domain name

### Required Accounts
- Domain registrar (for DNS)
- Email service (for notifications)
- AWS account (for S3 backups - optional)
- Slack workspace (for alerts - optional)

---

## 🔧 Initial Server Setup

### 1. Update System
```bash
# Update package lists and upgrade system
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y curl wget git unzip htop tree jq
```

### 2. Create Application User
```bash
# Create dedicated user for the application
sudo useradd -m -s /bin/bash whatsapp
sudo usermod -aG sudo whatsapp

# Switch to application user
sudo su - whatsapp
```

### 3. Configure SSH Security
```bash
# Generate SSH key pair (if not already done)
ssh-keygen -t ed25519 -C "whatsapp-server"

# Configure SSH (as root)
sudo nano /etc/ssh/sshd_config

# Add/modify these settings:
# Port 2222                    # Change default port
# PermitRootLogin no          # Disable root login
# PasswordAuthentication no   # Use key-based auth only
# AllowUsers whatsapp         # Only allow whatsapp user

# Restart SSH service
sudo systemctl restart sshd
```

### 4. Configure Firewall
```bash
# Install and configure UFW
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (use your custom port)
sudo ufw allow 2222/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
sudo ufw status
```

---

## 🐳 Docker Installation

### 1. Install Docker
```bash
# Remove old versions
sudo apt remove docker docker-engine docker.io containerd runc

# Install dependencies
sudo apt install -y apt-transport-https ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io

# Add user to docker group
sudo usermod -aG docker whatsapp
newgrp docker

# Test Docker installation
docker --version
docker run hello-world
```

### 2. Install Docker Compose
```bash
# Download Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Make executable
sudo chmod +x /usr/local/bin/docker-compose

# Test installation
docker-compose --version
```

### 3. Configure Docker
```bash
# Create Docker daemon configuration
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json > /dev/null <<EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2"
}
EOF

# Restart Docker
sudo systemctl restart docker
sudo systemctl enable docker
```

---

## 📁 Application Setup

### 1. Create Directory Structure
```bash
# Create application directories
sudo mkdir -p /opt/whatsapp/{data,ssl,backups,logs}
sudo mkdir -p /opt/whatsapp/data/{postgres,redis,prometheus,grafana}
sudo mkdir -p /opt/whatsapp/ssl/{certbot,var}

# Set ownership
sudo chown -R whatsapp:whatsapp /opt/whatsapp
```

### 2. Clone Repository
```bash
# Clone the application repository
cd /opt/whatsapp
git clone https://github.com/your-username/whatsapp-ordering-system.git app
cd app

# Set up git for updates
git config pull.rebase false
```

### 3. Configure Environment Variables
```bash
# Copy environment template
cp .env.example .env.production

# Edit production environment
nano .env.production
```

**Required Environment Variables:**
```bash
# Domain and SSL
DOMAIN_NAME=your-domain.com
ADMIN_EMAIL=admin@your-domain.com

# Database
POSTGRES_DB=whatsapp_ordering
POSTGRES_USER=whatsapp_user
POSTGRES_PASSWORD=your_secure_db_password

# Redis
REDIS_PASSWORD=your_secure_redis_password

# JWT
JWT_SECRET=your_super_secure_jwt_secret_minimum_32_characters

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# Security
ADMIN_ALLOWED_IPS=your.office.ip.address,192.168.1.0/24
WEBHOOK_ALLOWED_IPS=54.172.60.0/22,54.244.51.0/24

# Monitoring
GRAFANA_ADMIN_PASSWORD=your_secure_grafana_password

# Backups (optional)
BACKUP_S3_BUCKET=your-backup-bucket
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_DEFAULT_REGION=us-east-1

# Notifications
ALERT_EMAIL_TO=alerts@your-domain.com
ALERT_SLACK_WEBHOOK=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
```

---

## 🔒 SSL Certificate Setup

### 1. Configure DNS
```bash
# Point your domain to the server IP
# Create A records:
# your-domain.com -> YOUR_SERVER_IP
# www.your-domain.com -> YOUR_SERVER_IP
```

### 2. Initial SSL Certificate (Staging)
```bash
# Start nginx for initial setup
docker-compose -f docker-compose.production.yml up -d nginx

# Get staging certificate first
docker-compose -f docker-compose.production.yml run --rm certbot \
  certonly --webroot --webroot-path=/var/www/html \
  --email admin@your-domain.com --agree-tos --no-eff-email \
  --staging -d your-domain.com -d www.your-domain.com

# Check certificate
sudo ls -la /opt/whatsapp/ssl/certbot/live/your-domain.com/
```

### 3. Production SSL Certificate
```bash
# Get production certificate
docker-compose -f docker-compose.production.yml run --rm certbot \
  certonly --webroot --webroot-path=/var/www/html \
  --email admin@your-domain.com --agree-tos --no-eff-email \
  --force-renewal -d your-domain.com -d www.your-domain.com
```

### 4. SSL Auto-Renewal
```bash
# Create renewal script
sudo tee /opt/whatsapp/scripts/renew-ssl.sh > /dev/null <<'EOF'
#!/bin/bash
cd /opt/whatsapp/app
docker-compose -f docker-compose.production.yml run --rm certbot renew
docker-compose -f docker-compose.production.yml exec nginx nginx -s reload
EOF

sudo chmod +x /opt/whatsapp/scripts/renew-ssl.sh

# Add to crontab
(crontab -l 2>/dev/null; echo "0 3 * * 0 /opt/whatsapp/scripts/renew-ssl.sh") | crontab -
```

---

## 🚀 Application Deployment

### 1. Build and Start Services
```bash
cd /opt/whatsapp/app

# Build images
docker-compose -f docker-compose.production.yml build

# Start infrastructure services first
docker-compose -f docker-compose.production.yml up -d postgres redis

# Wait for database to be ready
sleep 30

# Run database migrations
docker-compose -f docker-compose.production.yml exec gateway npx prisma migrate deploy

# Start all services
docker-compose -f docker-compose.production.yml up -d

# Check service status
docker-compose -f docker-compose.production.yml ps
```

### 2. Verify Deployment
```bash
# Check logs
docker-compose -f docker-compose.production.yml logs -f gateway worker

# Test health endpoints
curl -k https://your-domain.com/health
curl -k https://your-domain.com/api/v1/health

# Test admin dashboard
curl -k https://your-domain.com/admin
```

---

## 📊 Monitoring Setup

### 1. Configure Prometheus
```bash
# Create Prometheus configuration
mkdir -p /opt/whatsapp/monitoring
tee /opt/whatsapp/monitoring/prometheus.yml > /dev/null <<'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"

scrape_configs:
  - job_name: 'whatsapp-gateway'
    static_configs:
      - targets: ['gateway:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'whatsapp-worker'
    static_configs:
      - targets: ['worker:9090']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx:80']
    metrics_path: '/nginx-status'
    scrape_interval: 30s

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
EOF
```

### 2. Configure Grafana Dashboards
```bash
# Create Grafana datasource configuration
mkdir -p /opt/whatsapp/monitoring/grafana/datasources
tee /opt/whatsapp/monitoring/grafana/datasources/prometheus.yml > /dev/null <<'EOF'
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
EOF

# Create dashboard configuration
mkdir -p /opt/whatsapp/monitoring/grafana/dashboards
tee /opt/whatsapp/monitoring/grafana/dashboards/dashboard.yml > /dev/null <<'EOF'
apiVersion: 1

providers:
  - name: 'default'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /etc/grafana/provisioning/dashboards
EOF
```

---

## 💾 Backup Configuration

### 1. Configure Automated Backups
```bash
# Make backup script executable
chmod +x /opt/whatsapp/app/scripts/backup.sh

# Test backup script
/opt/whatsapp/app/scripts/backup.sh

# Add to crontab for daily backups at 2 AM
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/whatsapp/app/scripts/backup.sh") | crontab -
```

### 2. Configure S3 Backup (Optional)
```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configure AWS credentials
aws configure
# Enter your AWS Access Key ID, Secret Access Key, and region
```

---

## 🔄 Log Management

### 1. Configure Log Rotation
```bash
# Create logrotate configuration
sudo tee /etc/logrotate.d/whatsapp > /dev/null <<'EOF'
/opt/whatsapp/app/backend/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 whatsapp whatsapp
    postrotate
        docker-compose -f /opt/whatsapp/app/docker-compose.production.yml restart gateway worker
    endscript
}

/opt/whatsapp/nginx/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 whatsapp whatsapp
    postrotate
        docker-compose -f /opt/whatsapp/app/docker-compose.production.yml exec nginx nginx -s reload
    endscript
}
EOF
```

### 2. Test Log Rotation
```bash
# Test logrotate configuration
sudo logrotate -d /etc/logrotate.d/whatsapp

# Force rotation (for testing)
sudo logrotate -f /etc/logrotate.d/whatsapp
```

---

## 🔧 System Optimization

### 1. Kernel Parameters
```bash
# Optimize kernel parameters for production
sudo tee -a /etc/sysctl.conf > /dev/null <<'EOF'
# Network optimizations
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_keepalive_time = 1200
net.ipv4.tcp_max_tw_buckets = 400000

# Memory optimizations
vm.swappiness = 10
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5

# File system optimizations
fs.file-max = 2097152
fs.inotify.max_user_watches = 524288
EOF

# Apply changes
sudo sysctl -p
```

### 2. Resource Limits
```bash
# Configure resource limits
sudo tee -a /etc/security/limits.conf > /dev/null <<'EOF'
whatsapp soft nofile 65535
whatsapp hard nofile 65535
whatsapp soft nproc 32768
whatsapp hard nproc 32768
EOF
```

---

## 🚨 Monitoring and Alerting

### 1. System Monitoring Script
```bash
# Create system monitoring script
tee /opt/whatsapp/scripts/system-monitor.sh > /dev/null <<'EOF'
#!/bin/bash

# Check disk space
DISK_USAGE=$(df /opt/whatsapp | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "WARNING: Disk usage is ${DISK_USAGE}%"
fi

# Check memory usage
MEM_USAGE=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
if [ $MEM_USAGE -gt 80 ]; then
    echo "WARNING: Memory usage is ${MEM_USAGE}%"
fi

# Check Docker containers
UNHEALTHY=$(docker ps --filter health=unhealthy --format "{{.Names}}" | wc -l)
if [ $UNHEALTHY -gt 0 ]; then
    echo "WARNING: $UNHEALTHY unhealthy containers"
fi

# Check SSL certificate expiry
CERT_DAYS=$(openssl x509 -in /opt/whatsapp/ssl/certbot/live/your-domain.com/cert.pem -noout -dates | grep notAfter | cut -d= -f2 | xargs -I {} date -d {} +%s)
CURRENT_DAYS=$(date +%s)
DAYS_LEFT=$(( (CERT_DAYS - CURRENT_DAYS) / 86400 ))

if [ $DAYS_LEFT -lt 30 ]; then
    echo "WARNING: SSL certificate expires in $DAYS_LEFT days"
fi
EOF

chmod +x /opt/whatsapp/scripts/system-monitor.sh

# Add to crontab for hourly checks
(crontab -l 2>/dev/null; echo "0 * * * * /opt/whatsapp/scripts/system-monitor.sh") | crontab -
```

### 2. Health Check Script
```bash
# Create comprehensive health check
tee /opt/whatsapp/scripts/health-check.sh > /dev/null <<'EOF'
#!/bin/bash

echo "=== WhatsApp Ordering System Health Check ==="
echo "Timestamp: $(date)"
echo

# Check services
echo "=== Service Status ==="
cd /opt/whatsapp/app
docker-compose -f docker-compose.production.yml ps

echo -e "\n=== API Health ==="
curl -s https://your-domain.com/health | jq .

echo -e "\n=== Database Connection ==="
docker-compose -f docker-compose.production.yml exec -T postgres pg_isready -U whatsapp_user -d whatsapp_ordering

echo -e "\n=== Redis Connection ==="
docker-compose -f docker-compose.production.yml exec -T redis redis-cli ping

echo -e "\n=== Disk Usage ==="
df -h /opt/whatsapp

echo -e "\n=== Memory Usage ==="
free -h

echo -e "\n=== Recent Errors ==="
tail -20 /opt/whatsapp/app/backend/logs/error.log 2>/dev/null || echo "No error log found"

echo -e "\n=== Health Check Complete ==="
EOF

chmod +x /opt/whatsapp/scripts/health-check.sh
```

---

## 🔄 Maintenance Procedures

### 1. Update Application
```bash
# Create update script
tee /opt/whatsapp/scripts/update.sh > /dev/null <<'EOF'
#!/bin/bash
set -e

echo "Starting application update..."

cd /opt/whatsapp/app

# Pull latest code
git pull origin main

# Backup current environment
cp .env.production .env.production.backup.$(date +%Y%m%d_%H%M%S)

# Build new images
docker-compose -f docker-compose.production.yml build

# Update services with zero downtime
docker-compose -f docker-compose.production.yml up -d --no-deps worker
sleep 10
docker-compose -f docker-compose.production.yml up -d --no-deps gateway
sleep 10
docker-compose -f docker-compose.production.yml up -d --no-deps admin

# Run migrations if needed
docker-compose -f docker-compose.production.yml exec gateway npx prisma migrate deploy

echo "Application update completed"
EOF

chmod +x /opt/whatsapp/scripts/update.sh
```

### 2. Backup and Restore Procedures
```bash
# Test backup
/opt/whatsapp/app/scripts/backup.sh

# Test restore (use with caution)
# /opt/whatsapp/app/scripts/rollback.sh rollback-db 2024-01-30
```

---

## 🔐 Security Hardening

### 1. Fail2Ban Setup
```bash
# Install Fail2Ban
sudo apt install -y fail2ban

# Configure Fail2Ban for SSH
sudo tee /etc/fail2ban/jail.local > /dev/null <<'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = 2222
logpath = /var/log/auth.log

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
logpath = /opt/whatsapp/nginx/logs/error.log
maxretry = 3

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /opt/whatsapp/nginx/logs/error.log
maxretry = 10
EOF

# Start and enable Fail2Ban
sudo systemctl start fail2ban
sudo systemctl enable fail2ban
```

### 2. Intrusion Detection
```bash
# Install AIDE (Advanced Intrusion Detection Environment)
sudo apt install -y aide

# Initialize AIDE database
sudo aideinit

# Move database
sudo mv /var/lib/aide/aide.db.new /var/lib/aide/aide.db

# Add to crontab for daily checks
(sudo crontab -l 2>/dev/null; echo "0 4 * * * /usr/bin/aide --check") | sudo crontab -
```

---

## 📋 Final Checklist

### Pre-Production Checklist
- [ ] Server hardened and secured
- [ ] Docker and Docker Compose installed
- [ ] SSL certificates configured and auto-renewing
- [ ] All environment variables configured
- [ ] Database migrations applied
- [ ] All services running and healthy
- [ ] Monitoring and alerting configured
- [ ] Backup system tested
- [ ] Log rotation configured
- [ ] Firewall rules applied
- [ ] DNS records configured
- [ ] Health checks passing

### Post-Deployment Verification
- [ ] API endpoints responding
- [ ] Admin dashboard accessible
- [ ] WhatsApp webhooks working
- [ ] Database connections stable
- [ ] SSL certificate valid
- [ ] Monitoring dashboards showing data
- [ ] Backup script executed successfully
- [ ] Log files being generated
- [ ] Security scans passed

---

## 🆘 Troubleshooting

### Common Issues

**1. SSL Certificate Issues**
```bash
# Check certificate status
sudo certbot certificates

# Renew certificate manually
sudo certbot renew --dry-run

# Check nginx configuration
docker-compose -f docker-compose.production.yml exec nginx nginx -t
```

**2. Database Connection Issues**
```bash
# Check database logs
docker-compose -f docker-compose.production.yml logs postgres

# Connect to database manually
docker-compose -f docker-compose.production.yml exec postgres psql -U whatsapp_user -d whatsapp_ordering
```

**3. Service Health Issues**
```bash
# Check service logs
docker-compose -f docker-compose.production.yml logs gateway worker

# Restart specific service
docker-compose -f docker-compose.production.yml restart gateway

# Check resource usage
docker stats
```

**4. Performance Issues**
```bash
# Check system resources
htop
iotop
nethogs

# Check Docker resource usage
docker system df
docker system prune
```

### Emergency Procedures

**1. Complete System Restart**
```bash
cd /opt/whatsapp/app
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml up -d
```

**2. Rollback to Previous Version**
```bash
/opt/whatsapp/app/scripts/rollback.sh list-versions
/opt/whatsapp/app/scripts/rollback.sh rollback v1.2.3
```

**3. Emergency Database Restore**
```bash
/opt/whatsapp/app/scripts/rollback.sh rollback-db 2024-01-30
```

---

## 📞 Support and Maintenance

### Regular Maintenance Tasks
- **Daily**: Check service health and logs
- **Weekly**: Review monitoring dashboards and alerts
- **Monthly**: Update system packages and security patches
- **Quarterly**: Review and update SSL certificates, backup retention

### Monitoring URLs
- **Application**: https://your-domain.com
- **Admin Dashboard**: https://your-domain.com/admin
- **API Health**: https://your-domain.com/health
- **Grafana**: https://your-domain.com/grafana

### Log Locations
- **Application Logs**: `/opt/whatsapp/app/backend/logs/`
- **Nginx Logs**: `/opt/whatsapp/nginx/logs/`
- **System Logs**: `/var/log/`
- **Docker Logs**: `docker-compose logs`

---

**🎉 Your WhatsApp ordering system is now production-ready!**

For additional support, refer to the application documentation or contact the development team.