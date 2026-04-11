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
    .replace(/\t/g, ' ')
    .replace(/\u3000/g, ' ') // 全角空格
    .trim();
};

// 判断是否为选项行
const isOptionLine = (line: string): boolean => {
  // 匹配常见的选项格式: A、B、C、D 开头
  // 支持: A. B. A、 B、 A: B: 等格式
  return /^[A-Da-d][.、:：\s]/.test(line.trim());
};

// 判断是否为答案行
const isAnswerLine = (line: string): boolean => {
  return /^(正确答案|答案|答|参考答案)[：:]/.test(line.trim());
};

// 判断是否为解析行
const isExplanationLine = (line: string): boolean => {
  return /^(名师解析|解析|答案解析)[：:]/.test(line.trim());
};

// 从文本提取题目的解析器 - 银行题库格式
export const extractQuestionsFromText = (text: string): ParsedQuestion[] => {
  const cleaned = cleanText(text);
  const questions: ParsedQuestion[] = [];

  // 1. 先将文本按空行分割成块
  const blocks = cleaned.split(/\n\s*\n/).filter(b => b.trim());

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const question = parseQuestionBlock(trimmed);
    if (question) {
      questions.push(question);
    }
  }

  // 如果按空行分割没找到题目，尝试按编号分割
  if (questions.length === 0) {
    const lines = cleaned.split('\n');
    let currentBlock = '';
    const questionBlocks: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // 检测新题目开始：数字编号开头
      if (/^\d+[.、)]\s*\S/.test(trimmed)) {
        if (currentBlock.trim()) {
          questionBlocks.push(currentBlock.trim());
        }
        currentBlock = trimmed;
      } else if (currentBlock) {
        currentBlock += '\n' + trimmed;
      }
    }

    // 添加最后一块
    if (currentBlock.trim()) {
      questionBlocks.push(currentBlock.trim());
    }

    for (const block of questionBlocks) {
      const question = parseQuestionBlock(block);
      if (question) {
        questions.push(question);
      }
    }
  }

  return questions;
};

// 解析单个题目块
const parseQuestionBlock = (block: string): ParsedQuestion | null => {
  const lines = block.split('\n').map(l => l.trim()).filter(l => l);
  if (lines.length < 2) return null;

  // 跳过标题行
  const skipPatterns = [
    /^目\s*录/, /^索\s*引/, /^前\s*言/, /^附\s*录/,
    /^第.*章$/, /^第.*部分$/, /^练习题$/, /^测试题$/,
    /^题\s*目/, /^单\s*选/, /^多\s*选/, /^判\s*断/
  ];
  
  if (skipPatterns.some(p => p.test(lines[0]))) {
    return null;
  }

  // 1. 提取题目内容 - 从第一行开始收集，直到遇到选项
  const contentLines: string[] = [];
  let contentComplete = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 如果遇到选项，停止收集题目内容
    if (isOptionLine(line) || isAnswerLine(line) || isExplanationLine(line)) {
      contentComplete = true;
      break;
    }
    
    // 检查这一行是否同时包含选项信息（选项和题目内容混在一起）
    const mixedContent = line.match(/^([A-Da-d])[.、:：]\s*(.+)/);
    if (mixedContent) {
      // 这是一个混合行：D 发展时期 答案: A
      // 提取字母部分作为选项，内容作为题目
      contentLines.push(mixedContent[2]);
      contentComplete = true;
      break;
    }
    
    // 检查是否只有单个字母选项（跨行选项）
    if (/^[A-Da-d]$/.test(line)) {
      // 这是一个单独的字母，可能与下一行合并
      // 继续收集下一行作为选项内容
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        // 检查下一行是否是答案或解析
        if (isAnswerLine(nextLine) || isExplanationLine(nextLine)) {
          // 单独的字母可能就是答案的一部分
          contentLines.push(line);
        } else {
          // 下一行是选项内容
          contentLines.push(line);
          contentComplete = true;
        }
      }
      continue;
    }
    
    contentLines.push(line);
  }

  // 构建题目内容
  let content = contentLines.join(' ').trim();
  
  // 去掉开头的编号
  content = content.replace(/^\d+[.、)]\s*/, '').trim();
  
  if (!content || content.length < 5) {
    return null;
  }

  // 2. 提取选项 - 从识别到的选项行开始
  const options: QuizOption[] = [];
  let optionBuffer = { id: '', text: '' };
  
  for (let i = contentLines.length; i < lines.length; i++) {
    const line = lines[i];
    
    // 遇到答案或解析行，停止收集选项
    if (isAnswerLine(line) || isExplanationLine(line)) {
      // 保存当前缓冲的选项
      if (optionBuffer.id && optionBuffer.text) {
        options.push({ id: optionBuffer.id, text: optionBuffer.text.trim() });
      }
      break;
    }
    
    // 检查是否是混合行（选项 + 内容混在一起）
    const mixedLine = line.match(/^([A-Da-d])[.、:：]\s*(.+)/);
    if (mixedLine) {
      // 保存之前的选项
      if (optionBuffer.id && optionBuffer.text) {
        options.push({ id: optionBuffer.id, text: optionBuffer.text.trim() });
      }
      // 开始新选项
      optionBuffer = { id: mixedLine[1].toLowerCase(), text: mixedLine[2] };
      continue;
    }
    
    // 检查是否是纯选项字母
    if (/^[A-Da-d]$/.test(line)) {
      // 保存之前的选项
      if (optionBuffer.id && optionBuffer.text) {
        options.push({ id: optionBuffer.id, text: optionBuffer.text.trim() });
      }
      optionBuffer = { id: line.toLowerCase(), text: '' };
      continue;
    }
    
    // 其他行，可能是选项内容的延续
    if (optionBuffer.id) {
      optionBuffer.text += ' ' + line;
    }
  }
  
  // 保存最后一个选项
  if (optionBuffer.id && optionBuffer.text) {
    options.push({ id: optionBuffer.id, text: optionBuffer.text.trim() });
  }

  // 3. 提取答案
  let answer = 'a';
  const answerPatterns = [
    /正确答案[：:]\s*([A-Da-d])/i,
    /答案[：:]\s*([A-Da-d])/i,
    /答[：:]\s*([A-Da-d])/i,
    /^([A-Da-d])$/,
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
  for (const line of lines) {
    const match = line.match(/^(名师解析|解析|答案解析)[：:]\s*(.+)/i);
    if (match) {
      explanation = match[2].trim();
      break;
    }
  }

  // 5. 识别题目类型
  const type = identifyQuestionType(content, options);

  // 6. 判断题答案转换
  if (type === 'true-false') {
    answer = options.length > 0 ? 'true' : 'true';
  }

  // 7. 识别难度
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
