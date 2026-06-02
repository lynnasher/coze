-- 创建 categories 表
CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(20) DEFAULT 'blue',
  order_num INTEGER DEFAULT 0,
  parent_id VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- categories 表数据 (26 条)
INSERT INTO categories (id, name, color, order_num, parent_id, created_at) VALUES ('cat_1776241488755_todphfm80', '【初级】法律法规', 'blue', 0, 'cat_default_1', '2026-04-15T16:24:48.794081+08:00');
INSERT INTO categories (id, name, color, order_num, parent_id, created_at) VALUES ('cat_1776241505151_pbphgb30u', '【中级】法律法规', 'blue', 0, 'cat_1776241476046_joyqfcvea', '2026-04-15T16:25:05.189036+08:00');
INSERT INTO categories (id, name, color, order_num, parent_id, created_at) VALUES ('cat_1779713104167_dnphlvt5g', '未分类', 'purple', 0, NULL, '2026-05-25T20:45:04.206793+08:00');
INSERT INTO categories (id, name, color, order_num, parent_id, created_at) VALUES ('cat_1779893671150_eux5knjsh', '归档', 'blue', 0, 'cat_default_2', '2026-05-27T22:54:31.187184+08:00');
INSERT INTO categories (id, name, color, order_num, parent_id, created_at) VALUES ('cat_default_1', '初级银行', 'blue', 0, NULL, '2026-04-15T15:44:22.249588+08:00');
INSERT INTO categories (id, name, color, order_num, parent_id, created_at) VALUES ('cat_1776241668351_76jrr9xpg', '基金基础知识与法律法规', 'blue', 0, 'cat_default_2', '2026-04-15T16:27:48.381996+08:00');
INSERT INTO categories (id, name, color, order_num, parent_id, created_at) VALUES ('cat_1776309459758_2f6n0zyzu', '期货法律法规', 'blue', 0, 'cat_default_4', '2026-04-16T11:17:39.783903+08:00');
INSERT INTO categories (id, name, color, order_num, parent_id, created_at) VALUES ('cat_1776309382542_a5azfcgtq', '证券市场法律法规', 'blue', 0, 'cat_default_3', '2026-04-16T11:16:22.595315+08:00');
INSERT INTO categories (id, name, color, order_num, parent_id, created_at) VALUES ('cat_default_2', '基金从业', 'green', 1, NULL, '2026-04-15T15:44:22.249588+08:00');
INSERT INTO categories (id, name, color, order_num, parent_id, created_at) VALUES ('cat_1776265318517_v3d7dlt4k', '【中级】个人理财', 'blue', 1, 'cat_1776241476046_joyqfcvea', '2026-04-15T23:01:58.587435+08:00');
INSERT INTO categories (id, name, color, order_num, parent_id, created_at) VALUES ('cat_1776241685554_30s4ropil', '【初级】个人理财', 'blue', 1, 'cat_default_1', '2026-04-15T16:28:05.58676+08:00');
INSERT INTO categories (id, name, color, order_num, parent_id, created_at) VALUES ('cat_1776309398613_ck07xswod', '金融市场基础知识', 'blue', 1, 'cat_default_3', '2026-04-16T11:16:38.657861+08:00');
INSERT INTO categories (id, name, color, order_num, parent_id, created_at) VALUES ('cat_1776309430526_nv4kr6dft', '证券投资基金基础知识', 'blue', 1, 'cat_default_2', '2026-04-16T11:17:10.589396+08:00');
INSERT INTO categories (id, name, color, order_num, parent_id, created_at) VALUES ('cat_1776309472893_cdeauzmpk', '期货基础知识', 'blue', 1, 'cat_default_4', '2026-04-16T11:17:52.92118+08:00');
INSERT INTO categories (id, name, color, order_num, parent_id, created_at) VALUES ('cat_1776309441213_a8obg3qy6', '私募股权投资基金基础知识', 'blue', 2, 'cat_default_2', '2026-04-16T11:17:21.253551+08:00');
INSERT INTO categories (id, name, color, order_num, parent_id, created_at) VALUES ('cat_1776265333515_1u487ra4t', '【中级】银行管理', 'blue', 2, 'cat_1776241476046_joyqfcvea', '2026-04-15T23:02:13.566055+08:00');
INSERT INTO categories (id, name, color, order_num, parent_id, created_at) VALUES ('cat_default_3', '证券从业', 'red', 2, NULL, '2026-04-15T15:44:22.249588+08:00');
INSERT INTO categories (id, name, color, order_num, parent_id, created_at) VALUES ('cat_1776253526580_x25z4plys', '【初级】个人贷款', 'blue', 2, 'cat_default_1', '2026-04-15T19:45:26.63682+08:00');
INSERT INTO categories (id, name, color, order_num, parent_id, created_at) VALUES ('cat_default_4', '期货从业', 'yellow', 3, NULL, '2026-04-15T15:44:22.249588+08:00');
INSERT INTO categories (id, name, color, order_num, parent_id, created_at) VALUES ('cat_1776265345439_xt4bbnx0d', '【中级】公司信贷', 'blue', 3, 'cat_1776241476046_joyqfcvea', '2026-04-15T23:02:25.476214+08:00');
INSERT INTO categories (id, name, color, order_num, parent_id, created_at) VALUES ('cat_1776253543231_j9vmkfg88', '【初级】公司信贷', 'blue', 3, 'cat_default_1', '2026-04-15T19:45:43.285233+08:00');
INSERT INTO categories (id, name, color, order_num, parent_id, created_at) VALUES ('cat_1776253554754_fd1utmmlv', '【初级】银行管理', 'blue', 4, 'cat_default_1', '2026-04-15T19:45:54.795703+08:00');
INSERT INTO categories (id, name, color, order_num, parent_id, created_at) VALUES ('cat_1776265355603_46etfprp1', '【中级】个人贷款', 'blue', 4, 'cat_1776241476046_joyqfcvea', '2026-04-15T23:02:35.641247+08:00');
INSERT INTO categories (id, name, color, order_num, parent_id, created_at) VALUES ('cat_1776241476046_joyqfcvea', '中级银行', 'cyan', 5, NULL, '2026-04-15T16:24:36.08466+08:00');
INSERT INTO categories (id, name, color, order_num, parent_id, created_at) VALUES ('cat_1776265364433_zkx4dbzo8', '【中级】风险管理', 'blue', 5, 'cat_1776241476046_joyqfcvea', '2026-04-15T23:02:44.467139+08:00');
INSERT INTO categories (id, name, color, order_num, parent_id, created_at) VALUES ('cat_1776309074489_7jwz2i17q', '【初级】风险管理', 'blue', 5, 'cat_default_1', '2026-04-16T11:11:14.528468+08:00');

-- 导出完成
-- 导出表: categories
-- 导出时间: 2026-06-02T04:42:17.309Z
-- ================================
