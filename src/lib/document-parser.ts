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
    .replace(/\u3000/g, ' ')
    .trim();
};

// 清理选项文本 - 去掉答案、解析等后缀
const cleanOptionText = (text: string): string => {
  // 去掉答案后缀
  let cleaned = text.replace(/\s*(正确答案|答案|答)[：:]\s*[A-Da-d].*$/i, '');
  // 去掉解析后缀
  cleaned = cleaned.replace(/\s*(名师解析|解析|答案解析)[：:].*$/i, '');
  return cleaned.trim();
};

// 识别题目类型标记（支持编号后的标记，如 "1. [单选]"）
const extractTypeTag = (text: string): { content: string; type: QuestionType | null } => {
  // 匹配编号后的类型标记，如 "1. [单选]" 或 "1、单选"
  const match = text.match(/^\d+[.、)]\s*\[?(单选|多选|判断|填空|单选題|多选題|判断題|填空題)\]?\s*/i);
  if (match) {
    const tag = match[1].toLowerCase();
    let type: QuestionType | null = null;
    if (/单选/.test(tag)) type = 'single';
    else if (/多选/.test(tag)) type = 'multiple';
    else if (/判断/.test(tag)) type = 'true-false';
    else if (/填空/.test(tag)) type = 'fill-blank';
    
    return {
      content: text.slice(match[0].length),
      type
    };
  }
  
  // 匹配行首的类型标记，如 "[单选] 题目内容"
  const matchStart = text.match(/^\[?(单选|多选|判断|填空|单选題|多选題|判断題|填空題)\]?\s*/i);
  if (matchStart) {
    const tag = matchStart[1].toLowerCase();
    let type: QuestionType | null = null;
    if (/单选/.test(tag)) type = 'single';
    else if (/多选/.test(tag)) type = 'multiple';
    else if (/判断/.test(tag)) type = 'true-false';
    else if (/填空/.test(tag)) type = 'fill-blank';
    
    return {
      content: text.slice(matchStart[0].length),
      type
    };
  }
  
  return { content: text, type: null };
};

