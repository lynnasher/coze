import { getSupabaseClient } from '@/storage/database/supabase-client';

// 题库类型定义
export interface DbQuestionBank {
  id: string;
  name: string;
  description: string | null;
  source_file: string | null;
  question_count: number;
  category_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

// 题目类型定义
export interface DbQuestion {
  id: string;
  bank_id: string;
  parent_id: string | null;
  type: string;
  content: string;
  options: string | null; // JSON string
  answer: string | null;
  explanation: string | null;
  difficulty: string;
  tags: string | null; // JSON string
  case_background: string | null;
  case_context: string | null;
  status: string;
  created_at: string;
}

// 前端题目格式
export interface Question {
  id: string;
  parentId?: string;
  type: 'single' | 'multiple' | 'true-false' | 'fill-blank' | 'comprehensive';
  content: string;
  options?: { id: string; text: string }[];
  answer: string | string[];
  explanation?: string;
  difficulty: string;
  tags: string[];
  bankId?: string;
  createdAt: number;
  caseBackground?: string;
  caseContext?: string; // 案例上下文/材料
  children?: Question[];
}

// 分类类型定义
export interface DbCategory {
  id: string;
  name: string;
  color: string;
  order: number;
  parent_id: string | null;
  created_at: string;
}

// 题库服务
export const bankService = {
  // 创建题库
  async createBank(
    name: string,
    description?: string,
    sourceFile?: string,
    categoryId?: string
  ): Promise<DbQuestionBank> {
    const client = getSupabaseClient();
    const id = `bank_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const { data, error } = await client
      .from('question_banks')
      .insert({
        id,
        name,
        description: description || null,
        source_file: sourceFile || null,
        category_id: categoryId || null,
        question_count: 0,
        status: 'active',
      })
      .select()
      .single();

    if (error) throw new Error(`创建题库失败: ${error.message}`);
    return data as DbQuestionBank;
  },

  // 获取所有题库
  async getAllBanks(): Promise<DbQuestionBank[]> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('question_banks')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`获取题库列表失败: ${error.message}`);
    return (data || []) as DbQuestionBank[];
  },

  // 通过 ID 获取题库
  async getBankById(id: string): Promise<DbQuestionBank | null> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('question_banks')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`获取题库失败: ${error.message}`);
    return data as DbQuestionBank | null;
  },

  // 更新题库题目数量
  async updateQuestionCount(bankId: string, count: number): Promise<void> {
    const client = getSupabaseClient();
    const { error } = await client
      .from('question_banks')
      .update({
        question_count: count,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bankId);

    if (error) throw new Error(`更新题库题目数量失败: ${error.message}`);
  },

  // 删除题库（软删除）
  async deleteBank(id: string): Promise<void> {
    const client = getSupabaseClient();

    // 先删除题库下的所有题目
    await client.from('questions').delete().eq('bank_id', id);

    // 删除题库
    const { error } = await client
      .from('question_banks')
      .update({ status: 'disabled' })
      .eq('id', id);

    if (error) throw new Error(`删除题库失败: ${error.message}`);
  },

  // 更新题库（名称、分类等）
  async updateBank(
    id: string,
    updates: { name?: string; categoryId?: string | null; description?: string }
  ): Promise<DbQuestionBank> {
    const client = getSupabaseClient();
    
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    
    if (updates.name !== undefined) {
      updateData.name = updates.name;
    }
    if (updates.categoryId !== undefined) {
      updateData.category_id = updates.categoryId;
    }
    if (updates.description !== undefined) {
      updateData.description = updates.description;
    }

    const { data, error } = await client
      .from('question_banks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`更新题库失败: ${error.message}`);
    return data as DbQuestionBank;
  },

  // 批量创建题目
  async createQuestions(questions: Question[], bankId: string): Promise<number> {
    const client = getSupabaseClient();
    
    // 扁平化处理题目（将综合题拆分为父题和子题）
    const questionsToInsert: Array<{
      id: string;
      bank_id: string;
      parent_id: string | null;
      type: string;
      content: string;
      options: string | null;
      answer: string | null;
      explanation: string | null;
      difficulty: string;
      tags: string | null;
      case_background: string | null;
      case_context: string | null;
    }> = [];

    for (const q of questions) {
      if (q.type === 'comprehensive' && q.children) {
        // 综合题：先插入父题目
        questionsToInsert.push({
          id: q.id,
          bank_id: bankId,
          parent_id: null,
          type: q.type,
          content: q.content || '',
          options: null,
          answer: null,
          explanation: q.explanation || null,
          difficulty: q.difficulty || 'medium',
          tags: JSON.stringify(q.tags || []),
          case_background: q.caseBackground || null,
          case_context: q.caseContext || null,
        });

        // 插入子题目
        for (const child of q.children) {
          questionsToInsert.push({
            id: child.id,
            bank_id: bankId,
            parent_id: q.id,
            type: child.type,
            content: child.content,
            options: child.options ? JSON.stringify(child.options) : null,
            answer: Array.isArray(child.answer) ? JSON.stringify(child.answer) : child.answer,
            explanation: child.explanation || null,
            difficulty: child.difficulty || 'medium',
            tags: JSON.stringify(child.tags || []),
            case_background: null,
            case_context: null,
          });
        }
      } else {
        // 普通题目
        questionsToInsert.push({
          id: q.id,
          bank_id: bankId,
          parent_id: q.parentId || null,
          type: q.type,
          content: q.content,
          options: q.options ? JSON.stringify(q.options) : null,
          answer: Array.isArray(q.answer) ? JSON.stringify(q.answer) : q.answer,
          explanation: q.explanation || null,
          difficulty: q.difficulty || 'medium',
          tags: JSON.stringify(q.tags || []),
          case_background: q.caseBackground || null,
          case_context: q.caseContext || null,
        });
      }
    }

    const { error } = await client.from('questions').insert(questionsToInsert);

    if (error) throw new Error(`创建题目失败: ${error.message}`);

    // 更新题库的题目数量
    const uniqueParentCount = new Set(questionsToInsert.map(q => q.parent_id || q.id)).size;
    await this.updateQuestionCount(bankId, uniqueParentCount);

    return questionsToInsert.length;
  },

  // 通过题库ID获取所有题目
  async getQuestionsByBankId(bankId: string): Promise<Question[]> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('questions')
      .select('*')
      .eq('bank_id', bankId)
      .eq('status', 'active')
      .order('created_at', { ascending: true });

    if (error) throw new Error(`获取题目失败: ${error.message}`);

    return this.convertToFrontendQuestions((data || []) as DbQuestion[]);
  },

  // 通过题库ID获取题目（前端格式）
  async getQuestionsByBankIdFlat(bankId: string): Promise<Question[]> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('questions')
      .select('*')
      .eq('bank_id', bankId)
      .eq('status', 'active')
      .is('parent_id', null) // 只获取父题目
      .order('created_at', { ascending: true });

    if (error) throw new Error(`获取题目失败: ${error.message}`);

    return this.convertToFrontendQuestions((data || []) as DbQuestion[]);
  },

  // 转换数据库题目为前端格式
  convertToFrontendQuestions(dbQuestions: DbQuestion[]): Question[] {
    const result: Question[] = [];
    const questionMap = new Map<string, Question>();

    // 第一遍：创建所有题目
    for (const q of dbQuestions) {
      const question: Question = {
        id: q.id,
        parentId: q.parent_id || undefined,
        type: q.type as Question['type'],
        content: q.content,
        answer: q.answer ? (q.answer.startsWith('[') ? JSON.parse(q.answer) : q.answer) : '',
        explanation: q.explanation || undefined,
        difficulty: q.difficulty,
        tags: q.tags ? JSON.parse(q.tags) : [],
        bankId: q.bank_id,
        createdAt: new Date(q.created_at).getTime(),
        caseBackground: q.case_background || undefined,
        children: [],
      };

      if (q.options) {
        try {
          question.options = JSON.parse(q.options);
        } catch {
          question.options = [];
        }
      }

      questionMap.set(q.id, question);
    }

    // 第二遍：构建父子关系
    for (const q of dbQuestions) {
      const question = questionMap.get(q.id)!;
      if (q.parent_id) {
        const parent = questionMap.get(q.parent_id);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(question);
        }
      } else {
        result.push(question);
      }
    }

    return result;
  },

  // 获取所有题目（跨题库）
  async getAllQuestions(): Promise<Question[]> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('questions')
      .select('*')
      .eq('status', 'active')
      .is('parent_id', null) // 只获取父题目
      .order('created_at', { ascending: true });

    if (error) throw new Error(`获取题目失败: ${error.message}`);

    return this.convertToFrontendQuestions((data || []) as DbQuestion[]);
  },

  // 删除题目（软删除）
  async deleteQuestion(id: string): Promise<void> {
    const client = getSupabaseClient();
    const { error } = await client
      .from('questions')
      .update({ status: 'disabled' })
      .eq('id', id);

    if (error) throw new Error(`删除题目失败: ${error.message}`);
  },

  // 获取统计信息
  async getStats(): Promise<{ banks: number; questions: number }> {
    const client = getSupabaseClient();
    
    const { count: bankCount, error: bankError } = await client
      .from('question_banks')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    const { count: questionCount, error: questionError } = await client
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .is('parent_id', null); // 只统计父题目

    if (bankError || questionError) {
      throw new Error('获取统计数据失败');
    }

    return {
      banks: bankCount || 0,
      questions: questionCount || 0,
    };
  },
};

// 分类服务
export const categoryService = {
  // 获取所有分类
  async getAllCategories(): Promise<DbCategory[]> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('categories')
      .select('*')
      .order('order', { ascending: true });

    if (error) throw new Error(`获取分类失败: ${error.message}`);
    return (data || []) as DbCategory[];
  },

  // 创建分类
  async createCategory(
    name: string,
    color: string = 'blue',
    parentId?: string
  ): Promise<DbCategory> {
    const client = getSupabaseClient();
    const id = `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 获取当前最大 order
    const { data: existing } = await client
      .from('categories')
      .select('order')
      .order('order', { ascending: false })
      .limit(1);

    const maxOrder = existing && existing.length > 0 ? (existing[0] as { order: number }).order : 0;

    const { data, error } = await client
      .from('categories')
      .insert({
        id,
        name,
        color,
        order: maxOrder + 1,
        parent_id: parentId || null,
      })
      .select()
      .single();

    if (error) throw new Error(`创建分类失败: ${error.message}`);
    return data as DbCategory;
  },

  // 更新分类
  async updateCategory(
    id: string,
    updates: { name?: string; color?: string; order?: number }
  ): Promise<void> {
    const client = getSupabaseClient();
    const { error } = await client
      .from('categories')
      .update(updates)
      .eq('id', id);

    if (error) throw new Error(`更新分类失败: ${error.message}`);
  },

  // 删除分类
  async deleteCategory(id: string): Promise<void> {
    const client = getSupabaseClient();

    // 先删除子分类
    await client.from('categories').delete().eq('parent_id', id);

    // 删除分类
    const { error } = await client.from('categories').delete().eq('id', id);

    if (error) throw new Error(`删除分类失败: ${error.message}`);
  },

  // 获取子分类
  async getChildren(parentId: string): Promise<DbCategory[]> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('categories')
      .select('*')
      .eq('parent_id', parentId)
      .order('order', { ascending: true });

    if (error) throw new Error(`获取子分类失败: ${error.message}`);
    return (data || []) as DbCategory[];
  },

  // 获取顶级分类
  async getRootCategories(): Promise<DbCategory[]> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('categories')
      .select('*')
      .is('parent_id', null)
      .order('order', { ascending: true });

    if (error) throw new Error(`获取顶级分类失败: ${error.message}`);
    return (data || []) as DbCategory[];
  },
};
