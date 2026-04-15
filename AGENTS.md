# 刷题网页 - 项目规范

## 1. 项目概述

- **项目名称**: 智能刷题助手
- **项目类型**: 单页应用 (SPA)
- **核心功能**: 支持 PDF/Word 文档导入题库的智能刷题练习系统
- **目标用户**: 学生、备考人员、自学者

## 2. 功能清单

### 2.1 题库管理
- 题库列表展示（支持筛选、搜索）
- 题目标签管理
- 题目分类（按科目、章节）
- **题库仅支持后台管理导入**

### 2.2 用户账号
- 手机号注册/登录
- 登录状态显示
- 管理员与普通用户角色区分

### 2.3 题目练习
- 多种题型支持：选择题（单选/多选）、判断题、填空题、综合案例题
- 随机练习模式
- 顺序练习模式
- 错题重练模式
- 答题计时功能
- 答案与解析需手动点击按钮显示（支持多选题自由选择）

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

### 2.5 后台管理系统
- 管理员登录验证
- 题库导入管理（支持 JSON 格式）
- 题库列表查看与管理
- 题库删除功能
- 题库导出功能（JSON 格式）
- 统计数据概览（题库总数、题目总数等）
- **用户管理（查看、添加、禁用/启用、删除）**
- 分类管理

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

### 3.3 文档解析
- mammoth.js (Word 文档解析)
- pdf-parse (PDF 文档解析)
- 自定义正则表达式提取题目
- pdfjs-dist 库
- 后端 API 辅助解析

### 3.4 支持的文档格式（银行题库标准格式）

**题目格式**：
```
1假设某银行风险加权资产为10000亿元，则根据...其核心资本不得（）。

A、高于400亿元
B、低于400亿元
C、高于800亿元
D、低于800亿元

正确答案：B

名师解析：根据《巴塞尔协议Ⅱ》的规定，核心资本充足率最低要求为4%...
```

**格式说明**：
- 题目编号：`1` + 题目内容（可能带有 `、.` 等分隔符）
- 选项格式：`A、` + 选项内容（每个选项可能跨行）
- 正确答案：`正确答案：B`
- 名师解析：`名师解析：` + 解析内容（可能跨多行）
- 题目之间用空行分隔

**解析器特点**：
- 支持跨行选项合并
- 自动提取答案和解析
- 智能识别题目类型（单选/多选/判断/填空/综合）
- 支持综合案例题识别，自动提取案例背景
- 支持多种变体格式

### 3.5 数据存储
- 浏览器 localStorage（题库、分类等前端数据）
- Supabase PostgreSQL（用户账号、激活码系统）

## 4. 目录结构

```
src/
├── app/
│   ├── page.tsx                 # 主页面
│   ├── layout.tsx               # 布局组件
│   ├── globals.css              # 全局样式
│   ├── admin/                   # 后台管理
│   │   ├── page.tsx            # 管理主页
│   │   ├── login/              # 登录页面
│   │   │   └── page.tsx
│   │   ├── users/              # 用户管理
│   │   │   └── page.tsx
│   │   └── bank/              # 题库编辑
│   │       └── [id]/page.tsx
│   └── api/
│       └── admin/              # 管理员 API
│           ├── login/         # 登录接口
│           │   └── route.ts
│           ├── banks/         # 题库管理
│           │   ├── route.ts
│           │   └── [id]/route.ts
│           ├── import/        # 文件导入
│           │   └── route.ts
│           └── import-json/   # JSON 导入
│               └── route.ts
├── components/
│   ├── ui/                      # shadcn/ui 组件
│   ├── BankCard.tsx            # 题库卡片组件
│   ├── AuthModal.tsx           # 用户认证组件（登录/注册）
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
│   ├── types.ts                 # 类型定义
│   └── services/                 # 服务层
│       ├── user-service.ts      # 用户服务（Supabase）
│       └── activation-service.ts # 激活码服务（Supabase）
├── storage/
│   └── database/                # 数据库配置
│       ├── supabase-client.ts    # Supabase 客户端
│       └── shared/               # 共享数据库代码
│           ├── schema.ts         # 数据库表结构
│           └── relations.ts      # 表关系定义
└── hooks/
    └── use-quiz.ts              # 刷题 Hook
```

## 5. 数据模型

### 5.1 题目 (Question)
```typescript
interface Question {
  id: string;
  parentId?: string; // 父题目ID（综合案例题的子题目）
  type: 'single' | 'multiple' | 'true-false' | 'fill-blank' | 'comprehensive';
  content: string;
  options?: { id: string; text: string }[];
  answer: string | string[];
  explanation?: string;
  tags: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  createdAt: number;
  bankId?: string; // 关联的题库ID
  // 综合案例题相关字段
  caseBackground?: string; // 案例背景（综合题大题描述）
  caseContext?: string; // 案例上下文/材料
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
  categoryId?: string; // 关联的分类ID
}
```

