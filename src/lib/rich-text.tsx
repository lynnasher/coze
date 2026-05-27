'use client';

import React, { useState, useEffect } from 'react';

// 判断是否为对象存储的 key（不是完整 URL）
function isObjectStorageKey(url: string): boolean {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return false;
  }
  if (url.startsWith('data:')) {
    return false;
  }
  return true;
}

// 判断是否为相对路径
function isRelativePath(url: string): boolean {
  return url.startsWith('/') || url.startsWith('./') || url.startsWith('../');
}

// 缓存签名 URL
const signedUrlCache = new Map<string, string>();

// 获取缓存的签名 URL
function getCachedSignedUrl(key: string): string | null {
  return signedUrlCache.get(key) || null;
}

// 设置缓存的签名 URL
function setCachedSignedUrl(key: string, url: string): void {
  signedUrlCache.set(key, url);
}

/**
 * 渲染带 sub/sup 标签的文本
 * 将 <sub>和<sup> 标签转换为对应的 React 元素
 */
function renderTextWithSubSup(text: string): React.ReactNode {
  // 匹配 <sub>text</sub> 或 <sup>text</sup>
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const regex = /<(sub|sup)>(.*?)<\/(sub|sup)>/gi;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const [fullMatch, tag, content] = match;
    const matchIndex = match.index;

    // 添加标签前的文本
    if (matchIndex > lastIndex) {
      parts.push(text.slice(lastIndex, matchIndex));
    }

    // 根据标签类型创建对应的元素
    if (tag.toLowerCase() === 'sub') {
      parts.push(<sub key={parts.length}>{content}</sub>);
    } else if (tag.toLowerCase() === 'sup') {
      parts.push(<sup key={parts.length}>{content}</sup>);
    }

    lastIndex = matchIndex + fullMatch.length;
  }

  // 添加剩余的文本
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

/**
 * 解析富文本内容，提取文本和图片
 * 支持格式：
 * - HTML: <img src="..." alt="..." /> 或 <img src="..."/>
 * - Markdown: ![alt](url)
 * - 带样式的HTML: <p><img src="..."/></p>
 */
export function parseRichContent(content: string): Array<{ type: 'text' | 'image'; value: string; alt?: string }> {
  const parts: Array<{ type: 'text' | 'image'; value: string; alt?: string }> = [];
  
  if (!content) return parts;

  // 先将 <br/> 或 <br> 标签转换为换行符
  content = content.replace(/<br\s*\/?>/gi, '\n');
  // 去除 <strong> 和 <b> 标签，保留内容
  content = content.replace(/<\/?(strong|b)\s*\/?>/gi, '');
  // 清理连续换行符（3个以上转为2个）
  content = content.replace(/\n{3,}/g, '\n\n');

  // 处理 HTML img 标签
  const htmlImgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const mdImgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;

  let lastIndex = 0;
  let htmlMatch;

  // 先处理 HTML img 标签
  while ((htmlMatch = htmlImgRegex.exec(content)) !== null) {
    // 添加 img 标签之前的文本
    if (htmlMatch.index > lastIndex) {
      const text = content.slice(lastIndex, htmlMatch.index);
      if (text.trim()) {
        parts.push({ type: 'text', value: text.trim() });
      }
    }
    
    // 添加图片
    const srcMatch = htmlMatch[0].match(/src=["']([^"']+)["']/i);
    const altMatch = htmlMatch[0].match(/alt=["']([^"']+)["']/i);
    if (srcMatch) {
      parts.push({
        type: 'image',
        value: srcMatch[1],
        alt: altMatch ? altMatch[1] : undefined
      });
    }
    
    lastIndex = htmlMatch.index + htmlMatch[0].length;
  }

  // 如果有 HTML img 标签已经处理完，处理 Markdown 图片和剩余文本
  if (lastIndex > 0) {
    // 处理剩余文本中的 Markdown 图片
    const remainingText = content.slice(lastIndex);
    let mdMatch;
    let processedText = remainingText;
    
    while ((mdMatch = mdImgRegex.exec(remainingText)) !== null) {
      const beforeMd = processedText.slice(0, mdMatch.index);
      if (beforeMd.trim()) {
        parts.push({ type: 'text', value: beforeMd.trim() });
      }
      parts.push({
        type: 'image',
        value: mdMatch[2],
        alt: mdMatch[1] || undefined
      });
      processedText = processedText.slice(mdMatch.index + mdMatch[0].length);
    }
    
    if (processedText.trim()) {
      parts.push({ type: 'text', value: processedText.trim() });
    }
  } else {
    // 没有 HTML img 标签，处理 Markdown 图片
    let processedText = content;
    let mdMatch;
    let offset = 0;

    while ((mdMatch = mdImgRegex.exec(content)) !== null) {
      const beforeMd = processedText.slice(0, mdMatch.index - offset);
      if (beforeMd.trim()) {
        parts.push({ type: 'text', value: beforeMd.trim() });
      }
      parts.push({
        type: 'image',
        value: mdMatch[2],
        alt: mdMatch[1] || undefined
      });
      processedText = processedText.slice(mdMatch.index + mdMatch[0].length - offset);
      offset = mdMatch.index + mdMatch[0].length;
    }

    if (processedText.trim()) {
      parts.push({ type: 'text', value: processedText.trim() });
    }
  }

  // 如果 parts 为空，说明没有匹配到任何内容，直接返回原文
  if (parts.length === 0 && content.trim()) {
    parts.push({ type: 'text', value: content.trim() });
  }

  return parts;
}

