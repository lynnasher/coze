import { NextRequest } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

// 自定义 API 配置（通过环境变量覆盖）
const CUSTOM_API_KEY = process.env.AI_API_KEY || '';
const CUSTOM_BASE_URL = process.env.AI_API_BASE_URL || '';
const CUSTOM_MODEL = process.env.AI_MODEL || '';

export async function POST(request: NextRequest) {
  try {
    const { questionContext } = await request.json();

    if (!questionContext) {
      return Response.json({ error: '缺少题目上下文' }, { status: 400 });
    }

    const systemPrompt = `你是一位专业的考试辅导老师。请用简洁明了的语言解释这道题。
要求：
1. 先一句话总结考点
2. 用通俗易懂的方式解释解题思路（2-4句话）
3. 如果涉及公式，给出关键计算步骤
4. 总字数控制在150字以内
5. 不要使用markdown格式，用纯文本`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: `请帮我解析这道题：\n\n${questionContext}` },
    ];

    // 如果配置了自定义 API，使用自定义 API
    if (CUSTOM_API_KEY && CUSTOM_BASE_URL) {
      return handleCustomAPI(messages);
    }

    // 否则使用内置 SDK
    return handleBuiltinSDK(request, messages);
  } catch (error) {
    console.error('[AI Chat] Error:', error);
    return Response.json({ error: 'AI 服务暂时不可用' }, { status: 500 });
  }
}

async function handleCustomAPI(messages: { role: string; content: string }[]) {
  const model = CUSTOM_MODEL || 'gpt-3.5-turbo';
  const url = `${CUSTOM_BASE_URL}/v1/chat/completions`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CUSTOM_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      max_tokens: 300,
      temperature: 0.7,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error('[AI Chat] Custom API error:', resp.status, errText);
    return Response.json({ error: `AI 服务返回错误: ${resp.status}` }, { status: 502 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = resp.body?.getReader();
      if (!reader) {
        controller.close();
        return;
      }
      const decoder = new TextDecoder();
      let buffer = '';
      try {
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
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
              }
            } catch {
              // 跳过无法解析的行
            }
          }
        }
      } catch (e) {
        console.error('[AI Chat] Stream read error:', e);
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

async function handleBuiltinSDK(request: NextRequest, messages: { role: string; content: string }[]) {
  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
  const config = new Config();
  const client = new LLMClient(config, customHeaders);

  const typedMessages = messages as { role: 'user' | 'system' | 'assistant'; content: string }[];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const chatStream = client.stream(typedMessages, {
          model: 'deepseek-v3-2-251201',
          temperature: 0.7,
        });
        for await (const chunk of chatStream) {
          if (chunk.content) {
            const text = typeof chunk.content === 'string' ? chunk.content : String(chunk.content);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: text })}\n\n`));
          }
        }
      } catch (e) {
        console.error('[AI Chat] SDK error:', e);
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
