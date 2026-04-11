// 扣子专属：PDF转文本+正则解析+自动刷题系统（免费可部署）
import { useState } from 'react';

export default function Home() {
  // 状态管理
  const [questions, setQuestions] = useState([]); // 解析后的题库
  const [currentIndex, setCurrentIndex] = useState(0); // 当前题目
  const [showAnswer, setShowAnswer] = useState(false); // 显示答案解析

  // ============== 1. PDF上传 + 文本提取 ==============
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 纯前端读取PDF为文本（扣子环境完美兼容）
    const reader = new FileReader();
    reader.onload = async (event) => {
      const arrayBuffer = event.target.result;
      try {
        // 动态加载PDF解析库（CDN，无依赖）
        const pdfjsLib = await import('https://unpkg.com/pdfjs-dist@4.0.379/build/pdf.min.js');
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@4.0.379/build/pdf.worker.min.js';

        // 解析PDF
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';

        // 提取所有页面文本
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const text = content.items.map(item => item.str).join('');
          fullText += text + '\n';
        }

        // ============== 2. 专属正则解析题库（核心！） ==============
        parseQuestionBank(fullText);
      } catch (err) {
        alert('解析失败：' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ============== 3. 正则提取题目（适配你的银行题库格式） ==============
  const parseQuestionBank = (text) => {
    // 你的题库专属正则表达式
    const regex = /(\d+)\s*([\s\S]*?)\s*([A-D]、.*?)\s*正确答案：([A-D])\s*名师解析：([\s\S]*?)(?=\d+|$)/g;
    const questionList = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
      const id = match[1];
      const title = match[2].replace(/\s+/g, ' ').trim();
      const optionsText = match[3].replace(/\s+/g, ' ').trim();
      const answer = match[4].trim();
      const analysis = match[5].replace(/\s+/g, ' ').trim();

      // 分割选项
      const options = optionsText.match(/[A-D]、[^A-D]+/g) || [];

      questionList.push({ id, title, options, answer, analysis });
    }

    setQuestions(questionList);
    setCurrentIndex(0);
    setShowAnswer(false);
    alert(`解析成功！共提取到 ${questionList.length} 道题`);
  };

  // ============== 4. 刷题逻辑 ==============
  const currentQ = questions[currentIndex] || {};
  // 安全遍历（彻底解决 map is not a function 报错）
  const safeOptions = currentQ.options || [];

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
      <h2 style={{ textAlign: 'center' }}>📚 银行题库刷题系统</h2>
      
      {/* PDF上传按钮 */}
      <div style={{ margin: '20px 0', textAlign: 'center' }}>
        <input 
          type="file" 
          accept=".pdf" 
          onChange={handleFileUpload}
          style={{ padding: '8px', fontSize: '16px' }}
        />
        <p style={{ color: '#666' }}>上传你的题库PDF → 自动解析 → 立即刷题</p>
      </div>

      {/* 题目展示区域 */}
      {questions.length > 0 ? (
        <div style={{ border: '1px solid #eee', padding: '20px', borderRadius: '8px' }}>
          <h3>第{currentQ.id}题：{currentQ.title}</h3>
          
          {/* 选项（安全遍历） */}
          <div style={{ margin: '15px 0' }}>
            {safeOptions.map((opt, idx) => (
              <div key={idx} style={{ margin: '10px 0', fontSize: '16px' }}>
                {opt}
              </div>
            ))}
          </div>

          {/* 操作按钮 */}
          <div style={{ gap: '10px', display: 'flex' }}>
            <button onClick={() => setShowAnswer(!showAnswer)} style={{ padding: '8px 16px' }}>
              {showAnswer ? '隐藏解析' : '查看答案/解析'}
            </button>
            <button 
              onClick={() => {setCurrentIndex(currentIndex+1); setShowAnswer(false);}}
              disabled={currentIndex === questions.length-1}
              style={{ padding: '8px 16px' }}
            >
              下一题
            </button>
          </div>

          {/* 答案解析 */}
          {showAnswer && (
            <div style={{ marginTop: '15px', padding: '15px', background: '#f8f9fa', borderRadius: '5px' }}>
              <p><strong>✅ 正确答案：</strong>{currentQ.answer}</p>
              <p><strong>📖 名师解析：</strong>{currentQ.analysis}</p>
            </div>
          )}
        </div>
      ) : (
        <p style={{ textAlign: 'center', color: '#999' }}>请上传PDF题库开始刷题</p>
      )}
    </div>
  );
}