### 5.4 分类 (Category)
```typescript
interface Category {
  id: string;
  name: string;
  color: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'pink' | 'indigo' | 'cyan';
  order: number;
  parentId?: string; // 父分类ID，如果为空则是顶级分类
  createdAt?: number;
}
```

### 5.5 数据库表（Supabase）

**users 表**：
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| phone | varchar(11) | 手机号（唯一） |
| password | text | 加密密码 |
| nickname | varchar | 昵称 |
| role | varchar | 角色（admin/user） |
| status | varchar | 状态（active/banned） |
| activated_categories | jsonb | 已激活的分类ID数组 |
| created_at | timestamp | 创建时间 |
| last_login_at | timestamp | 最后登录时间 |

**activation_codes 表**：
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| code | varchar(10) | 激活码（唯一） |
| category_id | varchar | 对应分类ID |
| category_name | varchar | 对应分类名称 |
| type | varchar | 类型（once/multi） |
| max_uses | int | 最大使用次数 |
| uses | int | 已使用次数 |
| status | varchar | 状态（active/used/expired） |
| expires_at | timestamp | 过期时间 |
| created_at | timestamp | 创建时间 |

**user_activations 表**：
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| user_id | uuid | 用户ID |
| category_id | varchar | 分类ID |
| category_name | varchar | 分类名称 |
| activated_at | timestamp | 激活时间 |

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

### 9.1 管理员登录接口
```
POST /api/admin/login
Request: { username: string, password: string }
Response: { success: boolean, token: string, user: { username: string } }
```

### 9.2 题库管理接口
```
GET /api/admin/banks
Response: { banks: QuestionBank[] }

DELETE /api/admin/banks/:id
Response: { success: boolean }
```

### 9.3 题库导入接口
```
POST /api/admin/import
Request: FormData { file: File }
Response: { success: boolean, count: number, bankId: string, bankName: string }

POST /api/admin/import-json
Request: { questions: Question[], bankName?: string }
Response: { success: boolean, count: number, bankId: string, bankName: string }
```

### 9.4 PDF 解析接口
```
POST /api/parse-pdf
Request: FormData { file: File }
Response: { questions: Question[] }
```

### 9.5 题库接口
```
GET /api/questions
POST /api/questions
DELETE /api/questions/:id
```

### 9.6 后台管理登录凭证
- 默认用户名: `admin`
- 默认密码: `admin123`
- Token 有效期: 24小时

### 9.7 用户认证接口（Supabase）
```
POST /api/auth/user
Request (登录): { type: 'login', phone: string, password: string }
Request (注册): { type: 'register', phone: string, password: string, nickname?: string }
Response: { success: boolean, user: User, token: string }
```

### 9.8 激活码接口（Supabase）
```
GET /api/activation-codes
Headers: Authorization: Bearer <admin_token>
Response: { success: boolean, codes: ActivationCode[] }

POST /api/activation-codes
Headers: Authorization: Bearer <admin_token>
Request: { categoryId: string, categoryName: string, quantity?: number, type?: 'once'|'multi', maxUses?: number, expiresAt?: string }
Response: { success: boolean, codes: ActivationCode[] }

POST /api/activation-codes/use
Request: { code: string, userId: string }
Response: { success: boolean, activation: { category_id, category_name, activated_at } }
```

### 9.9 用户管理接口（Supabase）
```
GET /api/admin/users
Headers: Authorization: Bearer <admin_token>
Response: { success: boolean, users: User[] }

POST /api/admin/users
Headers: Authorization: Bearer <admin_token>
Request: { phone: string, password: string, nickname?: string, role?: 'user'|'admin' }
Response: { success: boolean, user: User }

PUT /api/admin/users/:id
Headers: Authorization: Bearer <admin_token>
Request: { status?: 'active'|'banned', role?: 'user'|'admin', activated_categories?: string[] }
Response: { success: boolean }

DELETE /api/admin/users/:id
Headers: Authorization: Bearer <admin_token>
Response: { success: boolean }
```

## 10. 测试清单

- [ ] PDF 导入功能
- [x] 题目展示正确
- [x] 答题交互流畅
- [x] 答案校验准确
- [x] 进度统计正确
- [x] 数据持久化正常
- [x] 响应式布局正常
- [x] 题库分类管理（后台，支持二级分类）
- [x] 前台题库按分类显示（二级分类）
- [x] 用户注册/登录功能（Supabase）
- [x] 后台用户管理功能（Supabase）
- [x] 前台账号入口显示
- [x] 激活码生成功能（Supabase）
- [x] 激活码使用功能（Supabase）
- [x] 用户分类权限管理（Supabase）
