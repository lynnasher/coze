import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, convertInchesToTwip } from 'docx';
import { getSupabaseAdminClient } from '@/storage/database/supabase-client';

// Word导出API - 按银行题库标准格式导出
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bankId } = await params;
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
        text: bank.name,
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      })
    );

    // 添加说明
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: '【说明】本试卷包含以下题型：单选题、多选题、判断题、填空题、综合题。',
            bold: false,
            color: '666666',
          }),
        ],
        spacing: { after: 200 },
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

      // 添加题型标签
      const typeLabel: Record<string, string> = {
        'single': '【单选题】',
        'multiple': '【多选题】',
        'true-false': '【判断题】',
        'fill-blank': '【填空题】',
        'comprehensive': '【综合题】',
      };

      // 如果是综合题
      if (type === 'comprehensive' && question.case_background) {
        // 综合题标题
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${questionIndex}. ${typeLabel[type]}`,
                bold: true,
              }),
            ],
            spacing: { before: 300, after: 100 },
          })
        );

        // 案例背景
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `【案例背景】${question.case_background}`,
                color: '333333',
              }),
            ],
            spacing: { after: 200 },
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
            // 子题目内容
            paragraphs.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `(${childIndex}) ${child.content}`,
                    bold: false,
                  }),
                ],
                spacing: { after: 100 },
                indent: { left: convertInchesToTwip(0.3) },
              })
            );

            // 子题目选项
            if (child.options && child.options.length > 0) {
              for (const option of child.options) {
                // 安全检查：确保 option 存在且有有效属性
                const optionId = option?.id ? String(option.id).toUpperCase() : '';
                const optionText = option?.text || '';
                if (optionId && optionText) {
                  paragraphs.push(
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: `    ${optionId}. ${optionText}`,
                          color: '333333',
                        }),
                      ],
                      spacing: { after: 50 },
                      indent: { left: convertInchesToTwip(0.3) },
                    })
                  );
                }
              }
            }

            // 子题目答案
            const childAnswer = Array.isArray(child.answer) 
              ? child.answer.map((a: string) => a.toUpperCase()).join(', ')
              : child.answer?.toUpperCase() || '';
            
            if (childAnswer) {
              paragraphs.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `正确答案：${childAnswer}`,
                      bold: true,
                      color: '008000',
                    }),
                  ],
                  spacing: { after: 50 },
                  indent: { left: convertInchesToTwip(0.3) },
                })
              );
            }

            // 子题目解析
            if (child.explanation) {
              paragraphs.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `名师解析：${child.explanation}`,
                      color: '996600',
                    }),
                  ],
                  spacing: { after: 200 },
                  indent: { left: convertInchesToTwip(0.3) },
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
              new TextRun({
                text: `${questionIndex}. ${typeLabel[type] || ''} ${question.content}`,
                bold: false,
              }),
            ],
            spacing: { before: 300, after: 100 },
          })
        );

        // 题目选项
        if (question.options && question.options.length > 0) {
          for (const option of question.options) {
            // 安全检查：确保 option 存在且有有效属性
            const optionId = option?.id ? String(option.id).toUpperCase() : '';
            const optionText = option?.text || '';
            if (optionId && optionText) {
              paragraphs.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `    ${optionId}. ${optionText}`,
                      color: '333333',
                    }),
                  ],
                  spacing: { after: 50 },
                  indent: { left: convertInchesToTwip(0.3) },
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
                new TextRun({
                  text: '    A. 正确    B. 错误',
                  color: '333333',
                }),
              ],
              spacing: { after: 100 },
              indent: { left: convertInchesToTwip(0.3) },
            })
          );
        }

        // 填空题的横线提示
        if (type === 'fill-blank') {
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: '    _______________',
                  color: '333333',
                }),
              ],
              spacing: { after: 100 },
              indent: { left: convertInchesToTwip(0.3) },
            })
          );
        }

        // 答案
        const answer = Array.isArray(question.answer) 
          ? question.answer.map((a: string) => a.toUpperCase()).join(', ')
          : question.answer?.toUpperCase() || '';
        
        if (answer) {
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `正确答案：${answer}`,
                  bold: true,
                  color: '008000',
                }),
              ],
              spacing: { after: 50 },
              indent: { left: convertInchesToTwip(0.3) },
            })
          );
        }

        // 解析
        if (question.explanation) {
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `名师解析：${question.explanation}`,
                  color: '996600',
                }),
              ],
              spacing: { after: 200 },
              indent: { left: convertInchesToTwip(0.3) },
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

    // 创建文档
    const doc = new Document({
      sections: [
        {
          properties: {},
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
