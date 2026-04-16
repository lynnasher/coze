import { pgTable, serial, timestamp, varchar, boolean, integer, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"


export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 用户表
export const users = pgTable(
  "users",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    phone: varchar("phone", { length: 20 }).notNull().unique(),
    password: varchar("password", { length: 255 }).notNull(),
    nickname: varchar("nickname", { length: 50 }),
    role: varchar("role", { length: 20 }).notNull().default("user"),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    activated_categories: varchar("activated_categories", { length: 1000 }), // JSON array of category IDs
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    last_login_at: timestamp("last_login_at", { withTimezone: true }),
  },
  (table) => [
    index("users_phone_idx").on(table.phone),
    index("users_status_idx").on(table.status),
  ]
);

// 激活码表
export const activationCodes = pgTable(
  "activation_codes",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    code: varchar("code", { length: 50 }).notNull().unique(),
    category_id: varchar("category_id", { length: 36 }).notNull(), // 对应题库分类
    category_name: varchar("category_name", { length: 100 }), // 分类名称（冗余存储便于显示）
    type: varchar("type", { length: 20 }).notNull().default("once"), // once=一次性, single=单人用, multiple=多次用
    max_uses: integer("max_uses").notNull().default(1),
    uses: integer("uses").notNull().default(0),
    expires_at: timestamp("expires_at", { withTimezone: true }),
    status: varchar("status", { length: 20 }).notNull().default("active"), // active=可用, used=已用完, expired=已过期, disabled=已禁用
    description: varchar("description", { length: 255 }), // 激活码描述
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("activation_codes_code_idx").on(table.code),
    index("activation_codes_category_idx").on(table.category_id),
    index("activation_codes_status_idx").on(table.status),
  ]
);

// 用户激活记录表
export const userActivations = pgTable(
  "user_activations",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
    category_id: varchar("category_id", { length: 36 }).notNull(),
    category_name: varchar("category_name", { length: 100 }),
    activation_code: varchar("activation_code", { length: 50 }),
    activated_at: timestamp("activated_at", { withTimezone: true }).defaultNow().notNull(),
    expires_at: timestamp("expires_at", { withTimezone: true }), // 永久激活则为 NULL
  },
  (table) => [
    index("user_activations_user_idx").on(table.user_id),
    index("user_activations_category_idx").on(table.category_id),
  ]
);

// 题库分类表
export const categories = pgTable(
  "categories",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 100 }).notNull(),
    color: varchar("color", { length: 20 }).default("blue"),
    order: integer("order").default(0),
    parent_id: varchar("parent_id", { length: 36 }), // 父分类ID
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("categories_parent_idx").on(table.parent_id),
  ]
);

// 题库表
export const questionBanks = pgTable(
  "question_banks",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 200 }).notNull(),
    description: varchar("description", { length: 500 }),
    source_file: varchar("source_file", { length: 255 }),
    question_count: integer("question_count").default(0),
    category_id: varchar("category_id", { length: 36 }).references(() => categories.id),
    status: varchar("status", { length: 20 }).default("active"), // active=正常, disabled=禁用
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("question_banks_category_idx").on(table.category_id),
    index("question_banks_status_idx").on(table.status),
  ]
);

// 题目表
export const questions = pgTable(
  "questions",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    bank_id: varchar("bank_id", { length: 36 }).notNull().references(() => questionBanks.id),
    parent_id: varchar("parent_id", { length: 36 }), // 父题目ID（综合案例题的子题目）
    type: varchar("type", { length: 20 }).notNull().default("single"), // single, multiple, true-false, fill-blank, comprehensive
    content: varchar("content", { length: 4000 }).notNull(),
    options: varchar("options", { length: 4000 }), // JSON array of options
    answer: varchar("answer", { length: 1000 }), // 正确答案
    explanation: varchar("explanation", { length: 4000 }), // 解析
    difficulty: varchar("difficulty", { length: 20 }).default("medium"), // easy, medium, hard
    tags: varchar("tags", { length: 1000 }), // JSON array of tags
    case_background: varchar("case_background", { length: 4000 }), // 案例背景（综合题）
    case_context: varchar("case_context", { length: 4000 }), // 案例上下文
    status: varchar("status", { length: 20 }).default("active"), // active=正常, disabled=禁用
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("questions_bank_idx").on(table.bank_id),
    index("questions_parent_idx").on(table.parent_id),
    index("questions_type_idx").on(table.type),
  ]
);

// 用户练习记录表
export const practiceRecords = pgTable(
  "practice_records",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }).notNull(), // 用户ID
    question_id: varchar("question_id", { length: 36 }).notNull(), // 题目ID
    is_correct: boolean("is_correct").notNull().default(false), // 是否正确
    selected_answer: varchar("selected_answer", { length: 1000 }), // 用户选择的答案
    bank_id: varchar("bank_id", { length: 36 }), // 题库ID
    bank_name: varchar("bank_name", { length: 200 }), // 题库名称（冗余存储）
    question_type: varchar("question_type", { length: 20 }), // 题目类型
    time_spent: integer("time_spent").default(0), // 花费时间（秒）
    timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("practice_records_user_idx").on(table.user_id),
    index("practice_records_question_idx").on(table.question_id),
    index("practice_records_bank_idx").on(table.bank_id),
    index("practice_records_timestamp_idx").on(table.timestamp),
  ]
);

// 用户错题连续正确次数表（用于智能错题本）
export const wrongQuestionStreaks = pgTable(
  "wrong_question_streaks",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }).notNull(), // 用户ID
    question_id: varchar("question_id", { length: 36 }).notNull(), // 题目ID
    streak: integer("streak").notNull().default(0), // 连续正确次数
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("wrong_streaks_user_idx").on(table.user_id),
    index("wrong_streaks_question_idx").on(table.question_id),
    index("wrong_streaks_user_question_idx").on(table.user_id, table.question_id),
  ]
);

// 用户最近练习记录表
export const recentPractices = pgTable(
  "recent_practices",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }).notNull(), // 用户ID
    bank_id: varchar("bank_id", { length: 36 }).notNull(), // 题库ID
    bank_name: varchar("bank_name", { length: 200 }), // 题库名称
    mode: varchar("mode", { length: 20 }).default("sequential"), // 练习模式
    total_count: integer("total_count").default(0), // 总题数
    answered_count: integer("answered_count").default(0), // 已答题数
    correct_count: integer("correct_count").default(0), // 正确数
    wrong_count: integer("wrong_count").default(0), // 错题数
    current_index: integer("current_index").default(0), // 当前题目索引
    is_completed: boolean("is_completed").default(false), // 是否完成
    started_at: timestamp("started_at", { withTimezone: true }).defaultNow(),
    last_practice_at: timestamp("last_practice_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("recent_practices_user_idx").on(table.user_id),
    index("recent_practices_bank_idx").on(table.bank_id),
    index("recent_practices_last_at_idx").on(table.last_practice_at),
  ]
);
