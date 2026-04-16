// 后台管理安全配置
// 这些值来自环境变量，在客户端安全访问

export const ADMIN_CONFIG = {
  // 登录路径（从环境变量读取，默认使用随机路径）
  LOGIN_PATH: process.env.NEXT_PUBLIC_ADMIN_LOGIN_PATH || '/dashboard/auth/secure-login',
  
  // API 路径
  API_LOGIN: '/api/admin/login',
  API_CHANGE_PASSWORD: '/api/admin/change-password',
  
  // Token 存储键
  TOKEN_KEY: 'admin_token',
  USER_KEY: 'admin_user',
};

// 获取登录路径
export function getLoginPath(): string {
  return ADMIN_CONFIG.LOGIN_PATH;
}

// 获取重定向到登录的路径
export function getRedirectToLogin(): string {
  return ADMIN_CONFIG.LOGIN_PATH + '?redirect=' + encodeURIComponent('/admin');
}
