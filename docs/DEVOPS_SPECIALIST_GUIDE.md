# 🚀 GUIA DO ESPECIALISTA DEVOPS

## 📋 RESPONSABILIDADES

### **Core Responsibilities**
- Implementar CI/CD pipeline
- Configurar infraestrutura como código
- Implementar monitoramento e alertas
- Garantir segurança e compliance

---

## 🛠️ TECNOLOGIAS PRINCIPAIS

### **Containerização**
```yaml
# Docker & Docker Compose
docker: "^20.10.0"
docker-compose: "^2.0.0"
```

### **CI/CD**
```yaml
# GitHub Actions
actions/checkout: "^3.0.0"
actions/setup-node: "^3.0.0"
actions/cache: "^3.0.0"
```

### **Infraestrutura**
```yaml
# Cloud & Monitoring
nginx: "^1.21.0"
redis: "^7.0.0"
prometheus: "^2.40.0"
grafana: "^9.0.0"
```

---

## 🎯 TAREFAS ESPECÍFICAS

### **1. CI/CD Pipeline**

#### **GitHub Actions Workflow**
```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

env:
  NODE_VERSION: '18'
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      sqlite:
        image: sqlite:latest
        options: >-
          --health-cmd "sqlite3 --version"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
    - name: Checkout code
      uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'

    - name: Install dependencies
      run: |
        cd server && npm ci
        cd ../client && npm ci

    - name: Run linting
      run: |
        cd server && npm run lint
        cd ../client && npm run lint

    - name: Run tests
      run: |
        cd server && npm test
        cd ../client && npm test

    - name: Run security audit
      run: |
        cd server && npm audit --audit-level moderate
        cd ../client && npm audit --audit-level moderate

  build:
    needs: test
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v3

    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v2

    - name: Login to Container Registry
      uses: docker/login-action@v2
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}

    - name: Build and push Docker image
      uses: docker/build-push-action@v4
      with:
        context: .
        push: true
        tags: |
          ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
          ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
        cache-from: type=gha
        cache-to: type=gha,mode=max

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - name: Deploy to production
      run: |
        echo "Deploying to production..."
        # Adicionar comandos de deploy específicos
```

#### **Dockerfile Multi-stage**
```dockerfile
# Dockerfile
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:18-alpine AS server
WORKDIR /app
COPY --from=base /app/node_modules ./node_modules
COPY server/ ./server/
WORKDIR /app/server
EXPOSE 8000
CMD ["npm", "start"]

FROM node:18-alpine AS client
WORKDIR /app
COPY --from=base /app/node_modules ./node_modules
COPY client/ ./client/
WORKDIR /app/client
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "preview"]

# Production image
FROM nginx:alpine AS production
COPY --from=client /app/client/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### **2. Docker Compose para Desenvolvimento**

#### **docker-compose.yml**
```yaml
version: '3.8'

services:
  # Banco de dados
  db:
    image: sqlite:latest
    volumes:
      - ./data:/data
    environment:
      - SQLITE_DATABASE=kanban.db
    restart: unless-stopped

  # Cache Redis
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

  # API Backend
  api:
    build:
      context: .
      dockerfile: Dockerfile
      target: server
    ports:
      - "8000:8000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=./db.sqlite
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=dev-secret-key
    volumes:
      - ./server:/app/server
      - ./data:/app/data
    depends_on:
      - db
      - redis
    restart: unless-stopped

  # Frontend
  web:
    build:
      context: .
      dockerfile: Dockerfile
      target: client
    ports:
      - "3000:3000"
    environment:
      - VITE_API_URL=http://localhost:8000/api
    volumes:
      - ./client:/app/client
    depends_on:
      - api
    restart: unless-stopped

  # Nginx (Proxy reverso)
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
    depends_on:
      - web
      - api
    restart: unless-stopped

  # Monitoramento
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=200h'
      - '--web.enable-lifecycle'
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./monitoring/grafana/datasources:/etc/grafana/provisioning/datasources
    depends_on:
      - prometheus
    restart: unless-stopped

volumes:
  redis_data:
  prometheus_data:
  grafana_data:
```

### **3. Configuração do Nginx**

#### **nginx.conf**
```nginx
events {
    worker_connections 1024;
}

http {
    upstream api {
        server api:8000;
    }

    upstream web {
        server web:3000;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=web:10m rate=30r/s;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    server {
        listen 80;
        server_name localhost;

        # API routes
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://api;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Timeouts
            proxy_connect_timeout 30s;
            proxy_send_timeout 30s;
            proxy_read_timeout 30s;
        }

        # Web app routes
        location / {
            limit_req zone=web burst=50 nodelay;
            proxy_pass http://web;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Static files caching
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # Health check
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
```

### **4. Monitoramento com Prometheus**

#### **prometheus.yml**
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "rules/*.yml"

scrape_configs:
  - job_name: 'kanban-api'
    static_configs:
      - targets: ['api:8000']
    metrics_path: '/api/metrics'
    scrape_interval: 5s

  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx:80']
    metrics_path: '/nginx_status'

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

#### **Alert Rules**
```yaml
# rules/alerts.yml
groups:
  - name: kanban-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors per second"

      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time"
          description: "95th percentile response time is {{ $value }}s"

      - alert: DatabaseConnectionFailure
        expr: up{job="kanban-api"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database connection failed"
          description: "API server is down"
```

### **5. Grafana Dashboards**

#### **Dashboard Configuration**
```json
{
  "dashboard": {
    "title": "Kanban API Dashboard",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{endpoint}}"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m])",
            "legendFormat": "5xx errors"
          }
        ]
      },
      {
        "title": "Active Users",
        "type": "stat",
        "targets": [
          {
            "expr": "sum(active_users)",
            "legendFormat": "Active Users"
          }
        ]
      }
    ]
  }
}
```

### **6. Backup e Recovery**

#### **Backup Script**
```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_FILE="/app/data/db.sqlite"
BACKUP_FILE="$BACKUP_DIR/kanban_backup_$DATE.sqlite"