/**
 * 图片组件，处理对象存储 key 和相对路径
 */
function RichTextImage({ src, alt, className }: { src: string; alt?: string; className?: string }) {
  const [imageUrl, setImageUrl] = useState<string>(src);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // 如果不是对象存储 key，直接使用
    if (!isObjectStorageKey(src)) {
      setImageUrl(src);
      return;
    }

    // 处理相对路径：移除开头的 ./ 或 /
    const cacheKey = isRelativePath(src) ? src.replace(/^\.?\//, '') : src;
    
    // 检查缓存
    const cached = getCachedSignedUrl(cacheKey);
    if (cached) {
      setImageUrl(cached);
      return;
    }

    // 异步获取签名 URL
    setIsLoading(true);
    fetch(`/api/image/signed-url?key=${encodeURIComponent(cacheKey)}`)
      .then(res => res.json())
      .then(data => {
        if (data.url) {
          setCachedSignedUrl(cacheKey, data.url);
          setImageUrl(data.url);
        } else {
          // 获取失败，回退到原路径
          setImageUrl(src);
        }
      })
      .catch(err => {
        console.error('Failed to get signed URL:', err);
        setImageUrl(src);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [src]);

  return (
    <>
      <img
        src={imageUrl}
        alt={alt || '题目图片'}
        className={`max-w-full h-auto my-2 rounded ${className}`}
        loading="lazy"
      />
      {isLoading && (
        <div className="w-full h-20 bg-gray-100 animate-pulse rounded my-2 flex items-center justify-center">
          <span className="text-xs text-gray-400">加载图片...</span>
        </div>
      )}
    </>
  );
}

/**
 * 富文本渲染组件
 */
interface RichTextProps {
  content: string;
  className?: string;
  imageClassName?: string;
  textClassName?: string;
}

export function RichText({ content, className = '', imageClassName = '', textClassName = '' }: RichTextProps) {
  const parts = React.useMemo(() => parseRichContent(content), [content]);

  if (parts.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      {parts.map((part, index) => {
        if (part.type === 'image') {
          return (
            <RichTextImage
              key={index}
              src={part.value}
              alt={part.alt}
              className={imageClassName}
            />
          );
        }
        return (
          <span key={index} className={textClassName}>
            {part.value}
          </span>
        );
      })}
    </div>
  );
}

/**
 * 带换行符处理的富文本渲染
 */
export function RichTextWithBreaks({ content, className = '', imageClassName = '', textClassName = '' }: RichTextProps) {
  const parts = React.useMemo(() => parseRichContent(content), [content]);

  if (parts.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      {parts.map((part, index) => {
        if (part.type === 'image') {
          return (
            <RichTextImage
              key={index}
              src={part.value}
              alt={part.alt}
              className={imageClassName}
            />
          );
        }
        // 将换行符转换为 <br/>，并处理 <sub> 和 <sup> 标签
        return (
          <span key={index} className={textClassName}>
            {part.value.split('\n').map((line, i, arr) => (
              <React.Fragment key={i}>
                {renderTextWithSubSup(line)}
                {i < arr.length - 1 && <br />}
              </React.Fragment>
            ))}
          </span>
        );
      })}
    </div>
  );
}
