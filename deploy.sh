#!/bin/bash

# ============================================================
# 智能刷题助手 - 阿里云一键部署脚本
# 使用方法: ./deploy.sh
# ============================================================

set -e  # 遇到错误立即退出

echo "======================================"
echo "  智能刷题助手 - 一键部署脚本"
echo "======================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置变量
APP_NAME="quiz-app"
APP_DIR="/var/www/quiz-app"
LOG_DIR="/var/log/quiz-app"
DOMAIN=""  # 用户填写

# 检查是否以 root 运行
if [ "$EUID" -ne 0 ]; then
   echo -e "${RED}请使用 root 权限运行 (sudo ./deploy.sh)${NC}"
   exit 1
fi

# 检测系统类型
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo -e "${RED}无法检测操作系统类型${NC}"
    exit 1
fi

# 根据系统类型设置 Nginx 配置路径
if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
    NGINX_CONF="/etc/nginx/sites-available/quiz-app"
    NGINX_ENABLED="/etc/nginx/sites-enabled/quiz-app"
else
    NGINX_CONF="/etc/nginx/conf.d/quiz-app.conf"
    NGINX_ENABLED=""
fi

# 步骤 1: 安装依赖
echo -e "\n${YELLOW}[1/8] 安装系统依赖...${NC}"
echo -e "检测到系统: $OS"

if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
    # Debian/Ubuntu 系统
    apt-get update -qq
    apt-get install -y -qq curl git nginx certbot python3-certbot-nginx ufw
elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ] || [ "$OS" = "fedora" ]; then
    # CentOS/RHEL/Fedora 系统
    yum install -y epel-release
    yum install -y curl git nginx certbot python3-certbot-nginx firewalld
    systemctl start firewalld
    systemctl enable firewalld
else
    echo -e "${RED}不支持的操作系统: $OS${NC}"
    exit 1
fi

# Node.js 安装函数
install_node() {
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y -qq nodejs
    else
        # CentOS/RHEL 使用 Nodesource
        curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
        yum install -y nodejs
    fi
}

# 安装 Node.js 20（如果未安装）
if ! command -v node &> /dev/null || [ "$(node -v | cut -d'v' -f2 | cut -d'.' -f1)" != "20" ]; then
    echo -e "${YELLOW}安装 Node.js 20...${NC}"
    install_node
fi

# 安装 PM2（如果未安装）
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}安装 PM2...${NC}"
    npm install -g pm2 pnpm
fi

echo -e "${GREEN}✓ 依赖安装完成${NC}"

# 步骤 2: 创建目录
echo -e "\n${YELLOW}[2/8] 创建项目目录...${NC}"
mkdir -p $APP_DIR
mkdir -p $LOG_DIR
echo -e "${GREEN}✓ 目录创建完成${NC}"

# 步骤 3: 复制项目文件
echo -e "\n${YELLOW}[3/8] 部署项目文件...${NC}"

# 如果当前目录是项目根目录，复制文件
if [ -f "package.json" ]; then
    echo "复制项目文件到 $APP_DIR..."
    cp -r . $APP_DIR/
else
    echo -e "${RED}错误：请在项目根目录运行此脚本${NC}"
    exit 1
fi

cd $APP_DIR

# 步骤 4: 安装依赖并构建
echo -e "\n${YELLOW}[4/8] 安装依赖并构建...${NC}"
pnpm install --frozen-lockfile

# 检查环境变量
if [ ! -f ".env" ]; then
    echo -e "\n${YELLOW}首次部署：创建环境变量文件${NC}"
    cat > .env << 'EOF'
# Supabase 配置（必填）
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# JWT 密钥（必填，生成命令：openssl rand -hex 32）
TOKEN_SECRET=your-random-secret-key

# 其他配置
NODE_ENV=production
PORT=3000
EOF
    echo -e "${RED}请编辑 .env 文件填写你的配置，然后重新运行脚本${NC}"
    nano .env
    exit 1
fi

# 构建项目
echo "构建项目..."
pnpm build

echo -e "${GREEN}✓ 构建完成${NC}"

# 步骤 5: 配置 PM2
echo -e "\n${YELLOW}[5/8] 配置 PM2...${NC}"

cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'quiz-app',
    script: 'node_modules/next/dist/bin/next',
    args: 'start',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    log_file: '/var/log/quiz-app/app.log',
    error_file: '/var/log/quiz-app/error.log',
    out_file: '/var/log/quiz-app/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};
EOF

# 启动或重启应用
if pm2 list | grep -q "$APP_NAME"; then
    echo "重启应用..."
    pm2 restart ecosystem.config.js
else
    echo "启动应用..."
    pm2 start ecosystem.config.js
    pm2 save
    pm2 startup systemd -u root --hp /root
fi

echo -e "${GREEN}✓ PM2 配置完成${NC}"

# 步骤 6: 配置 Nginx
echo -e "\n${YELLOW}[6/8] 配置 Nginx...${NC}"

# 读取域名
if [ -f ".domain" ]; then
    DOMAIN=$(cat .domain)
else
    echo -n "请输入你的域名（没有则回车跳过）: "
    read DOMAIN
    if [ -n "$DOMAIN" ]; then
        echo "$DOMAIN" > .domain
    fi
fi

if [ -n "$DOMAIN" ]; then
    cat > $NGINX_CONF << EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # 反向代理到 Next.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }

    # 静态资源缓存
    location /_next/static {
        proxy_pass http://localhost:3000;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, immutable";
    }

    # 健康检查
    location /api/health {
        access_log off;
        proxy_pass http://localhost:3000;
    }
}
EOF
else
    # 使用 IP 访问的配置
    cat > $NGINX_CONF << 'EOF'
server {
    listen 80 default_server;
    server_name _;

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # 反向代理到 Next.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # 静态资源缓存
    location /_next/static {
        proxy_pass http://localhost:3000;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, immutable";
    }
}
EOF
fi

# 启用配置
if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
    rm -f /etc/nginx/sites-enabled/default
    ln -sf $NGINX_CONF $NGINX_ENABLED
fi

# 测试并重载 Nginx
nginx -t && systemctl reload nginx
systemctl enable nginx

echo -e "${GREEN}✓ Nginx 配置完成${NC}"

# 步骤 7: 配置防火墙
echo -e "\n${YELLOW}[7/8] 配置防火墙...${NC}"

if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
    # Debian/Ubuntu 使用 ufw
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow 22/tcp comment 'SSH'
    ufw allow 80/tcp comment 'HTTP'
    ufw allow 443/tcp comment 'HTTPS'
    ufw --force enable
else
    # CentOS/RHEL 使用 firewalld
    firewall-cmd --permanent --add-service=ssh
    firewall-cmd --permanent --add-service=http
    firewall-cmd --permanent --add-service=https
    firewall-cmd --reload
fi

echo -e "${GREEN}✓ 防火墙配置完成${NC}"

# 步骤 8: 申请 SSL 证书（如果有域名）
if [ -n "$DOMAIN" ]; then
    echo -e "\n${YELLOW}[8/8] 申请 SSL 证书...${NC}"
    if certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN 2>/dev/null; then
        echo -e "${GREEN}✓ SSL 证书申请成功${NC}"
        # 设置自动续期
        (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet") | crontab -
    else
        echo -e "${YELLOW}⚠ SSL 证书申请失败，请检查域名解析是否正确${NC}"
    fi
else
    echo -e "\n${YELLOW}[8/8] 跳过 SSL 配置（无域名）${NC}"
    echo -e "${YELLOW}提示：配置域名后可自动申请 SSL 证书${NC}"
fi

# 显示部署结果
echo ""
echo "======================================"
echo -e "${GREEN}      部署完成！${NC}"
echo "======================================"
echo ""
echo "应用状态:"
pm2 status | grep "$APP_NAME"
echo ""
echo "访问地址:"
if [ -n "$DOMAIN" ]; then
    echo "  https://$DOMAIN"
else
    IP=$(curl -s http://checkip.amazonaws.com || echo "你的服务器IP")
    echo "  http://$IP"
fi
echo ""
echo "常用命令:"
echo "  查看日志: pm2 logs $APP_NAME"
echo "  重启应用: pm2 restart $APP_NAME"
echo "  停止应用: pm2 stop $APP_NAME"
echo "  更新部署: ./deploy.sh"
echo ""
echo "======================================"
