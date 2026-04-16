'use client';

import React from 'react';

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
            <img
              key={index}
              src={part.value}
              alt={part.alt || '题目图片'}
              className={`max-w-full h-auto my-2 rounded ${imageClassName}`}
              loading="lazy"
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
            <img
              key={index}
              src={part.value}
              alt={part.alt || '题目图片'}
              className={`max-w-full h-auto my-2 rounded ${imageClassName}`}
              loading="lazy"
            />
          );
        }
        // 将换行符转换为 <br/>
        return (
          <span key={index} className={textClassName}>
            {part.value.split('\n').map((line, i, arr) => (
              <React.Fragment key={i}>
                {line}
                {i < arr.length - 1 && <br />}
              </React.Fragment>
            ))}
          </span>
        );
      })}
    </div>
  );
}
