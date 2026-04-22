'use client';

import { useState, useEffect, useCallback } from 'react';

// 判断是否为对象存储的 key（不是完整 URL）
function isObjectStorageKey(url: string): boolean {
  // 跳过已经是完整 URL 的
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return false;
  }
  // 跳过 data URL
  if (url.startsWith('data:')) {
    return false;
  }
  // 相对路径（以 / 开头）或对象存储 key 都需要处理
  return true;
}

// 判断是否为相对路径
function isRelativePath(url: string): boolean {
  return url.startsWith('/') || url.startsWith('./') || url.startsWith('../');
}

// 缓存签名 URL
const signedUrlCache = new Map<string, string>();

interface UseImageUrlResult {
  url: string;
  isLoading: boolean;
  error: string | null;
}

/**
 * 获取图片的显示 URL
 * - 对象存储 key -> 转换为签名 URL
 * - 相对路径 -> 尝试作为 key 获取签名 URL
 * - 完整 URL -> 直接使用
 */
export function useImageUrl(src: string | undefined): UseImageUrlResult {
  const [result, setResult] = useState<UseImageUrlResult>({
    url: src || '',
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    if (!src) {
      setResult({ url: '', isLoading: false, error: null });
      return;
    }

    // 如果是完整 URL 或 data URL，直接使用
    if (!isObjectStorageKey(src)) {
      setResult({ url: src, isLoading: false, error: null });
      return;
    }

    // 检查缓存
    const cacheKey = isRelativePath(src) ? src.replace(/^\.?\//, '') : src;
    if (signedUrlCache.has(cacheKey)) {
      setResult({ url: signedUrlCache.get(cacheKey)!, isLoading: false, error: null });
      return;
    }

    // 异步获取签名 URL
    let cancelled = false;
    setResult(prev => ({ ...prev, isLoading: true }));

    fetch(`/api/image/signed-url?key=${encodeURIComponent(cacheKey)}`)
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        if (data.url) {
          signedUrlCache.set(cacheKey, data.url);
          setResult({ url: data.url, isLoading: false, error: null });
        } else {
          // 如果获取签名失败，尝试直接使用原路径
          setResult({ url: src, isLoading: false, error: null });
        }
      })
      .catch(err => {
        if (cancelled) return;
        console.error('Failed to get signed URL:', err);
        // 出错时回退到原路径
        setResult({ url: src, isLoading: false, error: null });
      });

    return () => {
      cancelled = true;
    };
  }, [src]);

  return result;
}

/**
 * 批量预加载图片 URL
 */
export function usePreloadImageUrls(srcs: string[]) {
  const [loaded, setLoaded] = useState<Set<string>>(new Set());

  useEffect(() => {
    const keysToLoad = srcs
      .filter(src => isObjectStorageKey(src))
      .map(src => isRelativePath(src) ? src.replace(/^\.?\//, '') : src)
      .filter(key => !signedUrlCache.has(key) && !loaded.has(key));

    if (keysToLoad.length === 0) return;

    // 批量获取签名 URL
    Promise.all(
      keysToLoad.map(key =>
        fetch(`/api/image/signed-url?key=${encodeURIComponent(key)}`)
          .then(res => res.json())
          .then(data => {
            if (data.url) {
              signedUrlCache.set(key, data.url);
            }
            return key;
          })
          .catch(() => key)
      )
    ).then(() => {
      setLoaded(prev => new Set([...prev, ...keysToLoad]));
    });
  }, [srcs, loaded]);

  return loaded;
}
