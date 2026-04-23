/**
 * VirtualList 组件 - 虚拟列表
 * 用于优化大数据量的列表渲染性能
 * 只渲染可视区域内的项目
 */

'use client';

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface VirtualListProps<T> {
  // 数据列表
  items: T[];
  
  // 渲染函数
  renderItem: (item: T, index: number) => React.ReactNode;
  
  // 项目高度（固定高度模式）或高度获取函数（动态高度模式）
  itemHeight: number | ((item: T, index: number) => number);
  
  // 容器高度
  containerHeight: number;
  
  // 上下缓冲区大小（额外渲染的项目数）
  overscan?: number;
  
  // 容器类名
  className?: string;
  
  // 项目类名
  itemClassName?: string;
  
  // 空状态显示
  emptyComponent?: React.ReactNode;
  
  // 加载更多回调
  onLoadMore?: () => void;
  
  // 是否有更多数据
  hasMore?: boolean;
  
  // 加载状态
  loading?: boolean;
  
  // 点击项目回调
  onItemClick?: (item: T, index: number) => void;
  
  // 当前选中索引
  selectedIndex?: number;
  
  // 滚动到指定索引
  scrollToIndex?: number;
  
  // 滚动回调
  onScroll?: (scrollTop: number) => void;
}

export function VirtualList<T>({
  items,
  renderItem,
  itemHeight,
  containerHeight,
  overscan = 5,
  className,
  itemClassName,
  emptyComponent,
  onLoadMore,
  hasMore = false,
  loading = false,
  onItemClick,
  selectedIndex,
  scrollToIndex,
  onScroll,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // 是否使用固定高度
  const isFixedHeight = typeof itemHeight === 'number';
  
  // 计算总高度
  const totalHeight = useMemo(() => {
    if (isFixedHeight) {
      return items.length * itemHeight;
    }
    // 动态高度模式：需要缓存高度计算结果
    return items.reduce((sum, item, index) => sum + itemHeight(item, index), 0);
  }, [items, itemHeight, isFixedHeight]);
  
  // 计算可视区域的项目范围
  const visibleRange = useMemo(() => {
    if (isFixedHeight) {
      const height = itemHeight as number;
      const startIndex = Math.max(0, Math.floor(scrollTop / height) - overscan);
      const visibleCount = Math.ceil(containerHeight / height);
      const endIndex = Math.min(
        items.length - 1,
        startIndex + visibleCount + overscan * 2
      );
      return { startIndex, endIndex };
    }
    
    // 动态高度模式
    let currentHeight = 0;
    let startIndex = 0;
    let endIndex = 0;
    const getHeight = itemHeight as (item: T, index: number) => number;
    
    // 找到起始索引
    for (let i = 0; i < items.length; i++) {
      const h = getHeight(items[i], i);
      if (currentHeight + h > scrollTop) {
        startIndex = Math.max(0, i - overscan);
        break;
      }
      currentHeight += h;
    }
    
    // 找到结束索引
    currentHeight = 0;
    for (let i = 0; i < items.length; i++) {
      const h = getHeight(items[i], i);
      currentHeight += h;
      if (currentHeight > scrollTop + containerHeight) {
        endIndex = Math.min(items.length - 1, i + overscan);
        break;
      }
    }
    
    if (endIndex === 0) {
      endIndex = items.length - 1;
    }
    
    return { startIndex, endIndex };
  }, [scrollTop, containerHeight, items, itemHeight, overscan, isFixedHeight]);
  
  // 计算偏移量
  const offsetY = useMemo(() => {
    if (isFixedHeight) {
      return visibleRange.startIndex * (itemHeight as number);
    }
    
    // 动态高度模式
    let offset = 0;
    const getHeight = itemHeight as (item: T, index: number) => number;
    for (let i = 0; i < visibleRange.startIndex; i++) {
      offset += getHeight(items[i], i);
    }
    return offset;
  }, [visibleRange.startIndex, items, itemHeight, isFixedHeight]);
  
  // 可视项目
  const visibleItems = useMemo(() => {
    return items
      .slice(visibleRange.startIndex, visibleRange.endIndex + 1)
      .map((item, index) => ({
        item,
        index: visibleRange.startIndex + index,
      }));
  }, [items, visibleRange]);
  
  // 滚动处理
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;
    setScrollTop(newScrollTop);
    onScroll?.(newScrollTop);
    
    // 滚动状态管理
    setIsScrolling(true);
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 150);
    
    // 加载更多检测
    if (onLoadMore && hasMore && !loading) {
      const { scrollHeight, clientHeight } = e.currentTarget;
      const scrollBottom = newScrollTop + clientHeight;
      if (scrollBottom >= scrollHeight - containerHeight) {
        onLoadMore();
      }
    }
  }, [onLoadMore, hasMore, loading, containerHeight, onScroll]);
  
  // 滚动到指定索引
  useEffect(() => {
    if (scrollToIndex !== undefined && containerRef.current) {
      let targetScrollTop = 0;
      if (isFixedHeight) {
        targetScrollTop = scrollToIndex * (itemHeight as number);
      } else {
        const getHeight = itemHeight as (item: T, index: number) => number;
        for (let i = 0; i < scrollToIndex; i++) {
          targetScrollTop += getHeight(items[i], i);
        }
      }
      containerRef.current.scrollTop = targetScrollTop;
    }
  }, [scrollToIndex, items, itemHeight, isFixedHeight]);
  
  // 清理
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);
  
  // 空状态
  if (items.length === 0) {
    return (
      <div
        className={cn('overflow-auto', className)}
        style={{ height: containerHeight }}
      >
        {emptyComponent || (
          <div className="flex items-center justify-center h-full text-slate-400">
            暂无数据
          </div>
        )}
      </div>
    );
  }
  
  return (
    <div
      ref={containerRef}
      className={cn('overflow-auto', className)}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      {/* 占位容器 */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {/* 可视项目容器 */}
        <div
          style={{
            position: 'absolute',
            top: offsetY,
            left: 0,
            right: 0,
          }}
        >
          {visibleItems.map(({ item, index }) => (
            <div
              key={index}
              className={cn(
                itemClassName,
                selectedIndex === index && 'bg-blue-50',
                onItemClick && 'cursor-pointer hover:bg-slate-50'
              )}
              style={{
                height: isFixedHeight ? itemHeight : undefined,
              }}
              onClick={() => onItemClick?.(item, index)}
            >
              {renderItem(item, index)}
            </div>
          ))}
        </div>
        
        {/* 加载更多指示器 */}
        {loading && (
          <div className="absolute bottom-0 left-0 right-0 py-4 text-center text-sm text-slate-400">
            加载中...
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== 简化版虚拟列表 ====================

interface SimpleVirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight: number;
  className?: string;
  overscan?: number;
}

/**
 * 简化版虚拟列表 - 固定高度模式
 */
export function SimpleVirtualList<T>({
  items,
  renderItem,
  itemHeight,
  className,
  overscan = 3,
}: SimpleVirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  
  // 监听容器高度变化
  useEffect(() => {
    if (!containerRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    
    resizeObserver.observe(containerRef.current);
    setContainerHeight(containerRef.current.clientHeight);
    
    return () => resizeObserver.disconnect();
  }, []);
  
  // 计算可视范围
  const { startIndex, endIndex, offsetY } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const end = Math.min(items.length - 1, start + visibleCount + overscan * 2);
    const offset = start * itemHeight;
    return { startIndex: start, endIndex: end, offsetY: offset };
  }, [scrollTop, containerHeight, itemHeight, items.length, overscan]);
  
  // 总高度
  const totalHeight = items.length * itemHeight;
  
  // 可视项目
  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex + 1).map((item, idx) => ({
      item,
      index: startIndex + idx,
    }));
  }, [items, startIndex, endIndex]);
  
  return (
    <div
      ref={containerRef}
      className={cn('overflow-auto h-full', className)}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map(({ item, index }) => (
            <div key={index} style={{ height: itemHeight }}>
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
