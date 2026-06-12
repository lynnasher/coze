import { NextRequest } from "next/server";
import { LLMClient, Config, HeaderUtils } from "coze-coding-dev-sdk";
import type { Message } from "coze-coding-dev-sdk";

const SYSTEM_PROMPT = `你是一位专业的考试辅导老师，擅长帮助考生理解题目、掌握知识点。你的职责是：

1. **解析题目**：用通俗易懂的语言解释题目在考什么
2. **讲解知识点**：指出题目涉及的核心考点和关联知识
3. **解题思路**：给出清晰的解题步骤和推理过程
4. **举一反三**：提供类似题型的解题技巧

要求：
- 回答简洁有力，避免冗长
- 用中文回答
- 如果题目有选项，逐一分析每个选项为什么对/错
- 鼓励学生，但不要过度恭维`;

export async function POST(request: NextRequest) {
  try {
    const { messages, questionContext } = await request.json();

    // 构建完整的消息列表
    const fullMessages: Message[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    // 如果有题目上下文，先注入
    if (questionContext) {
      fullMessages.push({
        role: "user" as const,
        content: `我正在做这道题，请帮我理解：\n\n${questionContext}\n\n请先简要分析这道题，然后等我提问。`,
      });
      fullMessages.push({
        role: "assistant" as const,
        content: "好的，我已经了解了这道题。请告诉我你哪里不明白，我来帮你解答。",
      });
    }

    // 追加用户的实际对话
    for (const msg of messages || []) {
      fullMessages.push({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      });
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const stream = client.stream(fullMessages, {
      model: "doubao-seed-2-0-lite-260215",
      temperature: 0.7,
    });

    // 创建 SSE 流
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (chunk.content) {
              const text = chunk.content.toString();
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: text })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : "Unknown error";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: errMsg })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
