import { Question, QuestionType, Difficulty, QuizOption } from './types';
import { generateId } from './quiz-store';

// 银行题库格式专用解析器
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
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

// 从文本提取题目的解析器 - 银行题库格式
export const extractQuestionsFromText = (text: string): ParsedQuestion[] => {
  const cleaned = cleanText(text);
  const questions: ParsedQuestion[] = [];

  // 按题目分隔：匹配纯数字开头的行（题目编号）
  // 格式: "1假设某银行..." 或 "1、一般来说..."
  const questionBlocks = cleaned.split(/(?=^\d+[^\d])/m);

  for (const block of questionBlocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // 跳过标题、非题目内容
    if (/^[^\d]/.test(trimmed)) continue;
    if (/目\s*录|索\s*引|前\s*言|附\s*录|^第.*章|^第.*部分/i.test(trimmed)) continue;
    if (trimmed.length < 20) continue;

    const question = parseQuestionBlock(trimmed);
    if (question) {
      questions.push(question);
    }
  }

  return questions;
};

// 解析单个题目块
const parseQuestionBlock = (block: string): ParsedQuestion | null => {
  const lines = block.split('\n').map(l => l.trim()).filter(l => l);
  if (lines.length < 2) return null;

  // 1. 提取题目内容（第一行，去掉开头的编号）
  let content = lines[0].replace(/^\d+[.、)]\s*/, '').trim();
  if (!content) return null;

  // 2. 提取选项
  const options: QuizOption[] = [];
  let currentOption = '';
  let currentOptionId = '';

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    // 匹配选项开始: A、B、C、D (可能带有各种分隔符)
    const optionMatch = line.match(/^([A-Da-d])[.、:、]\s*(.+)/);
    if (optionMatch) {
      // 保存上一个选项
      if (currentOptionId && currentOption) {
        options.push({ id: currentOptionId, text: currentOption });
      }
      currentOptionId = optionMatch[1].toLowerCase();
      currentOption = optionMatch[2];
    } else if (currentOptionId) {
      // 继续收集选项内容（选项内容可能跨行）
      currentOption += ' ' + line;
    }

    // 如果遇到"正确答案"或"名师解析"，停止收集选项
    if (/^(正确答案|名师解析|答[案]?[:：])/i.test(line)) {
      break;
    }
  }

  // 保存最后一个选项
  if (currentOptionId && currentOption) {
    options.push({ id: currentOptionId, text: currentOption });
  }

  // 3. 提取答案
  let answer = 'a';
  const answerPatterns = [
    /正确答案[：:]\s*([A-Da-d])/i,
    /答案[：:]\s*([A-Da-d])/i,
    /答[案]?[：:]\s*([A-Da-d])/i,
  ];

  for (const line of lines) {
    for (const pattern of answerPatterns) {
      const match = line.match(pattern);
      if (match) {
        answer = match[1].toLowerCase();
        break;
      }
    }
    if (answer !== 'a') break;
  }

  // 4. 提取解析
  let explanation = '';
  const explanationPatterns = [
    /名师解析[：:]\s*([\s\S]+?)(?=^\d+[^\d]|$)/m,
    /解析[：:]\s*([\s\S]+?)(?=^\d+[^\d]|$)/m,
  ];

  // 合并所有行来匹配解析
  const fullText = lines.join('\n');
  for (const pattern of explanationPatterns) {
    const match = fullText.match(pattern);
    if (match) {
      explanation = match[1].trim();
      break;
    }
  }

  // 5. 识别题目类型
  const type = identifyQuestionType(content, options);

  // 6. 判断题答案转换
  if (type === 'true-false') {
    // 判断题默认假设选项0是正确
    answer = options.length > 0 ? 'true' : 'true';
  }

  // 7. 识别难度（根据关键词）
  const difficulty = identifyDifficulty(content);

  return {
    type,
    content,
    options: options.length > 0 ? options : undefined,
    answer,
    explanation: explanation || undefined,
    difficulty,
  };
};

// 识别题目类型
const identifyQuestionType = (content: string, options: QuizOption[]): QuestionType => {
  const lowerContent = content.toLowerCase();

  // 判断题特征：只有两个选项，且内容包含判断相关词汇
  if (options.length === 2) {
    const optionTexts = options.map(o => o.text.toLowerCase());
    if (
      optionTexts.some(t => /正确|对|是|true|yes|√/.test(t)) ||
      optionTexts.some(t => /错误|错|否|false|no|×/.test(t))
    ) {
      return 'true-false';
    }
  }

  // 多选题特征
  if (/多选|哪些|选出|选择.*以下|以下.*正确|下列.*正确的/i.test(lowerContent)) {
    return 'multiple';
  }

  // 填空题特征
  if (/填空|填写|补全|完成句子/i.test(lowerContent)) {
    return 'fill-blank';
  }

  // 默认单选题
  return 'single';
};

// 识别难度
const identifyDifficulty = (content: string): Difficulty => {
  const lowerContent = content.toLowerCase();
  if (/困难|很难|hard|难点|复杂/i.test(lowerContent)) {
    return 'hard';
  }
  if (/简单|容易|easy|基础|基本/i.test(lowerContent)) {
    return 'easy';
  }
  return 'medium';
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

// 从文件内容解析题目
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
