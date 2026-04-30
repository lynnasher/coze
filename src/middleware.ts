import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 注意：/admin 路径的访问控制已移至客户端
// 每个后台页面组件会检查 admin_token 并进行相应重定向

// 这里保留作为未来扩展用，例如：
// - 添加审计日志
// - 验证请求频率
// - 其他服务端安全检查

export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

// 配置匹配的路径（可以扩展需要拦截的路径）
export const config = {
  matcher: [
    // 目前不拦截任何路径
    // 未来可以添加：'/api/admin/:path*'
  ],
};