// 从文本提取题目的解析器
export const extractQuestionsFromText = (text: string): ParsedQuestion[] => {
  const cleaned = cleanText(text);
  const questions: ParsedQuestion[] = [];

  // 先尝试拆分综合题中的小题
  const blocks = splitComprehensiveQuestions(cleaned);
  
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
      if (/^\d+[.、)]\s*\S/.test(trimmed) || /^\[?(单选|多选|判断|填空)/.test(trimmed)) {
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

// 拆分综合题中的小题（如 "（1）"、"(1)"、"①" 等格式）
const splitComprehensiveQuestions = (text: string): string[] => {
  // 检测是否包含综合题标记（注意：综合案例题 包含"案例"不包含"综合题"）
  const isComprehensive = /综合[题案例]|案例[分析题]|计算题|论述题|简答题|分析题/i.test(text);
  
  if (!isComprehensive) {
    // 非综合题，按空行分割
    return text.split(/\n\s*\n/).filter(b => b.trim());
  }
  
  // 综合题处理：按小题编号拆分
  const lines = text.split('\n');
  const blocks: string[] = [];
  let currentBlock: string[] = [];
  let mainTitle = ''; // 保留大题标题（案例描述）
  let foundMainTitle = false;
  let caseDescription: string[] = []; // 存储案例描述
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // 检测大题标题（包含综合题字样，如 "114. 【综合案例题】"）
    if (!foundMainTitle && /^\d+[.、)]\s*【?综合题|案例分析|计算题|论述题|简答题|分析题/i.test(trimmed)) {
      mainTitle = trimmed;
      foundMainTitle = true;
      continue;
    }
    
    // 检测小题开始：支持多种格式
    // (1), （1）, (一), ①, 1. 等
    const isSubQuestionStart = 
      /^[（\(]\d+[）\)]/.test(trimmed) ||           // (1) （1）
      /^[（\(][一二三四五六七八九十]+[）\)]/.test(trimmed) || // (一)
      /^[①-⑨]/.test(trimmed) ||                      // ①②③
      /^\d+[.、]\s*[（\(]?\d/.test(trimmed);          // 1. (1) 或 1.1
    
    // 如果遇到新的小题编号
    if (isSubQuestionStart && foundMainTitle) {
      // 保存之前的block
      if (currentBlock.length > 0) {
        blocks.push(currentBlock.join('\n'));
      }
      
      // 重新构建：包含大题标题、案例描述、小题内容
      const prefix = [mainTitle, ...caseDescription].filter(Boolean).join(' ');
      currentBlock = [prefix + ' ' + trimmed];
      
      // 小题编号后的第一行可能是题目内容，继续收集
      // 清空案例描述（后续小题不再重复）
      caseDescription = [];
    } 
    // 如果还没有找到小题（收集案例描述部分）
    else if (foundMainTitle && !isSubQuestionStart && trimmed && !/^[A-Za-z][.、:]/.test(trimmed)) {
      // 这是案例描述的一部分
      if (currentBlock.length === 0) {
        caseDescription.push(trimmed);
      } else {
        // 继续收集当前小题的内容
        currentBlock.push(trimmed);
      }
    }
    // 选项或其他内容
    else if (currentBlock.length > 0) {
      currentBlock.push(trimmed);
    }
  }
  
  // 保存最后一个小题
  if (currentBlock.length > 0) {
    blocks.push(currentBlock.join('\n'));
  }
  
  // 如果拆分成功且有多个小题，返回拆分结果
  if (blocks.length > 1) {
    return blocks;
  }
  
  // 如果只有一个小题或没有拆分，按空行分割
  return text.split(/\n\s*\n/).filter(b => b.trim());
};

// 解析单个题目块
const parseQuestionBlock = (block: string): ParsedQuestion | null => {
  // 先按行分割
  const rawLines = block.split('\n');
  const lines = rawLines.map(l => l.trim()).filter(l => l);
  
  if (lines.length < 2) return null;

  // 跳过标题行
  const skipPatterns = [
    /^目\s*录/, /^索\s*引/, /^前\s*言/, /^附\s*录/,
    /^第.*章$/, /^第.*部分$/, /^练习题$/, /^测试题$/,
    /^题\s*目/
  ];
  
  // 找到内容开始的第一行（可能是题目行）
  let startIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!skipPatterns.some(p => p.test(lines[i]))) {
      startIndex = i;
      break;
    }
  }

  // 2. 提取题目内容 - 从找到的起始行开始
  const contentLines: string[] = [];
  let foundOption = false;
  let explicitType: QuestionType | null = null;
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // 检查是否包含类型标记
    const typeResult = extractTypeTag(trimmed);
    if (typeResult.type) {
      explicitType = typeResult.type;
      if (typeResult.content) {
        contentLines.push(typeResult.content);
      }
      continue;
    }
    
    // 如果遇到选项行，停止收集题目内容（支持 A-Z）
    if (/^[A-Za-z][.、:：]/.test(trimmed)) {
      foundOption = true;
      break;
    }
    
    // 如果遇到答案或解析行，停止
    if (/^(正确答案|答案|答|名师解析|解析)[：:]/.test(trimmed)) {
      break;
    }
    
    // 如果是纯字母选项（如只有 "C"），可能是选项的一部分
    if (/^[A-Za-z]$/.test(trimmed) && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      if (/^[A-Za-z][.、:：]/.test(nextLine)) {
        continue; // 跳过单独的字母
      }
    }
    
    contentLines.push(trimmed);
  }

  // 构建题目内容
  let content = contentLines.join(' ').trim();
  // 去掉开头的编号（如 "1." 或 "1、"）
  content = content.replace(/^\d+[.、)]\s*/, '').trim();
  
  if (!content || content.length < 5) {
    return null;
  }

  // 3. 提取选项
  const options: QuizOption[] = [];
  let answer: string | string[] = 'a';
  let explanation = '';
  let currentOption: { id: string; text: string } | null = null;
  let inExplanation = false;
  
  // 辅助函数：添加选项到数组
  const addOption = (opt: { id: string; text: string }) => {
    const cleanedText = cleanOptionText(opt.text);
    if (!cleanedText) return;
    
    // 检查是否已有相同 id 的选项
    const existingIndex = options.findIndex(o => o.id === opt.id);
    if (existingIndex >= 0) {
      // 合并文本（保留更长的版本）
      if (cleanedText.length > options[existingIndex].text.length) {
        options[existingIndex].text = cleanedText;
      }
    } else {
      options.push({ id: opt.id, text: cleanedText });
    }
  };
  
  // 选项收集的起始索引
  const optionStartIndex = contentLines.length + startIndex;

  for (let i = optionStartIndex; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 解析开始
    if (/^(名师解析|解析|答案解析)[：:]/.test(trimmed)) {
      inExplanation = true;
      const match = trimmed.match(/^(名师解析|解析|答案解析)[：:]\s*(.+)/i);
      if (match) {
        explanation = match[2].trim();
      }
      continue;
    }
    
    // 继续收集解析
    if (inExplanation) {
      explanation += ' ' + trimmed;
      continue;
    }

    // 独立的答案行（支持多选答案如 "DE"、"ABD"）
    const pureAnswerMatch = trimmed.match(/^(正确答案|答案|答|参考答案)[：:]\s*([A-Za-z,，\s]+)\s*$/i);
    if (pureAnswerMatch) {
      const answerStr = pureAnswerMatch[2].toLowerCase();
      // 解析多选题答案（可能是 "A,B,C" 或 "ABC" 或 "A B C"）
      const answerLetters = answerStr.replace(/[,，\s]/g, '').split('').filter(Boolean);
      answer = answerLetters.length > 1 ? answerLetters : answerLetters[0] || 'a';
      // 保存当前选项
      if (currentOption && currentOption.text) {
        addOption(currentOption);
        currentOption = null;
      }
      continue;
    }

    // 选项行（支持 A-Z）
    const optionMatch = trimmed.match(/^([A-Za-z])[.、:：]\s*(.*)$/);
    if (optionMatch) {
      // 保存之前的选项
      if (currentOption && currentOption.text) {
        addOption(currentOption);
      }
      currentOption = { id: optionMatch[1].toLowerCase(), text: optionMatch[2] };
      
      // 检查选项内是否包含答案（支持多选）
      const inlineAnswerMatch = currentOption.text.match(/\s*(正确答案|答案|答)[：:]\s*([A-Za-z,，\s]+)\s*$/i);
      if (inlineAnswerMatch) {
        currentOption.text = currentOption.text.replace(/\s*(正确答案|答案|答)[：:]\s*[A-Za-z,，\s]+\s*$/i, '').trim();
        const answerStr = inlineAnswerMatch[2].toLowerCase();
        const answerLetters = answerStr.replace(/[,，\s]/g, '').split('').filter(Boolean);
        answer = answerLetters.length > 1 ? answerLetters : answerLetters[0] || 'a';
      }
      continue;
    }

    // 继续收集当前选项内容（可能是跨行的选项内容）
    if (currentOption) {
      // 检查行末是否有答案格式（支持多选）
      const endAnswerMatch = trimmed.match(/(.*?)\s*(正确答案|答案|答)[：:]\s*([A-Za-z,，\s]+)\s*$/i);
      if (endAnswerMatch) {
        currentOption.text += ' ' + endAnswerMatch[1].trim();
        const answerStr = endAnswerMatch[3].toLowerCase();
        const answerLetters = answerStr.replace(/[,，\s]/g, '').split('').filter(Boolean);
        answer = answerLetters.length > 1 ? answerLetters : answerLetters[0] || 'a';
      } else {
        currentOption.text += ' ' + trimmed;
      }
    }
  }

  // 保存最后一个选项
  if (currentOption && currentOption.text) {
    addOption(currentOption);
  }

  // 清理解析
  explanation = explanation.replace(/\s+/g, ' ').trim();

  // 4. 识别题目类型
  let type = identifyQuestionType(content, options);
  // 如果有明确的类型标记，优先使用
  if (explicitType) {
    type = explicitType;
  }

  // 5. 判断题答案转换（保持原有答案格式，'a' 表示正确，'b' 表示错误）
  // 如果没有识别到答案，默认设为 'a'（正确）
  if (type === 'true-false' && !answer) {
    answer = 'a';
  }

  // 6. 识别难度
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

  // 判断题特征
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
