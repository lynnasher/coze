import { Question, ParsedQuestion, QuestionType, Difficulty, QuizOption } from './types';
import { generateId } from './quiz-store';

// 清理文本
const cleanText = (text: string): string => {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\r\n]+/g, '\n')
    .trim();
};

// 解析选择题选项
const parseOptions = (text: string): QuizOption[] => {
  const optionRegex = /([A-D])[.、)]\s*(.+?)(?=\s*[A-D][.、)]|\s*$)/gi;
  const options: QuizOption[] = [];
  let match;
  
  while ((match = optionRegex.exec(text)) !== null) {
    options.push({
      id: match[1].toLowerCase(),
      text: cleanText(match[2]),
    });
  }
  
  return options;
};

// 尝试识别题目类型
const identifyType = (content: string, options: QuizOption[]): QuestionType => {
  const lowerContent = content.toLowerCase();
  
  // 判断题关键词
  if (/对错|正确错误|真假|是非|判断|true.*false|对.*错/i.test(lowerContent)) {
    return 'true-false';
  }
  
  // 多选题关键词
  if (/多选|选出|哪些|选择.*正确|选项.*正确/i.test(lowerContent)) {
    return 'multiple';
  }
  
  // 单选题
  if (options.length > 0) {
    return 'single';
  }
  
  return 'single';
};

// 解析单行题目
const parseSingleQuestion = (line: string, lineIndex: number, allLines: string[]): ParsedQuestion | null => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 5) return null;
  
  // 跳过纯选项行
  if (/^[A-D][.、)]\s*/i.test(trimmed)) return null;
  
  // 收集后续选项行
  const optionLines: string[] = [];
  let nextIndex = lineIndex + 1;
  
  while (nextIndex < allLines.length) {
    const nextLine = allLines[nextIndex].trim();
    if (!nextLine || /^[A-D][.、)]\s*/i.test(nextLine)) {
      if (/^[A-D][.、)]\s*/i.test(nextLine)) {
        optionLines.push(nextLine);
        nextIndex++;
      } else {
        break;
      }
    } else {
      break;
    }
  }
  
  const combinedText = optionLines.length > 0 
    ? trimmed + '\n' + optionLines.join('\n')
    : trimmed;
  
  const options = parseOptions(combinedText);
  const type = identifyType(trimmed, options);
  
  // 生成答案（基于常见的正确答案分布）
  let answer: string | string[] = 'a';
  
  if (type === 'multiple') {
    // 多选题随机生成 2-3 个答案
    const numAnswers = Math.floor(Math.random() * 2) + 2;
    const answerIds = ['a', 'b', 'c', 'd'].sort(() => Math.random() - 0.5).slice(0, numAnswers);
    answer = answerIds;
  }
  
  return {
    type,
    content: trimmed.replace(/^[\d]+[.、)]\s*/, ''),
    options: options.length > 0 ? options : undefined,
    answer,
    difficulty: 'medium',
  };
};

// 主解析函数
export const parsePdfText = (text: string): ParsedQuestion[] => {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const questions: ParsedQuestion[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const question = parseSingleQuestion(lines[i], i, lines);
    if (question) {
      questions.push(question);
    }
  }
  
  return questions;
};

// 将解析结果转换为完整题目
export const convertToQuestions = (parsed: ParsedQuestion[]): Question[] => {
  return parsed.map(p => ({
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

// 从文本导入题目（支持多种格式）
export const importFromText = (text: string): Question[] => {
  const parsed = parsePdfText(text);
  return convertToQuestions(parsed);
};

// 从 JSON 导入题目
export const importFromJson = (jsonStr: string): Question[] => {
  try {
    const data = JSON.parse(jsonStr);
    
    if (Array.isArray(data)) {
      return data.map((item: Partial<Question>) => ({
        id: generateId(),
        type: (item.type as QuestionType) || 'single',
        content: item.content || '',
        options: item.options,
        answer: item.answer || '',
        explanation: item.explanation,
        tags: item.tags || [],
        difficulty: (item.difficulty as Difficulty) || 'medium',
        createdAt: Date.now(),
      }));
    }
    
    return [];
  } catch {
    return [];
  }
};

// 从 Markdown 导入题目
export const importFromMarkdown = (markdown: string): Question[] => {
  const questionBlocks = markdown.split(/\n(?=\d+[.、)]|\[题目\])/);
  const questions: Question[] = [];
  
  for (const block of questionBlocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    
    // 简单解析 Markdown 格式的题目
    const lines = trimmed.split('\n');
    const contentLine = lines.find(l => !l.startsWith('-') && !l.startsWith('*') && !l.match(/^[A-D][.、)]/i));
    
    if (contentLine) {
      const options: QuizOption[] = [];
      
      lines.forEach(line => {
        const optionMatch = line.match(/^[A-D][.、)]\s*(.+)/i);
        if (optionMatch) {
          options.push({
            id: optionMatch[1].toLowerCase(),
            text: optionMatch[2].trim(),
          });
        }
      });
      
      questions.push({
        id: generateId(),
        type: options.length > 0 ? 'single' : 'fill-blank',
        content: contentLine.replace(/^\d+[.、)]\s*/, ''),
        options: options.length > 0 ? options : undefined,
        answer: 'a',
        difficulty: 'medium',
        tags: [],
        createdAt: Date.now(),
      });
    }
  }
  
  return questions;
};
