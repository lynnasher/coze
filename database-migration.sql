-- ============================================
-- 刷题应用 - 火山引擎 PostgreSQL 数据库表结构
-- 执行方式: psql -h cp-sweet-hills-00cf8512.pg4.aidap-global.cn-beijing.volces.com -U postgres -d postgres -f database-migration.sql
-- ============================================

-- 1. 创建扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. 用户表
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(11) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    nickname VARCHAR(100),
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'banned')),
    activated_categories JSONB DEFAULT '[]'::jsonb,
    device_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE
);

-- 用户表索引
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_device_id ON users(device_id);

-- 3. 激活码表
CREATE TABLE IF NOT EXISTS activation_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(10) UNIQUE NOT NULL,
    category_id VARCHAR(50) NOT NULL,
    category_name VARCHAR(100) NOT NULL,
    type VARCHAR(20) DEFAULT 'once' CHECK (type IN ('once', 'multi')),
    max_uses INTEGER DEFAULT 1,
    uses INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired')),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 激活码表索引
CREATE INDEX IF NOT EXISTS idx_activation_codes_code ON activation_codes(code);
CREATE INDEX IF NOT EXISTS idx_activation_codes_category_id ON activation_codes(category_id);
CREATE INDEX IF NOT EXISTS idx_activation_codes_status ON activation_codes(status);

-- 4. 用户激活记录表
CREATE TABLE IF NOT EXISTS user_activations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id VARCHAR(50) NOT NULL,
    category_name VARCHAR(100) NOT NULL,
    activated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, category_id)
);

-- 用户激活记录表索引
CREATE INDEX IF NOT EXISTS idx_user_activations_user_id ON user_activations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activations_category_id ON user_activations(category_id);

-- ============================================
-- 5. 创建默认管理员账号（可选）
-- 用户名: admin
-- 密码: admin123（bcrypt 加密后的值）
-- ============================================
INSERT INTO users (phone, password, nickname, role, status, created_at)
VALUES (
    'admin',
    '$2b$10$YourHashedPasswordHere',  -- 需要替换为实际的 bcrypt 哈希值
    '管理员',
    'admin',
    'active',
    NOW()
)
ON CONFLICT (phone) DO NOTHING;

-- ============================================
-- 迁移完成提示
-- ============================================
\echo '数据库表创建完成！'
\echo '表列表:'
\dt
\echo ''
\echo '用户表结构:'
\d users
