# 刷题网页 - 项目规范

## 1. 项目概述

- **项目名称**: 智能刷题助手
- **项目类型**: 单页应用 (SPA)
- **核心功能**: 支持 PDF 导入题库的智能刷题练习系统
- **目标用户**: 学生、备考人员、自学者

## 2. 功能清单

### 2.1 题库管理
- PDF 文件导入题库
- 题目列表展示（支持筛选、搜索）
- 题目标签管理
- 题目分类（按科目、章节）

### 2.2 题目练习
- 多种题型支持：选择题（单选/多选）、判断题、填空题
- 随机练习模式
- 顺序练习模式
- 错题重练模式
- 答题计时功能

### 2.3 答题反馈
- 实时答案校验
- 正确答案高亮显示
- 题目解析展示
- 答题进度显示

### 2.4 统计与追踪
- 正确率统计
- 练习历史记录
- 错题本功能
- 学习进度可视化

## 3. 技术架构

### 3.1 前端框架
- Next.js 16 (App Router)
- React 19
- TypeScript 5
- Tailwind CSS 4
- shadcn/ui 组件库

### 3.2 状态管理
- React useState/useReducer
- localStorage 本地持久化

### 3.3 PDF 解析
- pdfjs-dist 库
- 后端 API 辅助解析

### 3.4 数据存储
- 浏览器 localStorage
- 可扩展至 Supabase

## 4. 目录结构

```
src/
├── app/
│   ├── page.tsx                 # 主页面
│   ├── layout.tsx               # 布局组件
│   └── globals.css              # 全局样式
├── components/
│   ├── ui/                      # shadcn/ui 组件
│   ├── quiz/                    # 刷题相关组件
│   │   ├── QuizCard.tsx         # 题目卡片
│   │   ├── QuizOption.tsx       # 选项组件
│   │   ├── QuizProgress.tsx     # 进度组件
│   │   ├── QuizResult.tsx       # 结果组件
│   │   └── QuizControls.tsx     # 控制组件
│   ├── library/                 # 题库管理组件
│   │   ├── QuestionList.tsx     # 题目列表
│   │   ├── ImportModal.tsx      # 导入弹窗
│   │   └── QuestionForm.tsx     # 题目表单
│   └── stats/                   # 统计组件
│       └── StatsCard.tsx        # 统计卡片
├── lib/
│   ├── utils.ts                 # 工具函数
│   ├── quiz-store.ts            # 刷题状态管理
│   ├── pdf-parser.ts            # PDF 解析工具
│   └── types.ts                 # 类型定义
└── hooks/
    └── use-quiz.ts              # 刷题 Hook
```

## 5. 数据模型

### 5.1 题目 (Question)
```typescript
interface Question {
  id: string;
  type: 'single' | 'multiple' | 'true-false' | 'fill-blank';
  content: string;
  options?: { id: string; text: string }[];
  answer: string | string[];
  explanation?: string;
  tags: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  createdAt: number;
}
```

### 5.2 练习记录 (PracticeRecord)
```typescript
interface PracticeRecord {
  id: string;
  questionId: string;
  isCorrect: boolean;
  selectedAnswer: string | string[];
  timestamp: number;
}
```

### 5.3 题库 (QuestionBank)
```typescript
interface QuestionBank {
  id: string;
  name: string;
  description?: string;
  questionIds: string[];
  createdAt: number;
}
```

## 6. 页面布局

### 6.1 顶部导航栏
- Logo/标题
- 导航菜单（练习/题库/统计）
- 导入按钮

### 6.2 主内容区
- 左侧边栏：题库列表、标签筛选
- 中间主区：题目展示、答题区域
- 右侧边栏：进度统计、快捷操作

### 6.3 底部工具栏
- 上一题/下一题
- 提交答案
- 退出练习

## 7. 样式规范

### 7.1 主题色彩
- 主色: #3B82F6 (蓝色)
- 成功: #10B981 (绿色)
- 错误: #EF4444 (红色)
- 警告: #F59E0B (橙色)
- 背景: #F8FAFC (浅灰白)
- 文字: #1E293B (深灰)

### 7.2 字体
- 主字体: Inter
- 代码: JetBrains Mono

### 7.3 间距
- 基础单位: 4px
- 常用间距: 8px, 12px, 16px, 24px, 32px

## 8. 交互规范

### 8.1 动画
- 页面切换: 300ms ease-out
- 按钮悬停: 150ms ease
- 答题反馈: 200ms ease-in-out

### 8.2 响应式
- 桌面端: > 1024px
- 平板端: 768px - 1024px
- 移动端: < 768px

## 9. API 接口

### 9.1 PDF 解析接口
```
POST /api/parse-pdf
Request: FormData { file: File }
Response: { questions: Question[] }
```

### 9.2 题库接口
```
GET /api/questions
POST /api/questions
DELETE /api/questions/:id
```

## 10. 测试清单

- [ ] PDF 导入功能
- [ ] 题目展示正确
- [ ] 答题交互流畅
- [ ] 答案校验准确
- [ ] 进度统计正确
- [ ] 数据持久化正常
- [ ] 响应式布局正常
