-- ============================================
-- 刷题系统 - Supabase 数据库表结构
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------
-- 1. 分类表 (categories)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(20) DEFAULT 'blue',
    order_num INTEGER DEFAULT 0,
    parent_id VARCHAR(50) REFERENCES public.categories(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.categories IS '题目分类表';
COMMENT ON COLUMN public.categories.order_num IS '排序序号';
COMMENT ON COLUMN public.categories.parent_id IS '父分类ID，支持二级分类';

-- ----------------------------------------
-- 2. 题库表 (banks)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.question_banks (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    source_file VARCHAR(200),
    question_count INTEGER DEFAULT 0,
    category_id VARCHAR(50) REFERENCES public.categories(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.question_banks IS '题库表';
COMMENT ON COLUMN public.question_banks.source_file IS '来源文件名';
COMMENT ON COLUMN public.question_banks.question_count IS '题目数量';

-- ----------------------------------------
-- 3. 题目表 (questions)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.questions (
    id VARCHAR(100) PRIMARY KEY,
    bank_id VARCHAR(100) REFERENCES public.question_banks(id) ON DELETE CASCADE,
    parent_id VARCHAR(100) REFERENCES public.questions(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('single', 'multiple', 'true-false', 'fill-blank', 'comprehensive')),
    content TEXT NOT NULL,
    options JSONB,
    answer TEXT NOT NULL,
    explanation TEXT,
    difficulty VARCHAR(20) DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    tags JSONB DEFAULT '[]',
    case_background TEXT,
    case_context TEXT,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.questions IS '题目表';
COMMENT ON COLUMN public.questions.parent_id IS '父题目ID（综合题的子题）';
COMMENT ON COLUMN public.questions.options IS '选项（JSON格式）';
COMMENT ON COLUMN public.questions.case_background IS '案例背景（综合题）';
COMMENT ON COLUMN public.questions.case_context IS '案例上下文（综合题）';

-- ----------------------------------------
-- 4. 用户表 (users)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(11) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    nickname VARCHAR(50),
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'banned')),
    activated_categories JSONB DEFAULT '[]',
    device_id VARCHAR(100),
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.users IS '用户表';
COMMENT ON COLUMN public.users.activated_categories IS '已激活的分类ID数组';
COMMENT ON COLUMN public.users.device_id IS '当前登录设备ID（单设备登录控制）';

-- ----------------------------------------
-- 5. 管理员用户表 (admin_users)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.admin_users IS '后台管理员表';

-- ----------------------------------------
-- 6. 用户数据表 (user_data)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.user_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    data_key VARCHAR(100) NOT NULL,
    data_value JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, data_key)
);

COMMENT ON TABLE public.user_data IS '用户扩展数据表';

-- ----------------------------------------
-- 7. 健康检查表 (health_check)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.health_check (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    status VARCHAR(20) NOT NULL,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    details TEXT
);

COMMENT ON TABLE public.health_check IS '健康检查表';

-- ----------------------------------------
-- 8. 激活码表 (activation_codes)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.activation_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(10) UNIQUE NOT NULL,
    category_id VARCHAR(50) REFERENCES public.categories(id) ON DELETE CASCADE,
    category_name VARCHAR(100),
    type VARCHAR(20) DEFAULT 'once' CHECK (type IN ('once', 'multi')),
    max_uses INTEGER DEFAULT 1,
    uses INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired')),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.activation_codes IS '激活码表';
COMMENT ON COLUMN public.activation_codes.type IS '类型：once单次使用，multi多次使用';
COMMENT ON COLUMN public.activation_codes.max_uses IS '最大使用次数';
COMMENT ON COLUMN public.activation_codes.uses IS '已使用次数';

-- ----------------------------------------
-- 6. 用户激活记录表 (user_activations)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.user_activations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    category_id VARCHAR(50) NOT NULL,
    category_name VARCHAR(100),
    code VARCHAR(10) REFERENCES public.activation_codes(code) ON DELETE SET NULL,
    activated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.user_activations IS '用户激活记录表';

-- ----------------------------------------
-- 创建索引（优化查询性能）
-- ----------------------------------------
CREATE INDEX IF NOT EXISTS idx_questions_bank_id ON public.questions(bank_id);
CREATE INDEX IF NOT EXISTS idx_questions_parent_id ON public.questions(parent_id);
CREATE INDEX IF NOT EXISTS idx_questions_type ON public.questions(type);
CREATE INDEX IF NOT EXISTS idx_banks_category_id ON public.question_banks(category_id);
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);
CREATE INDEX IF NOT EXISTS idx_activation_codes_code ON public.activation_codes(code);
CREATE INDEX IF NOT EXISTS idx_user_activations_user_id ON public.user_activations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activations_category_id ON public.user_activations(category_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON public.admin_users(username);
CREATE INDEX IF NOT EXISTS idx_user_data_user_id ON public.user_data(user_id);
CREATE INDEX IF NOT EXISTS idx_health_check_status ON public.health_check(status);

-- ----------------------------------------
-- 启用 Row Level Security (RLS)
-- ----------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activation_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略（管理员可以访问所有数据）
CREATE POLICY "Allow admin full access" ON public.users
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Allow admin full access" ON public.activation_codes
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Allow admin full access" ON public.user_activations
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Allow admin full access" ON public.categories
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Allow admin full access" ON public.question_banks
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Allow admin full access" ON public.questions
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Allow admin full access" ON public.admin_users
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Allow admin full access" ON public.user_data
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Allow admin full access" ON public.health_check
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
