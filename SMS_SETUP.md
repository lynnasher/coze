# 阿里云短信服务配置说明

## 一、购买短信套餐包

1. 访问阿里云官网：https://www.aliyun.com
2. 搜索"短信服务"或直接访问：https://www.aliyun.com/product/sms
3. 选择"短信认证套餐包"（免资质、免签名、免模板）
4. 购买适合您的套餐（如 1000条/50元）

## 二、获取 AccessKey

1. 登录阿里云控制台
2. 点击右上角头像 → AccessKey 管理
3. 创建 AccessKey，保存 **AccessKey ID** 和 **AccessKey Secret**

⚠️ **重要**：AccessKey Secret 只在创建时显示一次，请妥善保存

## 三、配置环境变量

在项目的 `.env` 文件中添加以下配置：

```env
# 阿里云短信配置
ALIYUN_ACCESS_KEY_ID=你的AccessKeyID
ALIYUN_ACCESS_KEY_SECRET=你的AccessKeySecret
ALIYUN_SMS_SIGN_NAME=阿里云短信测试
ALIYUN_SMS_TEMPLATE_CODE=SMS_215071136
```

### 配置说明：

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `ALIYUN_ACCESS_KEY_ID` | 阿里云 AccessKey ID | 必填 |
| `ALIYUN_ACCESS_KEY_SECRET` | 阿里云 AccessKey Secret | 必填 |
| `ALIYUN_SMS_SIGN_NAME` | 短信签名（套餐包使用固定值） | 阿里云短信测试 |
| `ALIYUN_SMS_TEMPLATE_CODE` | 短信模板CODE（套餐包使用固定值） | SMS_215071136 |

## 四、验证配置

1. 配置完成后重启服务
2. 在注册页面输入手机号，点击"获取验证码"
3. 如果配置正确，手机会收到真实短信验证码
4. 如果未配置，会保持测试模式（控制台输出验证码）

## 五、费用说明

- 短信认证套餐包：约 0.05元/条
- 按实际发送量计费，从套餐包中扣除
- 建议设置余额预警，避免欠费导致无法发送

## 六、安全建议

1. **不要将 `.env` 文件提交到 Git**
2. 定期更换 AccessKey
3. 为 AccessKey 设置最小权限（仅短信服务）
4. 生产环境建议使用阿里云 KMS 托管密钥

## 七、常见问题

### Q: 配置了环境变量但没有收到短信？
A: 检查以下几点：
1. 重启服务后环境变量是否加载
2. AccessKey 是否有短信服务权限
3. 套餐包是否还有剩余条数
4. 阿里云账户是否欠费

### Q: 短信内容可以自定义吗？
A: 短信认证套餐包使用固定模板：
```
您的验证码是：${code}，5分钟内有效，请勿泄露给他人。
```
如需自定义，需要申请企业资质和自定义模板。

### Q: 可以只给特定手机号发送吗？
A: 可以，在代码中可以对手机号进行白名单限制。

### Q: 如何防止短信被刷？
A: 当前已实现：
- 60秒发送间隔限制
- 5分钟验证码有效期
- 建议额外添加：
  - IP 频率限制
  - 图形验证码
  - 手机号日发送次数限制
