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
