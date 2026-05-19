/**
 * 激活码服务 - PostgreSQL 版本
 */
import { query, transaction } from '@/lib/db/postgres-client';

export interface ActivationCode {
  id: string;
  code: string;
  category_id: string;
  category_name: string;
  type: 'once' | 'multi';
  max_uses: number;
  uses: number;
  status: 'active' | 'used' | 'expired';
  expires_at: string | null;
  created_at: string;
}

// 生成随机激活码
function generateCode(length: number = 8): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 去掉容易混淆的字符
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export const activationService = {
  // 生成激活码
  async generateCodes(
    categoryId: string,
    categoryName: string,
    quantity: number = 1,
    type: 'once' | 'multi' = 'once',
    maxUses: number = 1,
    expiresAt?: string
  ): Promise<ActivationCode[]> {
    const codes: ActivationCode[] = [];

    for (let i = 0; i < quantity; i++) {
      let code = generateCode();
      let attempts = 0;

      // 确保激活码唯一
      while (attempts < 10) {
        const existing = await query('SELECT id FROM activation_codes WHERE code = $1', [code]);
        if (existing.rows.length === 0) break;
        code = generateCode();
        attempts++;
      }

      const result = await query<ActivationCode>(
        `INSERT INTO activation_codes (code, category_id, category_name, type, max_uses, uses, status, expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         RETURNING *`,
        [code, categoryId, categoryName, type, maxUses, 0, 'active', expiresAt || null]
      );

      codes.push(result.rows[0]);
    }

    return codes;
  },

  // 获取所有激活码
  async getAllCodes(): Promise<ActivationCode[]> {
    const result = await query<ActivationCode>(
      'SELECT * FROM activation_codes ORDER BY created_at DESC'
    );
    return result.rows;
  },

  // 根据分类获取激活码
  async getCodesByCategory(categoryId: string): Promise<ActivationCode[]> {
    const result = await query<ActivationCode>(
      'SELECT * FROM activation_codes WHERE category_id = $1 ORDER BY created_at DESC',
      [categoryId]
    );
    return result.rows;
  },

  // 使用激活码
  async useCode(code: string, userId: string): Promise<{
    success: boolean;
    categoryId?: string;
    categoryName?: string;
    message?: string;
  }> {
    return await transaction(async (client) => {
      // 查询激活码
      const codeResult = await client.query<ActivationCode>(
        'SELECT * FROM activation_codes WHERE code = $1',
        [code]
      );

      if (codeResult.rows.length === 0) {
        return { success: false, message: '激活码不存在' };
      }

      const activationCode = codeResult.rows[0];

      // 检查状态
      if (activationCode.status === 'used') {
        return { success: false, message: '激活码已被使用' };
      }

      if (activationCode.status === 'expired') {
        return { success: false, message: '激活码已过期' };
      }

      // 检查过期时间
      if (activationCode.expires_at && new Date(activationCode.expires_at) < new Date()) {
        await client.query(
          'UPDATE activation_codes SET status = $1 WHERE id = $2',
          ['expired', activationCode.id]
        );
        return { success: false, message: '激活码已过期' };
      }

      // 检查是否已激活过该分类
      const existingActivation = await client.query(
        'SELECT id FROM user_activations WHERE user_id = $1 AND category_id = $2',
        [userId, activationCode.category_id]
      );

      if (existingActivation.rows.length > 0) {
        return { success: false, message: '您已激活过该科目' };
      }

      // 创建用户激活记录
      await client.query(
        `INSERT INTO user_activations (user_id, category_id, category_name, activated_at)
         VALUES ($1, $2, $3, NOW())`,
        [userId, activationCode.category_id, activationCode.category_name]
      );

      // 更新激活码使用次数
      const newUses = activationCode.uses + 1;
      const newStatus = newUses >= activationCode.max_uses ? 'used' : 'active';

      await client.query(
        'UPDATE activation_codes SET uses = $1, status = $2 WHERE id = $3',
        [newUses, newStatus, activationCode.id]
      );

      return {
        success: true,
        categoryId: activationCode.category_id,
        categoryName: activationCode.category_name,
      };
    });
  },

  // 删除激活码
  async deleteCode(codeId: string): Promise<void> {
    await query('DELETE FROM activation_codes WHERE id = $1', [codeId]);
  },

  // 获取用户的激活分类
  async getUserActivatedCategories(userId: string): Promise<string[]> {
    const result = await query<{ category_id: string }>(
      'SELECT category_id FROM user_activations WHERE user_id = $1',
      [userId]
    );
    return result.rows.map(row => row.category_id);
  },

  // 检查用户是否激活了某个分类
  async isCategoryActivated(userId: string, categoryId: string): Promise<boolean> {
    const result = await query(
      'SELECT id FROM user_activations WHERE user_id = $1 AND category_id = $2',
      [userId, categoryId]
    );
    return result.rows.length > 0;
  },
};
