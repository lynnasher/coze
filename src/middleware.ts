import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 禁止直接访问 /admin 路径
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // 拦截 /admin 路径，重定向到首页
  if (pathname.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  
  return NextResponse.next();
}

// 配置匹配的路径
export const config = {
  matcher: [
    '/admin/:path*',
  ],
};
