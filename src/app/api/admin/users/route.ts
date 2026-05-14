import { NextResponse } from 'next/server';
import { userService } from '@/lib/services/user-service';
import { getSupabaseAdminClient } from '@/storage/database/supabase-client';
import { requireAdminAuth } from '@/lib/api-auth';

// 获取所有用户（包含激活码信息）
export async function GET(request: Request) {
  // 验证管理员认证
  const auth = await requireAdminAuth(request);
  if (!auth.success) {
    return auth.response;
  }

  // 解析分页参数
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const pageSize = parseInt(url.searchParams.get('pageSize') || '20', 10);
  const validPageSize = Math.min(Math.max(pageSize, 10), 100); // 限制 10-100
  const offset = (page - 1) * validPageSize;

  try {
    const client = getSupabaseAdminClient();
    
    // 先获取总数
    const { count: totalCount, error: countError } = await client
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('获取用户总数失败:', countError);
    }
    
    // 分页获取用户
    const { data: usersData, error: usersError } = await client
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
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
    
    // 获取所有激活码信息（用于显示激活码详情）
    const { data: codesData, error: codesError } = await client.from('activation_codes').select('id, code, category_id, expires_at');
    if (codesError) {
      console.error('获取激活码失败:', codesError);
    }
    const codesMap = new Map((codesData || []).map(c => [c.id, c]));
    
    // 获取所有用户激活记录（用于显示用户使用的具体激活码）
    const { data: userActivationsData, error: userActivationsError } = await client
      .from('user_activations')
      .select('id, user_id, category_id, activation_code, activated_at, expires_at');
    if (userActivationsError) {
      console.error('获取用户激活记录失败:', userActivationsError);
    }
    // 按 user_id 和 category_id 建立索引
    const userActivationsMap = new Map<string, { code: string | null; activatedAt: string; expiresAt: string | null }>();
    (userActivationsData || []).forEach(ua => {
      const key = `${ua.user_id}-${ua.category_id}`;
      userActivationsMap.set(key, {
        code: ua.activation_code,
        activatedAt: ua.activated_at,
        expiresAt: ua.expires_at,
      });
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
      const activations = activatedCategories.map((catId, idx) => {
        const categoryName = categoriesMap.get(catId) || catId;
        // 尝试从用户激活记录中获取具体激活码
        const userActivation = userActivationsMap.get(`${u.id}-${catId}`);
        const codeInfo = codesMap.get(catId);
        
        // 优先使用用户激活记录中的激活码，其次是激活码模板
        const activationCode = userActivation?.code || codeInfo?.code || null;
        
        return {
          id: `manual-${idx}`,
          category_id: catId,
          category_name: categoryName,
          activation_code: activationCode,
          activated_at: userActivation?.activatedAt || u.last_login_at || u.created_at,
          expires_at: userActivation?.expiresAt || codeInfo?.expires_at || null,
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
      pageSize: validPageSize
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器错误';
    console.error('获取用户列表失败:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
