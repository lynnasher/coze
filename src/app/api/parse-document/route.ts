import { NextRequest, NextResponse } from 'next/server';
import { parseDocument } from '@/lib/document-parser';
import { generateId } from '@/lib/quiz-store';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const bankName = formData.get('bankName') as string | null;
    
    if (!file) {
      return NextResponse.json(
        { error: '未提供文件' },
        { status: 400 }
      );
    }
    
    const fileName = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // 生成题库ID（由服务端生成，确保一致性）
    const bankId = generateId();
    
    let fileType: 'pdf' | 'docx';
    let questions;
    
    if (fileName.endsWith('.docx')) {
      fileType = 'docx';
      questions = await parseDocument(buffer, fileType);
    } else if (fileName.endsWith('.pdf')) {
      fileType = 'pdf';
      questions = await parseDocument(buffer, fileType);
    } else {
      return NextResponse.json(
        { error: '仅支持 PDF 或 DOCX 格式文件' },
        { status: 400 }
      );
    }
    
    if (questions.length === 0) {
      return NextResponse.json(
        { 
          error: '未能从文档中提取到题目，请确保文档格式正确',
          suggestions: [
            '题目编号格式：1. 题目内容',
            '选项格式：A、选项内容',
            '答案格式：正确答案：B',
            '名师解析：...'
          ]
        },
        { status: 400 }
      );
    }
    
    // 返回解析后的题目列表（由前端保存到 localStorage）
    // 注意：服务端无法访问浏览器的 localStorage，所以必须返回给前端处理
    const typeStats = {
      single: questions.filter((q: { type: string }) => q.type === 'single').length,
      multiple: questions.filter((q: { type: string }) => q.type === 'multiple').length,
      'true-false': questions.filter((q: { type: string }) => q.type === 'true-false').length,
      'fill-blank': questions.filter((q: { type: string }) => q.type === 'fill-blank').length,
    };
    
    return NextResponse.json({
      success: true,
      message: `成功从文档中提取并导入 ${questions.length} 道题目`,
      questions,
      total: questions.length,
      typeStats,
      fileType,
      bankId,
      bankName: bankName || file.name.replace(/\.(pdf|docx)$/i, ''),
    });
  } catch (error) {
    console.error('文档解析错误:', error);
    return NextResponse.json(
      { error: `解析失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
