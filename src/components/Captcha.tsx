'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// 验证码字符集（排除容易混淆的 0/O, 1/l/I）
const CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';

interface CaptchaRef {
  refresh: () => void;
  getValue: () => string;
}

interface CaptchaProps {
  length?: number;
  width?: number;
  height?: number;
  onChange?: (value: string) => void;
}

// 生成随机验证码
function generateCode(length: number): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return code;
}

// 绘制验证码图片
function drawCaptcha(ctx: CanvasRenderingContext2D, code: string, width: number, height: number): void {
  // 背景
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, width, height);
  
  // 干扰线
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = `rgba(${Math.random() * 100 + 100}, ${Math.random() * 100 + 100}, ${Math.random() * 100 + 150}, 0.3)`;
    ctx.beginPath();
    ctx.moveTo(Math.random() * width, Math.random() * height);
    ctx.lineTo(Math.random() * width, Math.random() * height);
    ctx.stroke();
  }
  
  // 噪点
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = `rgba(${Math.random() * 100 + 100}, ${Math.random() * 100 + 100}, ${Math.random() * 100 + 150}, ${Math.random() * 0.5})`;
    ctx.fillRect(Math.random() * width, Math.random() * height, 2, 2);
  }
  
  // 绘制字符
  const fontSize = height * 0.6;
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  
  const charWidth = width / code.length;
  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const charY = height * 0.4 + Math.random() * height * 0.3;
    
    // 随机旋转
    const angle = (Math.random() - 0.5) * 0.4;
    ctx.save();
    ctx.translate(charWidth * (i + 0.5), charY);
    ctx.rotate(angle);
    
    // 颜色渐变
    const hue = Math.random() * 60 + 200; // 蓝色系
    ctx.fillStyle = `hsl(${hue}, 70%, 40%)`;
    
    ctx.fillText(char, -fontSize / 3, 0);
    ctx.restore();
  }
}

export function useCaptcha(props: CaptchaProps = {}) {
  const { length = 4, width = 120, height = 40 } = props;
  const [code, setCode] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const refresh = useCallback(() => {
    const newCode = generateCode(length);
    setCode(newCode);
    
    // 绘制到 canvas
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // 设置 canvas 尺寸
        canvas.width = width;
        canvas.height = height;
        drawCaptcha(ctx, newCode, width, height);
      }
    }
  }, [length, width, height]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { code, canvasRef, refresh };
}

export function CaptchaDisplay({ code, canvasRef }: { code: string; canvasRef: React.RefObject<HTMLCanvasElement | null> }) {
  return (
    <canvas
      ref={canvasRef}
      className="rounded-md cursor-pointer"
      style={{ imageRendering: 'pixelated' }}
      title="点击刷新验证码"
    />
  );
}

// 验证验证码（不区分大小写）
export function verifyCaptcha(input: string, code: string): boolean {
  return input.toLowerCase() === code.toLowerCase();
}
