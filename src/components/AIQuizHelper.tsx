'use client';

import { useState, useCallback } from 'react';

interface Question {
  type: string;
  content: string;
  options?: { id: string; text: string }[];
  answer?: string | string[];
  explanation?: string;
  caseBackground?: string;
  caseContext?: string;
  children?: Question[];
}

interface AIQuizHelperProps {
  question: Question;
}

function buildQuestionContext(q: Question): string {
  const parts: string[] = [];
  const typeLabels: Record<string, string> = {
    'single': '单选题',
    'multiple': '多选题',
    'uncertain-choice': '不定项选择题',
    'true-false': '判断题',
    'fill-blank': '填空题',
    'comprehensive': '综合案例题',
  };
  parts.push(`题型：${typeLabels[q.type] || q.type}`);

  if (q.caseBackground) parts.push(`案例背景：${q.caseBackground}`);
  if (q.caseContext) parts.push(`案例材料：${q.caseContext}`);

  parts.push(`题目：${q.content}`);

  if (q.options && q.options.length > 0) {
    parts.push('选项：');
    q.options.forEach(opt => parts.push(`${opt.id}. ${opt.text}`));
  }

  if (q.answer) {
    const answerStr = Array.isArray(q.answer) ? q.answer.join(', ') : q.answer;
    parts.push(`正确答案：${answerStr}`);
  }

  if (q.explanation) {
    parts.push(`官方解析：${q.explanation}`);
  }

  return parts.join('\n');
}

export default function AIQuizHelper({ question }: AIQuizHelperProps) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnswer, setAiAnswer] = useState('');

  const handleAskAI = useCallback(async () => {
    if (!question || aiLoading) return;
    setAiLoading(true);
    setAiAnswer('');
    try {
      const ctx = buildQuestionContext(question);
      const resp = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionContext: ctx }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        setAiAnswer(err.error || 'AI 服务暂时不可用');
        setAiLoading(false);
        return;
      }
      const reader = resp.body?.getReader();
      if (!reader) {
        setAiAnswer('无法读取 AI 响应');
        setAiLoading(false);
        return;
      }
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              setAiAnswer(prev => prev + parsed.content);
            }
          } catch { /* skip unparseable */ }
        }
      }
    } catch {
      setAiAnswer('AI 服务请求失败，请稍后重试');
    }
    setAiLoading(false);
  }, [question, aiLoading]);

  return (
    <div className="space-y-2 mt-3">
      <button
        onClick={handleAskAI}
        disabled={aiLoading}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-purple-200 bg-purple-50/80 hover:bg-purple-100 text-purple-600 font-medium text-sm transition-colors disabled:opacity-60"
      >
        {aiLoading ? (
          <>
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round"/>
            </svg>
            <span>AI 思考中...</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a4 4 0 0 1 4 4v1h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2V6a4 4 0 0 1 4-4z"/>
              <circle cx="12" cy="13" r="1.5"/>
              <path d="M10 10.5c.5-1 1.5-1.5 2.5-1.5s2 .5 2.5 1.5"/>
            </svg>
            <span>AI 答疑 · 不懂就问</span>
          </>
        )}
      </button>

      {aiAnswer && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a4 4 0 0 1 4 4v1h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2V6a4 4 0 0 1 4-4z"/>
              <circle cx="12" cy="13" r="1.5"/>
              <path d="M10 10.5c.5-1 1.5-1.5 2.5-1.5s2 .5 2.5 1.5"/>
            </svg>
            <span className="text-sm font-semibold text-purple-700">AI 答疑</span>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{aiAnswer}</p>
        </div>
      )}
    </div>
  );
}