import { Question, QuestionType, Difficulty, QuizOption } from './types';
import { generateId } from './quiz-store';

// 从文本提取题目的解析器
export interface ParsedQuestion {
  type: QuestionType;
  content: string;
  options?: QuizOption[];
  answer: string | string[];
  explanation?: string;
  difficulty: Difficulty;
}

// 清理文本
const cleanText = (text: string): string => {
  return text
    .replace(/[\r\n]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

// 解析选项
const parseOptions = (lines: string[]): QuizOption[] => {
  const options: QuizOption[] = [];
  const optionRegex = /^([A-Da-d])[.、)]\s*(.+)/;
  
  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(optionRegex);
    if (match) {
      options.push({
        id: match[1].toLowerCase(),
        text: match[2].trim(),
      });
    }
  }
  
  return options;
};

// 识别题目类型
const identifyType = (content: string, options: QuizOption[]): QuestionType => {
  const lowerContent = content.toLowerCase();
  
  // 类型关键词判断
  if (/对错|判断|正确.*错误|true.*false|是.*非/i.test(lowerContent)) {
    return 'true-false';
  }
  if (/多选|哪些|选出|选择.*以下|以下.*正确/i.test(lowerContent)) {
    return 'multiple';
  }
  if (/填空|填写|补全/i.test(lowerContent)) {
    return 'fill-blank';
  }
  
  // 判断题特征：只有两个选项且包含正确/错误
  if (options.length === 2) {
    const firstOption = options[0].text.toLowerCase();
    if (/正确|对|是|true|yes/i.test(firstOption) || 
        /错误|错|否|false|no/i.test(firstOption)) {
      return 'true-false';
    }
  }
  
  return 'single';
};

// 识别难度
const identifyDifficulty = (content: string): Difficulty => {
  const lowerContent = content.toLowerCase();
  
  if (/困难|很难|很难|hard|难点/i.test(lowerContent)) {
    return 'hard';
  }
  if (/简单|容易|easy|基础/i.test(lowerContent)) {
    return 'easy';
  }
  
  return 'medium';
};

// 解析单个题目块
const parseQuestionBlock = (block: string): ParsedQuestion | null => {
  const lines = block.split('\n').map(l => l.trim()).filter(l => l);
  
  if (lines.length === 0) return null;
  
  // 提取题目内容（第一行或前几行直到遇到选项）
  const contentLines: string[] = [];
  const optionLines: string[] = [];
  let inOptions = false;
  
  for (const line of lines) {
    // 检测选项开始
    if (/^[A-Da-d][.、)]\s*/.test(line)) {
      inOptions = true;
      optionLines.push(line);
    } else if (inOptions) {
      // 继续收集选项行
      optionLines.push(line);
    } else {
      contentLines.push(line);
    }
  }
  
  const content = contentLines.join(' ').replace(/^\d+[.、)]\s*/, '').trim();
  
  if (!content) return null;
  
  const options = parseOptions(optionLines);
  const type = identifyType(content, options);
  
  // 提取答案（通常在题目末尾或解析后）
  let answer: string | string[] = 'a';
  
  // 尝试从内容中提取答案
  const answerMatch = content.match(/答案[：:]\s*([A-Da-d]+)/i) ||
                      content.match(/答[：:]\s*([A-Da-d]+)/i) ||
                      content.match(/ANS[:\s]+([A-Da-d]+)/i);
  
  if (answerMatch) {
    answer = answerMatch[1].toLowerCase();
  }
  
  // 多选题答案
  if (type === 'multiple' && answerMatch) {
    answer = answer.split('').filter(c => /[a-d]/.test(c));
  }
  
  // 判断题答案转换
  if (type === 'true-false') {
    if (answer === 'a' || answer === 'true' || answer === '对' || answer === '正确') {
      answer = 'true';
    } else {
      answer = 'false';
    }
  }
  
  return {
    type,
    content: content.replace(/答案[：:]\s*[A-Da-d]+/gi, '').trim(),
    options: options.length > 0 ? options : undefined,
    answer,
    difficulty: identifyDifficulty(content),
  };
};

// 主解析函数 - 从文本提取题目
export const extractQuestionsFromText = (text: string): ParsedQuestion[] => {
  const cleaned = cleanText(text);
  const questions: ParsedQuestion[] = [];
  
  // 多种题目分隔模式
  const separators = [
    // 模式1: 数字编号 + 句号/顿号/括号
    /(?=\n?\d{1,3}[.、)]\s*[^\n])/,
    // 模式2: "题目" 关键词
    /(?=\n?【?题目\s*\d+【?)/i,
    // 模式3: "第X题" 模式
    /(?=\n?第\s*\d+\s*题)/,
    // 模式4: "Question" 英文
    /(?=\n?Question\s*\d+)/i,
  ];
  
  // 尝试每种分隔模式
  let blocks: string[] = [];
  
  for (const separator of separators) {
    blocks = cleaned.split(separator).filter(b => b.trim());
    if (blocks.length > 1) break;
  }
  
  // 如果没有找到明确的分隔符，按段落分割
  if (blocks.length <= 1) {
    blocks = cleaned.split(/\n\n+/).filter(b => b.trim());
  }
  
  // 解析每个块
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();
    
    // 跳过太短的块（可能是标题或说明）
    if (block.length < 10) continue;
    
    // 跳过目录、索引等非题目内容
    if (/目\s*录|索\s*引|前\s*言|附\s*录|章节|第\s*\d+\s*[章节部]/i.test(block)) {
      continue;
    }
    
    const question = parseQuestionBlock(block, i + 1);
    if (question && question.content) {
      questions.push(question);
    }
  }
  
  return questions;
};

// 将解析结果转换为完整题目
export const convertToQuestions = (parsed: ParsedQuestion[]): Question[] => {
  return parsed.map((p) => ({
    id: generateId(),
    type: p.type,
    content: p.content,
    options: p.options,
    answer: p.answer,
    explanation: p.explanation,
    tags: [],
    difficulty: p.difficulty,
    createdAt: Date.now(),
  }));
};

// 从文件内容解析题目（PDF 或 DOCX 的文本内容）
export const parseDocumentText = (text: string): Question[] => {
  const parsed = extractQuestionsFromText(text);
  return convertToQuestions(parsed);
};

// 解析 DOCX 文件
export const parseDocx = async (buffer: Buffer): Promise<string> => {
  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error('DOCX 解析失败:', error);
    throw new Error('DOCX 文件解析失败');
  }
};

// 解析 PDF 文件
export const parsePdf = async (buffer: Buffer): Promise<string> => {
  try {
    const pdfParseModule = await import('pdf-parse');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfParse = ('default' in pdfParseModule ? pdfParseModule.default : pdfParseModule) as any;
    const pdfData = await pdfParse(buffer);
    return pdfData.text;
  } catch (error) {
    console.error('PDF 解析失败:', error);
    throw new Error('PDF 文件解析失败');
  }
};

// 根据文件类型解析文档
export const parseDocument = async (
  buffer: Buffer, 
  fileType: 'pdf' | 'docx'
): Promise<Question[]> => {
  let text: string;
  
  if (fileType === 'docx') {
    text = await parseDocx(buffer);
  } else {
    text = await parsePdf(buffer);
  }
  
  return parseDocumentText(text);
};
