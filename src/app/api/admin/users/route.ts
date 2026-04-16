import { NextResponse } from 'next/server';
import { userService } from '@/lib/services/user-service';
import { getSupabaseAdminClient } from '@/storage/database/supabase-client';

// 获取所有用户（包含激活码信息）
export async function GET() {
  try {
    const users = await userService.getAllUsers();
    const client = getSupabaseAdminClient();
    
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
      .select('id, user_id, category_id, activation_code_id, activated_at');
    if (userActivationsError) {
      console.error('获取用户激活记录失败:', userActivationsError);
    }
    // 按 user_id 和 category_id 建立索引
    const userActivationsMap = new Map<string, { codeId: string; code: string | null; activatedAt: string }>();
    (userActivationsData || []).forEach(ua => {
      const key = `${ua.user_id}-${ua.category_id}`;
      userActivationsMap.set(key, {
        codeId: ua.activation_code_id,
        code: ua.activation_code_id ? codesMap.get(ua.activation_code_id)?.code : null,
        activatedAt: ua.activated_at,
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
        return {
          id: `manual-${idx}`,
          category_id: catId,
          category_name: categoryName,
          // 优先使用用户激活记录中的激活码
          activation_code: userActivation?.code || codeInfo?.code || '手动激活',
          activated_at: userActivation?.activatedAt || u.last_login_at || u.created_at,
          expires_at: codeInfo?.expires_at || null,
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

    return NextResponse.json({ success: true, users: safeUsers });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器错误';
    console.error('获取用户列表失败:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
