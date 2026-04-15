import { getSupabaseClient } from '@/storage/database/supabase-client';

// 激活码类型定义
export interface ActivationCode {
  id: string;
  code: string;
  category_id: string;
  category_name: string | null;
  type: 'once' | 'single' | 'multiple';
  max_uses: number;
  uses: number;
  expires_at: string | null;
  status: 'active' | 'used' | 'expired' | 'disabled';
  description: string | null;
  created_at: string;
}

// 用户激活记录类型定义
export interface UserActivation {
  id: string;
  user_id: string;
  category_id: string;
  category_name: string | null;
  activation_code: string | null;
  activated_at: string;
  expires_at: string | null;
}

// 激活码服务
export const activationCodeService = {
  // 生成激活码
  generateCode(length: number = 8): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  // 创建激活码
  async create(
    categoryId: string,
    categoryName: string,
    type: 'once' | 'single' | 'multiple' = 'once',
    maxUses: number = 1,
    expiresAt?: number,
    description?: string
  ): Promise<ActivationCode> {
    const client = getSupabaseClient();
    
    let code = this.generateCode();
    // 确保激活码唯一
    let attempts = 0;
    while (attempts < 10) {
      const existing = await client.from('activation_codes').select('id').eq('code', code).maybeSingle();
      if (!existing) break;
      code = this.generateCode();
      attempts++;
    }
    
    const { data, error } = await client.from('activation_codes').insert({
      code,
      category_id: categoryId,
      category_name: categoryName,
      type,
      max_uses: maxUses,
      uses: 0,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      status: 'active',
      description: description || null,
    }).select().single();
    
    if (error) throw new Error(`创建激活码失败: ${error.message}`);
    return data as ActivationCode;
  },

  // 批量创建激活码
  async createBatch(
    categoryId: string,
    categoryName: string,
    count: number,
    type: 'once' | 'single' | 'multiple' = 'once',
    maxUses: number = 1,
    expiresAt?: number,
    description?: string
  ): Promise<ActivationCode[]> {
    const codes: ActivationCode[] = [];
    for (let i = 0; i < count; i++) {
      const code = await this.create(categoryId, categoryName, type, maxUses, expiresAt, description);
      codes.push(code);
    }
    return codes;
  },

  // 通过激活码查找
  async findByCode(code: string): Promise<ActivationCode | null> {
    const client = getSupabaseClient();
    const { data, error } = await client.from('activation_codes').select('*').eq('code', code.toUpperCase()).maybeSingle();
    if (error) throw new Error(`查询激活码失败: ${error.message}`);
    return data as ActivationCode | null;
  },

  // 获取所有激活码
  async getAll(): Promise<ActivationCode[]> {
    const client = getSupabaseClient();
    const { data, error } = await client.from('activation_codes').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(`查询激活码失败: ${error.message}`);
    return (data || []) as ActivationCode[];
  },

  // 获取某个分类的激活码
  async getByCategory(categoryId: string): Promise<ActivationCode[]> {
    const client = getSupabaseClient();
    const { data, error } = await client.from('activation_codes').select('*').eq('category_id', categoryId).order('created_at', { ascending: false });
    if (error) throw new Error(`查询激活码失败: ${error.message}`);
    return (data || []) as ActivationCode[];
  },

  // 使用激活码
  async useCode(code: string, userId: string): Promise<UserActivation> {
    const activationCode = await this.findByCode(code);
    
    if (!activationCode) {
      throw new Error('激活码不存在');
    }
    
    if (activationCode.status !== 'active') {
      throw new Error(`激活码已${activationCode.status === 'used' ? '使用' : activationCode.status === 'expired' ? '过期' : '禁用'}`);
    }
    
    if (activationCode.expires_at && new Date(activationCode.expires_at) < new Date()) {
      throw new Error('激活码已过期');
    }
    
    if (activationCode.uses >= activationCode.max_uses) {
      throw new Error('激活码已用完');
    }
    
    const client = getSupabaseClient();
    
    // 创建用户激活记录
    const { data: activation, error: activationError } = await client.from('user_activations').insert({
      user_id: userId,
      category_id: activationCode.category_id,
      category_name: activationCode.category_name,
      activation_code: activationCode.code,
      expires_at: activationCode.type === 'multiple' ? null : activationCode.expires_at,
    }).select().single();
    
    if (activationError) throw new Error(`创建激活记录失败: ${activationError.message}`);
    
    // 更新激活码使用次数
    const { error: updateError } = await client.from('activation_codes').update({
      uses: activationCode.uses + 1,
      status: activationCode.type === 'once' || activationCode.uses + 1 >= activationCode.max_uses ? 'used' : 'active',
    }).eq('id', activationCode.id);
    
    if (updateError) throw new Error(`更新激活码失败: ${updateError.message}`);
    
    return activation as UserActivation;
  },

  // 获取用户的激活记录
  async getUserActivations(userId: string): Promise<UserActivation[]> {
    const client = getSupabaseClient();
    const { data, error } = await client.from('user_activations').select('*').eq('user_id', userId).order('activated_at', { ascending: false });
    if (error) throw new Error(`查询激活记录失败: ${error.message}`);
    return (data || []) as UserActivation[];
  },

  // 检查用户是否已激活某分类
  async hasActivatedCategory(userId: string, categoryId: string): Promise<boolean> {
    const client = getSupabaseClient();
    const { data, error } = await client.from('user_activations')
      .select('id')
      .eq('user_id', userId)
      .eq('category_id', categoryId)
      .maybeSingle();
    
    if (error) throw new Error(`查询激活记录失败: ${error.message}`);
    return !!data;
  },

  // 获取用户已激活的分类ID列表（过滤过期的激活记录）
  async getUserActivatedCategoryIds(userId: string): Promise<string[]> {
    const activations = await this.getUserActivations(userId);
    const now = new Date();
    
    // 过滤出未过期的激活记录
    const validActivations = activations.filter(a => {
      // 如果没有过期时间，说明是永久激活
      if (!a.expires_at) return true;
      // 如果过期时间在当前时间之后，说明还未过期
      return new Date(a.expires_at) > now;
    });
    
    return [...new Set(validActivations.map(a => a.category_id))];
  },

  // 禁用激活码
  async disable(codeId: string): Promise<void> {
    const client = getSupabaseClient();
    const { error } = await client.from('activation_codes').update({ status: 'disabled' }).eq('id', codeId);
    if (error) throw new Error(`禁用激活码失败: ${error.message}`);
  },

  // 删除激活码（级联删除用户激活记录）
  async delete(codeId: string): Promise<void> {
    const client = getSupabaseClient();
    
    // 先查询激活码，获取 code 用于删除用户激活记录
    const { data: codeData, error: codeError } = await client
      .from('activation_codes')
      .select('code')
      .eq('id', codeId)
      .maybeSingle();
    
    if (codeError) throw new Error(`查询激活码失败: ${codeError.message}`);
    
    // 如果找到了激活码，先删除使用该激活码的用户激活记录
    if (codeData) {
      const { error: activationError } = await client
        .from('user_activations')
        .delete()
        .eq('activation_code', codeData.code);
      
      if (activationError) throw new Error(`删除用户激活记录失败: ${activationError.message}`);
    }
    
    // 删除激活码本身
    const { error } = await client.from('activation_codes').delete().eq('id', codeId);
    if (error) throw new Error(`删除激活码失败: ${error.message}`);
  },
};
