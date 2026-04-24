import { NextRequest, NextResponse } from 'next/server';
import { HeaderUtils } from 'coze-coding-dev-sdk';
import { parsePdfText, convertToQuestions } from '@/lib/pdf-parser';
import { requireAdminAuth } from '@/lib/api-auth';

// 解析 PDF 文件（需要管理员认证）
export async function POST(request: NextRequest) {
  // 验证管理员认证
  const auth = await requireAdminAuth(request);
  if (!auth.success) {
    return auth.response;
  }

  try {
// const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json(
        { error: '未提供文件' },
        { status: 400 }
      );
    }
    
    // 检查文件类型
    if (!file.name.endsWith('.pdf')) {
      return NextResponse.json(
        { error: '仅支持 PDF 文件' },
        { status: 400 }
      );
    }
    
    // 读取文件内容
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // 提取文本内容
    let textContent = '';
    
    try {
      // 使用 pdf-parse 解析 PDF
      const pdfParseModule = await import('pdf-parse');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfParse = ('default' in pdfParseModule ? pdfParseModule.default : pdfParseModule) as any;
      const pdfData = await pdfParse(buffer);
      textContent = pdfData.text;
    } catch (pdfError) {
      console.error('PDF 解析失败:', pdfError);
      // 如果 pdf-parse 失败，尝试提取可读的文本部分
      textContent = buffer.toString('utf-8').replace(/[^\x20-\x7E\n]/g, ' ');
    }
    
    // 解析文本内容
    const parsed = parsePdfText(textContent);
    const questions = convertToQuestions(parsed);
    
    // 返回解析结果
    return NextResponse.json({
      success: true,
      count: questions.length,
      questions,
    });
  } catch (error) {
    console.error('PDF 解析失败:', error);
    return NextResponse.json(
      { error: 'PDF 解析失败' },
      { status: 500 }
    );
  }
}
