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

// 清理选项文本 - 去掉答案、解析等后缀
const cleanOptionText = (text: string): string => {
  // 去掉答案后缀，如 "xxx 答案: A" 或 "xxx 正确答案: B"
  let cleaned = text.replace(/\s*(正确答案|答案|答)[：:]\s*[A-Da-d].*$/i, '');
  // 去掉解析后缀
  cleaned = cleaned.replace(/\s*(名师解析|解析|答案解析)[：:].*$/i, '');
  return cleaned.trim();
};

// 判断是否为答案行
const isAnswerLine = (line: string): boolean => {
  const trimmed = line.trim();
  // 如果整行都是答案格式（如 "正确答案: A" 或 "答案: B"），返回true
  if (/^(正确答案|答案|答|参考答案)[：:]\s*[A-Da-d]\s*$/.test(trimmed)) {
    return true;
  }
  // 如果行末包含答案格式，前面是选项内容
  if (/\s*(正确答案|答案|答)[：:]\s*[A-Da-d]\s*$/.test(trimmed)) {
    return true;
  }
  return false;
};

// 判断是否为解析行
const isExplanationLine = (line: string): boolean => {
  const trimmed = line.trim();
  // 如果整行是解析格式
  if (/^(名师解析|解析|答案解析)[：:]/.test(trimmed)) {
    return true;
  }
  // 如果行末包含解析格式
  if (/\s*(名师解析|解析|答案解析)[：:]/.test(trimmed)) {
    return true;
  }
  return false;
};

// 从文本提取题目的解析器
export const extractQuestionsFromText = (text: string): ParsedQuestion[] => {
  const cleaned = cleanText(text);
  const questions: ParsedQuestion[] = [];

  // 按空行分割成块
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

  // 1. 提取题目内容
  let contentLines: string[] = [];
  let foundOptions = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // 如果遇到独立的答案行或解析行，停止收集题目内容
    if (/^(正确答案|答案|答|参考答案)[：:]\s*[A-Da-d]/.test(trimmed) && !line.includes('、') && !line.includes('.')) {
      foundOptions = true;
      break;
    }
    if (/^(名师解析|解析|答案解析)[：:]/.test(trimmed)) {
      break;
    }
    
    // 如果是选项行（以 A、B、C、D 开头，且有多个选项候选）
    if (/^[A-Da-d][.、:：]/.test(trimmed)) {
      foundOptions = true;
      break;
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

  // 2. 提取选项和答案
  const options: QuizOption[] = [];
  let answer = 'a';
  let explanation = '';
  let currentOption: { id: string; text: string } | null = null;
  let collectingExplanation = false;
  let explanationBuffer = '';

  for (let i = contentLines.length; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 开始收集解析
    if (/^(名师解析|解析|答案解析)[：:]/.test(trimmed)) {
      collectingExplanation = true;
      const match = trimmed.match(/^(名师解析|解析|答案解析)[：:]\s*(.+)/i);
      if (match) {
        explanation = match[2].trim();
      }
      continue;
    }
    
    // 继续收集解析内容
    if (collectingExplanation) {
      explanation += ' ' + trimmed;
      continue;
    }

    // 检查是否是答案行（独立的答案行，如 "正确答案: A"）
    const answerMatch = trimmed.match(/^(正确答案|答案|答|参考答案)[：:]\s*([A-Da-d])\s*$/i);
    if (answerMatch) {
      answer = answerMatch[2].toLowerCase();
      // 保存当前选项
      if (currentOption && currentOption.text) {
        options.push({ id: currentOption.id, text: cleanOptionText(currentOption.text) });
      }
      continue;
    }

    // 检查是否是选项行
    const optionMatch = trimmed.match(/^([A-Da-d])[.、:：]\s*(.*)$/);
    if (optionMatch) {
      // 保存之前的选项
      if (currentOption && currentOption.text) {
        options.push({ id: currentOption.id, text: cleanOptionText(currentOption.text) });
      }
      currentOption = { id: optionMatch[1].toLowerCase(), text: optionMatch[2] };
      
      // 检查选项后面是否有答案（如 "A、xxx 答案: B"）
      const answerInOption = currentOption.text.match(/\s*(正确答案|答案|答)[：:]\s*([A-Da-d])\s*$/i);
      if (answerInOption) {
        // 去掉答案部分
        currentOption.text = currentOption.text.replace(/\s*(正确答案|答案|答)[：:]\s*[A-Da-d]\s*$/i, '').trim();
        answer = answerInOption[2].toLowerCase();
      }
      continue;
    }

    // 继续收集当前选项内容
    if (currentOption) {
      // 检查这一行是否包含答案格式
      const inlineAnswerMatch = trimmed.match(/\s*(正确答案|答案|答)[：:]\s*([A-Da-d])\s*$/i);
      if (inlineAnswerMatch) {
        // 去掉答案部分，只保留选项内容
        currentOption.text += ' ' + trimmed.replace(/\s*(正确答案|答案|答)[：:]\s*[A-Da-d]\s*$/i, '').trim();
        answer = inlineAnswerMatch[2].toLowerCase();
      } else {
        currentOption.text += ' ' + trimmed;
      }
    }
  }

  // 保存最后一个选项
  if (currentOption && currentOption.text) {
    options.push({ id: currentOption.id, text: cleanOptionText(currentOption.text) });
  }

  // 清理解析
  explanation = explanation.replace(/\s+/g, ' ').trim();

  // 3. 识别题目类型
  const type = identifyQuestionType(content, options);

  // 4. 判断题答案转换
  if (type === 'true-false') {
    answer = 'true';
  }

  // 5. 识别难度
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
