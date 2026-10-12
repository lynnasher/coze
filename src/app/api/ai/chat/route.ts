import { NextRequest } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

// 自定义 API 配置（通过环境变量覆盖）
const CUSTOM_API_KEY = process.env.AI_API_KEY || '';
const CUSTOM_BASE_URL = process.env.AI_API_BASE_URL || '';
const CUSTOM_MODEL = process.env.AI_MODEL || '';

// 上游请求超时 & 输出长度（防御连通性/截断问题）
const UPSTREAM_TIMEOUT_MS = 20000;
const MAX_TOKENS = 800;

// SSE 基础（不含最后一帧）响应头，规避代理缓冲导致前端迟迟收不到首帧
const SSE_HEADERS: Record<string, string> = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no',
};

export async function POST(request: NextRequest) {
  try {
    const { questionContext } = await request.json();

    if (!questionContext) {
      return Response.json({ error: '缺少题目上下文' }, { status: 400 });
    }

    // 必做：结构化四段式输出 + 官方解析锚定（抑制幻觉）
    const systemPrompt = `你是一位专业的银行/金融考试辅导老师，帮助考生真正吃透这道题。
要求：
1. 严格以题目提供的「官方解析」为准，不要编造法条、数据或不确定的信息；若你的补充超出官方解析，请以「补充:」开头标注。
2. 按以下四段结构输出，纯文本，不要使用任何 markdown 标记：
【考点】一句话点明本题考查什么。
【解题关键】2-4 句讲清思路（如有公式给出计算步骤）。
【逐项排雷】若是选择题逐项说明对错原因；若题目提供了考生的作答，重点说明考生所选为什么对/错。
【易错提醒】一句话提醒最容易踩的坑。
3. 总字数控制在 250 字以内，条理清晰、口语化。`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: `请帮我解析这道题：\n\n${questionContext}` },
    ];

    // 如果配置了自定义 API，使用自定义 API
    if (CUSTOM_API_KEY && CUSTOM_BASE_URL) {
      return await handleCustomAPI(messages);
    }

    // 否则使用内置 SDK
    return await handleBuiltinSDK(request, messages);
  } catch (error) {
    console.error('[AI Chat] Error:', error);
    return Response.json({ error: 'AI 服务暂时不可用' }, { status: 500 });
  }
}

// 允许网关更长等待（可选）
export const maxDuration = 60;

async function handleCustomAPI(messages: { role: string; content: string }[]) {
  const model = CUSTOM_MODEL || 'deepseek-chat';
  // 兼容用户填写的 base url 是否带 /v1，避免拼出 /v1/v1
  const base = CUSTOM_BASE_URL.trim().replace(/\/+$/, '');
  const url = /\/v\d+$/.test(base) ? `${base}/chat/completions` : `${base}/v1/chat/completions`;

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CUSTOM_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        max_tokens: MAX_TOKENS,
        temperature: 0.7,
      }),
      // 防挂起：上游超时直接失败
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (e) {
    console.error('[AI Chat] Custom API fetch failed:', (e as Error)?.name, (e as Error)?.message);
    return Response.json({ error: 'AI 服务连接失败或超时，请重试' }, { status: 504 });
  }

  if (!resp.ok) {
    const errText = await resp.text();
    console.error('[AI Chat] Custom API error:', resp.status, errText.slice(0, 300));
    if (resp.status === 401 || resp.status === 403) {
      return Response.json({ error: 'AI API Key 无效或已过期' }, { status: 502 });
    }
    return Response.json({ error: `AI 服务返回错误: ${resp.status}` }, { status: 502 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: Record<string, string>) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      const reader = resp.body?.getReader();
      if (!reader) {
        send({ error: 'AI 服务无响应' });
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let hasContent = false;
      let streamFailed = false;

      // 心跳注释帧，帮助尽早建立/维持长连接
      controller.enqueue(encoder.encode(': ping\n\n'));

      const handleLine = (raw: string) => {
        const line = raw.trim();
        if (!line || !line.startsWith('data:')) return;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data);
          // 兼容 reasoning 模型，推理内容与正文都作为内容下发
          const delta = parsed.choices?.[0]?.delta;
          const content = delta?.content ?? delta?.reasoning_content;
          if (content && typeof content === 'string' && content.trim()) {
            hasContent = true;
            send({ content });
          }
        } catch {
          // 跳过无法解析的行
        }
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) handleLine(line);
        }
      } catch (e) {
        // 流中断（含超时/网络断开）：若尚未产出任何内容，向前端暴露错误事件
        streamFailed = true;
        console.error('[AI Chat] Stream read error:', (e as Error)?.name, (e as Error)?.message);
        if (!hasContent) {
          if ((e as Error)?.name === 'TimeoutError') {
            send({ error: 'AI 响应超时，请重试' });
          } else {
            send({ error: 'AI 响应中断，请重试' });
          }
        }
      }

      // 兜底：flush 残留数据，保证不出 200 空流
      if (buffer) handleLine(buffer);

      if (!hasContent && !streamFailed) {
        console.error('[AI Chat] Empty response from upstream, status=', resp.status);
        send({ error: 'AI 未返回任何内容，请重试' });
      }

      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

async function handleBuiltinSDK(request: NextRequest, messages: { role: string; content: string }[]) {
  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
  const config = new Config();
  const client = new LLMClient(config, customHeaders);

  const typedMessages = messages as { role: 'user' | 'system' | 'assistant'; content: string }[];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: Record<string, string>) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      let hasContent = false;
      let errorSent = false;
      controller.enqueue(encoder.encode(': ping\n\n'));

      try {
        const chatStream = client.stream(typedMessages, {
          model: 'deepseek-v3-2-251201',
          temperature: 0.7,
        });
        for await (const chunk of chatStream) {
          if (chunk.content) {
            const text = typeof chunk.content === 'string' ? chunk.content : String(chunk.content);
            if (text.trim()) {
              hasContent = true;
              send({ content: text });
            }
          }
        }
      } catch (e) {
        console.error('[AI Chat] SDK error:', e);
        if (!hasContent) {
          send({ error: 'AI 服务暂时不可用，请重试' });
          errorSent = true;
        }
      }

      if (!hasContent && !errorSent) {
        console.error('[AI Chat] SDK empty response');
        send({ error: 'AI 未返回任何内容，请重试' });
      }

      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}