# Criar diretório de backup
mkdir -p $BACKUP_DIR

# Backup do banco de dados
cp $DB_FILE $BACKUP_FILE

# Compactar backup
gzip $BACKUP_FILE

# Remover backups antigos (manter últimos 7 dias)
find $BACKUP_DIR -name "kanban_backup_*.sqlite.gz" -mtime +7 -delete

# Upload para cloud storage (opcional)
# aws s3 cp $BACKUP_FILE.gz s3://kanban-backups/

echo "Backup completed: $BACKUP_FILE.gz"
```

#### **Cron Job para Backup**
```bash
# Adicionar ao crontab
0 2 * * * /app/scripts/backup.sh >> /var/log/backup.log 2>&1
```

### **7. SSL/TLS Configuration**

#### **Let's Encrypt com Certbot**
```bash
# Instalar Certbot
apt-get update
apt-get install certbot python3-certbot-nginx

# Obter certificado
certbot --nginx -d yourdomain.com -d api.yourdomain.com

# Renovação automática
echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
```

#### **Nginx SSL Configuration**
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Resto da configuração...
}
```

### **8. Environment Management**

#### **Environment Variables**
```bash
# .env.production
NODE_ENV=production
PORT=8000
JWT_SECRET=your-super-secret-jwt-key
DATABASE_URL=./data/db.sqlite
REDIS_URL=redis://redis:6379
ALLOWED_ORIGINS=https://yourdomain.com,https://api.yourdomain.com
LOG_LEVEL=info
```

#### **Secrets Management**
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  api:
    image: ghcr.io/your-org/kanban-api:latest
    environment:
      - NODE_ENV=production
      - JWT_SECRET_FILE=/run/secrets/jwt_secret
    secrets:
      - jwt_secret
    restart: unless-stopped

secrets:
  jwt_secret:
    external: true
```

### **9. Health Checks e Monitoring**

#### **Health Check Script**
```bash
#!/bin/bash
# health-check.sh

API_URL="http://localhost:8000/api/health"
WEB_URL="http://localhost:3000"

# Verificar API
if curl -f $API_URL > /dev/null 2>&1; then
    echo "API: OK"
else
    echo "API: FAILED"
    exit 1
fi

# Verificar Web
if curl -f $WEB_URL > /dev/null 2>&1; then
    echo "Web: OK"
else
    echo "Web: FAILED"
    exit 1
fi

echo "All services are healthy"
```

#### **Docker Health Check**
```dockerfile
# Adicionar ao Dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/api/health || exit 1
```

### **10. Log Management**

#### **Log Rotation**
```bash
# /etc/logrotate.d/kanban
/var/log/kanban/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 root root
    postrotate
        docker-compose restart api
    endscript
}
```

#### **Centralized Logging**
```yaml
# docker-compose.yml
services:
  api:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
  
  # ELK Stack para logs centralizados
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.5.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports:
      - "9200:9200"

  logstash:
    image: docker.elastic.co/logstash/logstash:8.5.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    depends_on:
      - elasticsearch

  kibana:
    image: docker.elastic.co/kibana/kibana:8.5.0
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch
```

---

## 📊 PERFORMANCE TARGETS

### **Métricas de Infraestrutura**
- **Uptime**: 99.9%
- **Response Time**: < 200ms (95th percentile)
- **Throughput**: > 1000 requests/min
- **Memory Usage**: < 80%
- **CPU Usage**: < 70%
- **Disk Usage**: < 85%

### **Alerting Thresholds**
```yaml
# Alert thresholds
cpu_usage: 80%
memory_usage: 85%
disk_usage: 90%
response_time: 500ms
error_rate: 5%
uptime: 99%
```

---

## 🚨 DISASTER RECOVERY

### **Recovery Procedures**
1. **Database Recovery**: Restore from latest backup
2. **Application Recovery**: Redeploy from container registry
3. **Infrastructure Recovery**: Recreate from infrastructure as code
4. **Data Recovery**: Point-in-time recovery from backups

### **RTO/RPO Targets**
- **RTO (Recovery Time Objective)**: 4 hours
- **RPO (Recovery Point Objective)**: 1 hour

---

**Responsável**: DevOps Specialist
**Última Atualização**: [Data atual]
**Próxima Revisão**: [Data + 1 semana]

