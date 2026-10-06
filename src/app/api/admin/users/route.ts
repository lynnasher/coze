import { NextResponse } from 'next/server';
import { userService, hashPassword, generateDeviceId } from '@/lib/services/user-service';
import { getSupabaseAdminClient } from '@/storage/database/supabase-client';
import { requireAdminAuth } from '@/lib/api-auth';

// 获取所有用户（包含激活码信息）
export async function GET(request: Request) {
  // 验证管理员认证
  const auth = await requireAdminAuth(request);
  if (!auth.success) {
    return auth.response;
  }

  // 解析分页参数、搜索参数、状态筛选与排序
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const pageSize = parseInt(url.searchParams.get('pageSize') || '20', 10);
  const search = url.searchParams.get('search') || ''; // 搜索关键词
  const status = url.searchParams.get('status') || ''; // active / banned
  const sortBy = url.searchParams.get('sortBy') || ''; // lastLogin 表示按最近活跃排序
  const validPageSize = Math.min(Math.max(pageSize, 10), 100); // 限制 10-100
  const offset = (page - 1) * validPageSize;

  try {
    const client = getSupabaseAdminClient();

    // 全局统计（供顶部卡片使用，不受搜索/筛选/分页影响）
    const [totalUsersRes, activeUsersRes, bannedUsersRes, adminUsersRes] = await Promise.all([
      client.from('users').select('id', { count: 'exact', head: true }).neq('role', 'admin'),
      client.from('users').select('id', { count: 'exact', head: true }).neq('role', 'admin').eq('status', 'active'),
      client.from('users').select('id', { count: 'exact', head: true }).neq('role', 'admin').eq('status', 'banned'),
      client.from('users').select('id', { count: 'exact', head: true }).eq('role', 'admin'),
    ]);
    const stats = {
      totalUsers: totalUsersRes.count || 0,
      activeUsers: activeUsersRes.count || 0,
      bannedUsers: bannedUsersRes.count || 0,
      adminUsers: adminUsersRes.count || 0,
    };
    
    // 构建基础查询（排除管理员）
    let countQuery = client
      .from('users')
      .select('*', { count: 'exact', head: true })
      .neq('role', 'admin');
    
    let dataQuery = client
      .from('users')
      .select('*')
      .neq('role', 'admin');
    
    // 状态筛选（活跃 / 禁用）
    if (status === 'active' || status === 'banned') {
      countQuery = countQuery.eq('status', status);
      dataQuery = dataQuery.eq('status', status);
    }
    
    // 如果有搜索关键词，添加搜索条件
    if (search) {
      // 使用 or 条件搜索手机号或昵称
      const searchCondition = `phone.ilike.%${search}%,nickname.ilike.%${search}%`;
      countQuery = countQuery.or(searchCondition);
      dataQuery = dataQuery.or(searchCondition);
    }
    
    // 先获取总数
    const { count: totalCount, error: countError } = await countQuery;
    
    if (countError) {
      console.error('获取用户总数失败:', countError);
    }
    
    // 排序：按最近活跃(last_login_at) 倒序，或默认按注册时间倒序
    let orderedQuery = dataQuery.order('created_at', { ascending: false });
    if (sortBy === 'lastLogin') {
      orderedQuery = dataQuery.order('last_login_at', { ascending: false, nullsFirst: false });
    }
    
    // 分页获取用户
    const { data: usersData, error: usersError } = await orderedQuery
      .range(offset, offset + validPageSize - 1);
    
    if (usersError) {
      throw new Error(`查询用户失败: ${usersError.message}`);
    }
    
    const users = usersData || [];
    
    // 获取所有分类信息（用于显示分类名称）
    const { data: categoriesData, error: categoriesError } = await client.from('categories').select('id, name');
    if (categoriesError) {
      console.error('获取分类失败:', categoriesError);
    }
    const categoriesMap = new Map((categoriesData || []).map(c => [c.id, c.name]));
    
    // 获取所有用户激活记录（激活码与到期时间的唯一可信来源）
    const { data: userActivationsData, error: userActivationsError } = await client
      .from('user_activations')
      .select('id, user_id, category_id, activation_code, activated_at, expires_at');
    if (userActivationsError) {
      console.error('获取用户激活记录失败:', userActivationsError);
    }
    // 按 user_id + category_id 建立索引（同一分类多次激活时取最近一次）
    const userActivationsMap = new Map<string, { code: string | null; activatedAt: string; expiresAt: string | null }>();
    (userActivationsData || []).forEach(ua => {
      const key = `${ua.user_id}-${ua.category_id}`;
      const existing = userActivationsMap.get(key);
      const isNewer = !existing || !existing.activatedAt || (ua.activated_at && new Date(ua.activated_at) > new Date(existing.activatedAt));
      if (isNewer) {
        userActivationsMap.set(key, {
          code: ua.activation_code,
          activatedAt: ua.activated_at,
          expiresAt: ua.expires_at,
        });
      }
    });
    
    // 返回脱敏的用户信息，并解析 activated_categories
    const safeUsers = users.map((u) => {
      let activatedCategories: string[] = [];
      if (u.activated_categories) {
        try {
          activatedCategories = JSON.parse(u.activated_categories);
        } catch {
          activatedCategories = [];
        }
      }
      
      // 构建激活详情列表
      // 激活码与到期时间仅以 user_activations 真实激活记录为准。
      // 若某分类在 activated_categories 中但无对应激活记录（手动/默认授权），
      // 则不显示激活码、显示为永久，避免用激活码池里任意一条码张冠李戴。
      const activations = activatedCategories.map((catId, idx) => {
        const categoryName = categoriesMap.get(catId) || catId;
        const userActivation = userActivationsMap.get(`${u.id}-${catId}`);
        
        return {
          id: `manual-${idx}`,
          category_id: catId,
          category_name: categoryName,
          activation_code: userActivation?.code || null,
          activated_at: userActivation?.activatedAt || u.last_login_at || u.created_at,
          expires_at: userActivation?.expiresAt || null,
        };
      });
      
      return {
        id: u.id,
        phone: u.phone,
        nickname: u.nickname,
        role: u.role,
        status: u.status,
        activated_categories: activatedCategories,
        created_at: u.created_at,
        last_login_at: u.last_login_at,
        // 添加激活码信息
        activations,
      };
    });

    return NextResponse.json({ 
      success: true, 
      users: safeUsers,
      total: totalCount || 0,
      page,
      pageSize: validPageSize,
      stats
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器错误';
    console.error('获取用户列表失败:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// 创建新用户
export async function POST(request: Request) {
  // 验证管理员认证
  const auth = await requireAdminAuth(request);
  if (!auth.success) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const { phone, nickname, password, role = 'user' } = body;

    // 验证必填字段
    if (!phone || !password) {
      return NextResponse.json({ success: false, error: '手机号和密码不能为空' }, { status: 400 });
    }

    // 验证手机号格式
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return NextResponse.json({ success: false, error: '手机号格式不正确' }, { status: 400 });
    }

    // 验证密码强度（至少8位，包含大小写字母和数字）
    if (password.length < 8) {
      return NextResponse.json({ success: false, error: '密码长度至少8位' }, { status: 400 });
    }
    if (!/[a-z]/.test(password)) {
      return NextResponse.json({ success: false, error: '密码需包含小写字母' }, { status: 400 });
    }
    if (!/[A-Z]/.test(password)) {
      return NextResponse.json({ success: false, error: '密码需包含大写字母' }, { status: 400 });
    }
    if (!/[0-9]/.test(password)) {
      return NextResponse.json({ success: false, error: '密码需包含数字' }, { status: 400 });
    }

    const adminClient = getSupabaseAdminClient();

    // 检查手机号是否已存在
    const { data: existing, error: checkError } = await adminClient
      .from('users')
      .select('id')
      .eq('phone', phone)
      .maybeSingle();

    if (checkError) {
      throw new Error(`检查手机号失败: ${checkError.message}`);
    }

    if (existing) {
      return NextResponse.json({ success: false, error: '该手机号已被注册' }, { status: 400 });
    }

    // 加密密码
    const hashedPassword = hashPassword(password);

    // 创建设备ID
    const deviceId = generateDeviceId();

    // 创建用户
    const { data: newUser, error: insertError } = await adminClient
      .from('users')
      .insert({
        phone,
        password: hashedPassword,
        nickname: nickname || null,
        role,
        status: 'active',
        device_id: deviceId,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`创建用户失败: ${insertError.message}`);
    }

    return NextResponse.json({ success: true, user: newUser });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器错误';
    console.error('添加用户失败:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
