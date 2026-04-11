import { NextRequest, NextResponse } from 'next/server';
import { HeaderUtils } from 'coze-coding-dev-sdk';
import { parsePdfText, convertToQuestions } from '@/lib/pdf-parser';
import { questionStore } from '@/lib/quiz-store';

export async function POST(request: NextRequest) {
  try {
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    
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
    
    // 保存到数据库
    questionStore.addMultiple(questions);
    
    return NextResponse.json({
      success: true,
      message: `成功导入 ${questions.length} 道题目`,
      questions,
      total: questions.length,
    });
  } catch (error) {
    console.error('PDF 导入错误:', error);
    return NextResponse.json(
      { error: '导入失败，请重试' },
      { status: 500 }
    );
  }
}
