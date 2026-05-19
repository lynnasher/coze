#!/bin/bash

# ============================================================
# 环境变量配置向导
# ============================================================

echo "======================================"
echo "  环境变量配置向导"
echo "======================================"
echo ""

# 检查 .env 文件是否存在
if [ -f ".env" ]; then
    echo "检测到已存在 .env 文件"
    echo -n "是否重新配置? (y/N): "
    read confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        echo "取消配置"
        exit 0
    fi
fi

echo ""
echo "请输入以下配置信息："
echo ""

# Supabase 配置
echo "1. Supabase 配置（从 Supabase 控制台获取）"
echo -n "   Supabase URL (https://xxx.supabase.co): "
read SUPABASE_URL
echo -n "   Supabase Anon Key: "
read SUPABASE_KEY

# JWT 密钥
echo ""
echo "2. JWT 密钥（用于 Token 签名）"
echo "   生成命令: openssl rand -hex 32"
echo -n "   或输入自定义密钥: "
read TOKEN_SECRET

# 如果用户没输入密钥，自动生成
if [ -z "$TOKEN_SECRET" ]; then
    if command -v openssl &> /dev/null; then
        TOKEN_SECRET=$(openssl rand -hex 32)
        echo "   已自动生成密钥"
    else
        echo "   错误：无法生成密钥，请手动输入"
        exit 1
    fi
fi

# 写入 .env 文件
cat > .env << EOF
# Supabase 配置
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_KEY

# JWT 密钥
TOKEN_SECRET=$TOKEN_SECRET

# 其他配置
NODE_ENV=production
PORT=3000
EOF

echo ""
echo "======================================"
echo "  配置完成！"
echo "======================================"
echo ""
echo "配置文件已保存到 .env"
echo ""
echo "现在可以运行部署脚本:"
echo "  sudo ./deploy.sh"
echo ""
