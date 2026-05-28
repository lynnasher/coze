/**
 * 统一 API 客户端
 * 封装后台管理相关的 API 调用，自动处理认证、错误处理等
 */

import { toast } from "sonner";
import { STORAGE_KEYS } from "./constants";

// 获取认证令牌
function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
}

// 处理 401 未授权
function handleUnauthorized() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.ADMIN_USER);
    window.location.href = "/admin/login";
  }
}

// 基础请求函数
async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // 处理 401 未授权
  if (response.status === 401) {
    handleUnauthorized();
    throw new Error("登录已过期，请重新登录");
  }

  // 处理其他错误
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error || `请求失败: ${response.status}`;
    throw new Error(errorMessage);
  }

  // 解析响应
  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return response.json() as Promise<T>;
  }

  return response as unknown as Promise<T>;
}

// API 客户端对象
export const apiClient = {
  /**
   * GET 请求
   */
  get<T>(url: string): Promise<T> {
    return request<T>(url, { method: "GET" });
  },

  /**
   * POST 请求
   */
  post<T>(url: string, body: unknown): Promise<T> {
    return request<T>(url, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  /**
   * PUT 请求
   */
  put<T>(url: string, body: unknown): Promise<T> {
    return request<T>(url, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  /**
   * DELETE 请求
   */
  delete<T>(url: string): Promise<T> {
    return request<T>(url, { method: "DELETE" });
  },

  /**
   * 获取 Blob（用于文件下载）
   */
  async getBlob(url: string): Promise<Blob> {
    const token = getToken();
    const headers: Record<string, string> = {};

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    if (response.status === 401) {
      handleUnauthorized();
      throw new Error("登录已过期，请重新登录");
    }

    if (!response.ok) {
      throw new Error(`请求失败: ${response.status}`);
    }

    return response.blob();
  },
};

/**
 * 带错误提示的 API 调用包装器
 */
export const api = {
  async get<T>(url: string, errorMessage?: string): Promise<T | null> {
    try {
      return await apiClient.get<T>(url);
    } catch (error) {
      const msg = errorMessage || "获取数据失败";
      toast.error(msg);
      console.error(`API GET ${url} failed:`, error);
      return null;
    }
  },

  async post<T>(
    url: string,
    body: unknown,
    successMessage?: string,
    errorMessage?: string
  ): Promise<T | null> {
    try {
      const result = await apiClient.post<T>(url, body);
      if (successMessage) {
        toast.success(successMessage);
      }
      return result;
    } catch (error) {
      const msg = errorMessage || "操作失败";
      toast.error(msg);
      console.error(`API POST ${url} failed:`, error);
      return null;
    }
  },

  async put<T>(
    url: string,
    body: unknown,
    successMessage?: string,
    errorMessage?: string
  ): Promise<T | null> {
    try {
      const result = await apiClient.put<T>(url, body);
      if (successMessage) {
        toast.success(successMessage);
      }
      return result;
    } catch (error) {
      const msg = errorMessage || "更新失败";
      toast.error(msg);
      console.error(`API PUT ${url} failed:`, error);
      return null;
    }
  },

  async delete<T>(
    url: string,
    successMessage?: string,
    errorMessage?: string
  ): Promise<T | null> {
    try {
      const result = await apiClient.delete<T>(url);
      if (successMessage) {
        toast.success(successMessage);
      }
      return result;
    } catch (error) {
      const msg = errorMessage || "删除失败";
      toast.error(msg);
      console.error(`API DELETE ${url} failed:`, error);
      return null;
    }
  },
};
