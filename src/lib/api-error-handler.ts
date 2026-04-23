/**
 * API 错误处理中间件
 * 统一处理 API 请求中的错误响应
 */

export type ApiErrorCode = 
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR'
  | 'VALIDATION_ERROR'
  | 'DEVICE_KICKED'
  | 'UNKNOWN_ERROR';

export interface ApiErrorResponse {
  success: false;
  error: string;
  code: ApiErrorCode;
  details?: Record<string, string[]>;
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// 错误码对应的 HTTP 状态码
const ERROR_STATUS_MAP: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
  VALIDATION_ERROR: 422,
  DEVICE_KICKED: 403,
  UNKNOWN_ERROR: 500,
};

// 错误码对应的中文消息
const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  BAD_REQUEST: '请求参数错误',
  UNAUTHORIZED: '请先登录',
  FORBIDDEN: '没有权限执行此操作',
  NOT_FOUND: '请求的资源不存在',
  INTERNAL_ERROR: '服务器内部错误',
  VALIDATION_ERROR: '数据验证失败',
  DEVICE_KICKED: '您的账号已在其他设备登录',
  UNKNOWN_ERROR: '发生未知错误',
};

/**
 * 创建标准错误响应
 */
export function createErrorResponse(
  code: ApiErrorCode,
  customMessage?: string,
  details?: Record<string, string[]>
): ApiErrorResponse {
  return {
    success: false,
    error: customMessage || ERROR_MESSAGES[code],
    code,
    details,
  };
}

/**
 * 创建标准成功响应
 */
export function createSuccessResponse<T>(data: T, message?: string): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    message,
  };
}

/**
 * 获取错误对应的 HTTP 状态码
 */
export function getErrorStatusCode(code: ApiErrorCode): number {
  return ERROR_STATUS_MAP[code] || 500;
}

/**
 * 处理 API 路由中的错误
 * 在 API Route 中使用，统一返回错误响应
 */
export function handleApiError(error: unknown): Response {
  console.error('API Error:', error);

  // 处理已知错误类型
  if (error instanceof ApiError) {
    const response = createErrorResponse(error.code, error.message, error.details);
    return Response.json(response, { status: getErrorStatusCode(error.code) });
  }

  // 处理标准 Error
  if (error instanceof Error) {
    const response = createErrorResponse('INTERNAL_ERROR', error.message);
    return Response.json(response, { status: 500 });
  }

  // 未知错误
  const response = createErrorResponse('UNKNOWN_ERROR');
  return Response.json(response, { status: 500 });
}

/**
 * 自定义 API 错误类
 */
export class ApiError extends Error {
  code: ApiErrorCode;
  details?: Record<string, string[]>;

  constructor(code: ApiErrorCode, message?: string, details?: Record<string, string[]>) {
    super(message || ERROR_MESSAGES[code]);
    this.code = code;
    this.details = details;
    this.name = 'ApiError';
  }
}

/**
 * 验证请求数据
 * 在 API Route 中使用，验证失败时抛出 ApiError
 */
export function validateRequest<T>(
  data: unknown,
  validator: (data: unknown) => data is T,
  errorMessage = '请求数据格式不正确'
): T {
  if (!validator(data)) {
    throw new ApiError('VALIDATION_ERROR', errorMessage);
  }
  return data;
}

/**
 * 验证必填字段
 */
export function validateRequired(
  data: Record<string, unknown>,
  fields: string[]
): void {
  const missing: string[] = [];
  
  for (const field of fields) {
    const value = data[field];
    if (value === undefined || value === null || value === '') {
      missing.push(field);
    }
  }

  if (missing.length > 0) {
    throw new ApiError(
      'VALIDATION_ERROR',
      `缺少必填字段: ${missing.join(', ')}`,
      { missing: missing.map(f => `${f} 不能为空`) }
    );
  }
}

/**
 * 客户端错误处理助手
 * 用于前端调用 API 时统一处理错误
 */
export async function handleClientError(response: Response): Promise<never> {
  try {
    const errorData = await response.json();
    throw new ApiError(
      errorData.code || 'UNKNOWN_ERROR',
      errorData.error || `请求失败 (${response.status})`,
      errorData.details
    );
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError('UNKNOWN_ERROR', `请求失败 (${response.status})`);
  }
}

/**
 * 带重试的请求函数
 */
export async function fetchWithRetry<T>(
  url: string,
  options: RequestInit = {},
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        await handleClientError(response);
      }

      return await response.json();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // 如果是 4xx 错误，不重试
      if (error instanceof ApiError && 
          (error.code === 'BAD_REQUEST' || 
           error.code === 'UNAUTHORIZED' || 
           error.code === 'FORBIDDEN' || 
           error.code === 'NOT_FOUND' ||
           error.code === 'VALIDATION_ERROR')) {
        throw error;
      }

      // 最后一次尝试，抛出错误
      if (i === maxRetries - 1) {
        throw lastError;
      }

      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }

  throw lastError || new Error('请求失败');
}

/**
 * API 路由包装器
 * 自动处理错误响应
 */
export function withErrorHandler<T>(
  handler: (request: Request) => Promise<T>
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    try {
      const result = await handler(request);
      return Response.json(createSuccessResponse(result));
    } catch (error) {
      return handleApiError(error);
    }
  };
}
