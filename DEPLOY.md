# 阿里云服务器部署指南

## 快速开始（3 步部署）

### 第 1 步：上传项目到服务器

```bash
# 在你的电脑上将项目压缩并上传到服务器
scp quiz-app-deploy.tar.gz root@你的服务器IP:/root/

# 连接到服务器
ssh root@你的服务器IP

# 解压
tar -xzf quiz-app-deploy.tar.gz
cd deploy-package
```

### 第 2 步：配置环境变量

```bash
# 运行配置向导（交互式）
./setup-env.sh
```

选择数据库类型：

**选项 1：PostgreSQL（推荐，国内服务器）**
```
请选择数据库类型：
1) Supabase (免费，国外服务器)
2) PostgreSQL (如火山引擎、阿里云RDS，国内服务器)
请输入选项 (1/2): 2

PostgreSQL URL: postgresql://用户名:密码@主机:端口/数据库名?sslmode=require
```

**选项 2：Supabase（免费）**
```
请输入选项 (1/2): 1
Supabase URL: https://xxx.supabase.co
Supabase Anon Key: eyJhbGciOiJIUzI1NiIs...
```

### 第 3 步：一键部署

```bash
# 运行部署脚本
sudo ./deploy.sh
```

等待 5-8 分钟，部署完成后会显示访问地址。

---

## 脚本说明

| 脚本 | 用途 | 使用时机 |
|------|------|---------|
| `setup-env.sh` | 配置环境变量 | 首次部署前 |
| `deploy.sh` | 完整部署（安装依赖+配置+启动） | 首次部署 |
| `update.sh` | 快速更新（拉代码+构建+重启） | 后续代码更新 |

---

## 常用操作

### 查看应用状态
```bash
pm2 status              # 查看运行状态
pm2 logs quiz-app       # 查看实时日志
pm2 logs quiz-app --lines 100  # 查看最后 100 行日志
```

### 重启/停止应用
```bash
pm2 restart quiz-app    # 重启应用
pm2 stop quiz-app       # 停止应用
pm2 start quiz-app      # 启动应用
```

### 更新代码后重新部署
```bash
# 方式 1：使用更新脚本（快速）
./update.sh

# 方式 2：完整重新部署
sudo ./deploy.sh
```

### 修改配置后重启
```bash
# 编辑 .env 文件
nano /var/www/quiz-app/.env

# 重启应用
pm2 restart quiz-app
```

---

## 域名和 HTTPS 配置

### 添加域名

```bash
# 编辑域名文件
echo "your-domain.com" > /var/www/quiz-app/.domain

# 重新运行部署脚本配置 Nginx 和 SSL
sudo ./deploy.sh
```

### 手动申请 SSL 证书

```bash
# 确保域名已解析到服务器
# 然后运行
certbot --nginx -d your-domain.com
```

---

## 目录结构

部署后服务器上的目录结构：

```
/var/www/quiz-app/          # 项目代码
├── .env                    # 环境变量
├── .next/                  # 构建输出
├── ecosystem.config.js     # PM2 配置
├── package.json
├── public/
├── src/
└── ...

/var/log/quiz-app/          # 应用日志
├── app.log
├── error.log
└── out.log

/etc/nginx/sites-available/quiz-app  # Nginx 配置
```

---

## 故障排查

### 无法访问网站

```bash
# 检查应用是否运行
pm2 status

# 检查端口监听
netstat -tlnp | grep 3000

# 检查 Nginx 配置
nginx -t
systemctl status nginx

# 检查防火墙
ufw status
```

### 数据库连接失败

```bash
# 检查 Supabase 配置
cat /var/www/quiz-app/.env

# 查看应用日志
tail -f /var/log/quiz-app/error.log
```

### 内存不足导致构建失败

```bash
# 增加交换分区
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile

# 重新部署
sudo ./deploy.sh
```

---

## 安全建议

1. **修改默认 SSH 端口**
   ```bash
   nano /etc/ssh/sshd_config
   # 修改 Port 22 为其他端口
   systemctl restart sshd
   ```

2. **定期备份数据库**
   ```bash
   # 创建备份脚本
   pg_dump -h db.xxx.supabase.co -U postgres quiz_db > backup_$(date +%Y%m%d).sql
   ```

3. **定期更新系统**
   ```bash
   apt update && apt upgrade -y
   ```

---

## 技术支持

如有问题，请检查：
1. 服务器是否满足最低配置（2核2G）
2. Supabase 连接信息是否正确
3. 防火墙是否放行 80/443 端口
