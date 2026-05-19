#!/bin/bash

# ============================================
# 环境变量配置向导
# 支持 Supabase 或 PostgreSQL 数据库
# ============================================

ENV_FILE=".env"

echo "=========================================="
echo "    环境变量配置向导"
echo "=========================================="
echo ""

# 选择数据库类型
echo "请选择数据库类型："
echo "1) Supabase (免费，国外服务器)"
echo "2) PostgreSQL (如火山引擎、阿里云RDS，国内服务器)"
read -p "请输入选项 (1/2): " DB_TYPE

if [ "$DB_TYPE" == "2" ]; then
    echo ""
    echo "请输入 PostgreSQL 连接信息："
    echo "格式: postgresql://用户名:密码@主机:端口/数据库名?sslmode=require"
    read -p "PostgreSQL URL: " POSTGRES_URL
    
    # 验证输入
    if [ -z "$POSTGRES_URL" ]; then
        echo "错误：PostgreSQL URL 不能为空"
        exit 1
    fi
    
    # 写入环境变量文件
    cat > $ENV_FILE << EOF
# 数据库配置 (PostgreSQL)
POSTGRES_URL=$POSTGRES_URL
DATABASE_URL=$POSTGRES_URL

# JWT Token 密钥（用于用户认证）
TOKEN_SECRET=$(openssl rand -hex 32)

# 应用配置
NODE_ENV=production
PORT=3000
EOF

else
    echo ""
    echo "请输入 Supabase 配置（从 Supabase 控制台获取）："
    read -p "Supabase URL (https://xxx.supabase.co): " SUPABASE_URL
    read -p "Supabase Anon Key: " SUPABASE_ANON_KEY
    
    if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
        echo "错误：Supabase 配置不能为空"
        exit 1
    fi
    
    cat > $ENV_FILE << EOF
# 数据库配置 (Supabase)
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
COZE_SUPABASE_URL=$SUPABASE_URL
COZE_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY

# JWT Token 密钥
TOKEN_SECRET=$(openssl rand -hex 32)

# 应用配置
NODE_ENV=production
PORT=3000
EOF
fi

echo ""
echo "=========================================="
echo "环境变量已保存到 $ENV_FILE"
echo "=========================================="
echo ""

# 显示配置（隐藏敏感信息）
if [ "$DB_TYPE" == "2" ]; then
    echo "数据库类型: PostgreSQL"
    echo "连接字符串: ${POSTGRES_URL:0:30}..."
else
    echo "数据库类型: Supabase"
    echo "URL: ${SUPABASE_URL:0:30}..."
fi
echo ""

# 设置权限
chmod 600 $ENV_FILE
echo "权限已设置为 600（仅所有者可读写）"
echo ""
echo "下一步: 运行 sudo ./deploy.sh 开始部署"
