import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, convertInchesToTwip } from 'docx';
import { getSupabaseAdminClient } from '@/storage/database/supabase-client';
import { requireAdminAuth } from '@/lib/api-auth';

// 1.27cm 转换为 twip (1cm ≈ 567.05 twip)
const MARGIN_TWIP = Math.round(1.27 * 567.05);

// 创建黑体文本的辅助函数
function createText(text: string, options?: { bold?: boolean; color?: string; size?: number }): TextRun {
  return new TextRun({
    text,
    font: 'SimHei', // 黑体
    bold: options?.bold || false,
    color: options?.color || '000000', // 统一黑色
    size: options?.size || 24, // 默认五号字
  });
}

// 创建选项文本
function createOptionText(optionId: string, optionText: string, size: number = 26): TextRun {
  return new TextRun({
    text: `${optionId}. ${optionText}`,
    font: 'SimHei',
    bold: false, // 正确答案不加粗
    color: '000000', // 统一黑色
    size: size, // 题目选项字体大一号
  });
}

// Word导出API - 按银行题库标准格式导出
export async function GET(request: Request) {
  // 验证管理员认证
  const auth = await requireAdminAuth(request);
  if (!auth.success) {
    return auth.response;
  }

  try {
    const url = new URL(request.url);
    const segments = url.pathname.split('/').filter(Boolean);
    // segments: ['api', 'admin', 'banks', 'export', '{id}']
    const bankId = segments[segments.length - 1];
    console.log('[Word Export] Starting export for bank:', bankId);
    
    const adminClient = getSupabaseAdminClient();

    // 获取题库信息
    const { data: bank, error: bankError } = await adminClient
      .from('question_banks')
      .select('*')
      .eq('id', bankId)
      .single();

    if (bankError || !bank) {
      console.error('[Word Export] Bank not found:', bankError);
      return Response.json({ error: '题库不存在' }, { status: 404 });
    }
    console.log('[Word Export] Bank found:', bank.name);

    // 获取题库下的所有题目
    const { data: questions, error: questionsError } = await adminClient
      .from('questions')
      .select('*')
      .eq('bank_id', bankId)
      .order('index_order', { ascending: true });

    if (questionsError) {
      console.error('[Word Export] Questions fetch error:', questionsError);
      return Response.json({ error: '获取题目失败' }, { status: 500 });
    }
    console.log('[Word Export] Questions count:', questions?.length || 0);

    // 构建文档内容
    const paragraphs: Paragraph[] = [];

    // 添加标题
    paragraphs.push(
      new Paragraph({
        children: [
          createText(bank.name, { bold: true, size: 32 }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
        indent: { left: 0 },
      })
    );

    // 题目计数器
    let questionIndex = 0;

    // 处理每道题目
    for (const question of questions) {
      // 跳过子题目（子题目会在综合题中处理）
      if (question.parent_id) continue;

      questionIndex++;

      // 判断题型
      const type = question.type;

      // 添加题型标签（半角符号减少空间）
      const typeLabel: Record<string, string> = {
        'single': '[单选题]',
        'multiple': '[多选题]',
        'true-false': '[判断题]',
        'fill-blank': '[填空题]',
        'comprehensive': '[综合题]',
      };

      // 如果是综合题
      if (type === 'comprehensive' && question.case_background) {
        // 综合题标题
        paragraphs.push(
          new Paragraph({
            children: [
              createText(`${questionIndex}. ${typeLabel[type]}`, { bold: true }),
            ],
            spacing: { before: 300, after: 100 },
            indent: { left: 0 },
          })
        );

        // 案例背景
        paragraphs.push(
          new Paragraph({
            children: [
              createText(`[案例背景]${question.case_background}`),
            ],
            spacing: { after: 200 },
            indent: { left: 0 },
          })
        );

        // 获取子题目
        const { data: children } = await adminClient
          .from('questions')
          .select('*')
          .eq('parent_id', question.id)
          .order('index_order', { ascending: true });

        if (children && children.length > 0) {
          let childIndex = 1;
          for (const child of children) {
            // 解析子题目答案
            let childAnswerIds: string[] = [];
            if (child.answer) {
              try {
                if (typeof child.answer === 'string' && child.answer.startsWith('[')) {
                  childAnswerIds = JSON.parse(child.answer);
                } else if (Array.isArray(child.answer)) {
                  childAnswerIds = child.answer;
                } else {
                  childAnswerIds = [String(child.answer)];
                }
                childAnswerIds = childAnswerIds.map((a: string) => a.toUpperCase());
              } catch {
                childAnswerIds = [];
              }
            }

            // 子题目内容
            paragraphs.push(
              new Paragraph({
                children: [
                  createText(`(${childIndex}) ${child.content}`),
                ],
                spacing: { after: 100 },
                indent: { left: 0 },
              })
            );

            // 子题目选项（答案选项加粗显示）
            // 解析子题目 options（可能是 JSON 字符串或数组）
            let childOptions: Array<{id: string; text: string}> = [];
            if (child.options) {
              try {
                if (typeof child.options === 'string') {
                  childOptions = JSON.parse(child.options);
                } else if (Array.isArray(child.options)) {
                  childOptions = child.options;
                }
              } catch {
                childOptions = [];
              }
            }
            
            if (childOptions.length > 0) {
              for (const option of childOptions) {
                const optionId = option?.id ? String(option.id).toUpperCase() : '';
                const optionText = option?.text || '';
                if (optionId && optionText) {
                  paragraphs.push(
                    new Paragraph({
                      children: [
                        createOptionText(optionId, optionText),
                      ],
                      spacing: { after: 50 },
                      indent: { left: 0 },
                    })
                  );
                }
              }
            }

            // 判断题子题目选项
            if (child.type === 'true-false' && (!child.options || child.options.length === 0)) {
              paragraphs.push(
                new Paragraph({
                  children: [
                    createOptionText('A', '正确'),
                    createText('    '),
                    createOptionText('B', '错误'),
                  ],
                  spacing: { after: 100 },
                  indent: { left: 0 },
                })
              );
            }

            // 子题目答案前添加空行
            paragraphs.push(
              new Paragraph({
                children: [
                  createText(''), // 空行
                ],
                spacing: { after: 50 },
                indent: { left: 0 },
              })
            );

            // 子题目答案
            const childAnswer = Array.isArray(child.answer) 
              ? child.answer.map((a: string) => a.toUpperCase()).join(', ')
              : child.answer?.toUpperCase() || '';
            
            if (childAnswer) {
              paragraphs.push(
                new Paragraph({
                  children: [
                    createText(`正确答案：${childAnswer}`, { bold: true }),
                  ],
                  spacing: { after: 50 },
                  indent: { left: 0 },
                })
              );
            }

            // 子题目解析
            if (child.explanation) {
              paragraphs.push(
                new Paragraph({
                  children: [
                    createText(`名师解析：${child.explanation}`),
                  ],
                  spacing: { after: 200 },
                  indent: { left: 0 },
                })
              );
            } else {
              paragraphs.push(
                new Paragraph({
                  text: '',
                  spacing: { after: 100 },
                })
              );
            }

            childIndex++;
          }
        }
      } else {
        // 普通题目
        // 题目内容
        paragraphs.push(
          new Paragraph({
            children: [
              createText(`${questionIndex}. ${typeLabel[type] || ''} ${question.content}`),
            ],
            spacing: { before: 300, after: 100 },
            indent: { left: 0 },
          })
        );

        // 题目选项（答案选项加粗显示）
        // 解析 options（可能是 JSON 字符串或数组）
        let questionOptions: Array<{id: string; text: string}> = [];
        if (question.options) {
          try {
            if (typeof question.options === 'string') {
              questionOptions = JSON.parse(question.options);
            } else if (Array.isArray(question.options)) {
              questionOptions = question.options;
            }
          } catch {
            questionOptions = [];
          }
        }
        
        if (questionOptions.length > 0) {
          // 解析答案
          let answerIds: string[] = [];
          if (question.answer) {
            try {
              if (typeof question.answer === 'string' && question.answer.startsWith('[')) {
                answerIds = JSON.parse(question.answer);
              } else if (Array.isArray(question.answer)) {
                answerIds = question.answer;
              } else {
                answerIds = [String(question.answer)];
              }
            } catch {
              answerIds = [String(question.answer)];
            }
            // 统一转为大写用于比较
            answerIds = answerIds.map((a: string) => a.toUpperCase());
          }

          for (const option of questionOptions) {
            const optionId = option?.id ? String(option.id).toUpperCase() : '';
            const optionText = option?.text || '';
            if (optionId && optionText) {
              paragraphs.push(
                new Paragraph({
                  children: [
                    createOptionText(optionId, optionText),
                  ],
                  spacing: { after: 50 },
                  indent: { left: 0 }, // 左缩进为0
                })
              );
            }
          }
        }

        // 判断题的选项简化
        if (type === 'true-false' && (!question.options || question.options.length === 0)) {
          paragraphs.push(
            new Paragraph({
              children: [
                createOptionText('A', '正确'),
                createText('    '),
                createOptionText('B', '错误'),
              ],
              spacing: { after: 100 },
              indent: { left: 0 },
            })
          );
        }

        // 填空题的横线提示
        if (type === 'fill-blank') {
          paragraphs.push(
            new Paragraph({
              children: [
                createText('_______________'),
              ],
              spacing: { after: 100 },
              indent: { left: 0 },
            })
          );
        }

        // 答案前添加空行（黑体显示）
        paragraphs.push(
          new Paragraph({
            children: [
              createText(''), // 空行
            ],
            spacing: { after: 50 },
            indent: { left: 0 },
          })
        );

        // 答案（黑体显示，黑色）
        const answer = Array.isArray(question.answer) 
          ? question.answer.map((a: string) => a.toUpperCase()).join(', ')
          : question.answer?.toUpperCase() || '';
        
        if (answer) {
          paragraphs.push(
            new Paragraph({
              children: [
                createText(`正确答案：${answer}`, { bold: true }),
              ],
              spacing: { after: 50 },
              indent: { left: 0 },
            })
          );
        }

        // 解析（黑体显示）
        if (question.explanation) {
          paragraphs.push(
            new Paragraph({
              children: [
                createText(`名师解析：${question.explanation}`),
              ],
              spacing: { after: 200 },
              indent: { left: 0 },
            })
          );
        } else {
          paragraphs.push(
            new Paragraph({
              text: '',
              spacing: { after: 100 },
            })
          );
        }
      }
    }

    // 创建文档（设置页面边距为1.27cm）
    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: MARGIN_TWIP,
                right: MARGIN_TWIP,
                bottom: MARGIN_TWIP,
                left: MARGIN_TWIP,
              },
            },
          },
          children: paragraphs,
        },
      ],
    });

    // 生成 buffer
    const buffer = await Packer.toBuffer(doc);

    // 将 Buffer 转换为 Uint8Array
    const uint8Array = new Uint8Array(buffer);

    // 返回文件
    const fileName = `${bank.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}.docx`;
    
    console.log('[Word Export] Success, fileName:', fileName);
    
    return new Response(uint8Array, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
    });
  } catch (error) {
    console.error('[Word Export] Export error:', error);
    const errorMessage = error instanceof Error ? error.message : '导出失败';
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}
