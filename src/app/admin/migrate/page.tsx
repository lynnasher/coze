'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft, Database, CheckCircle, AlertTriangle, Copy } from 'lucide-react';
import Link from 'next/link';

export default function MigratePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; message?: string; sql?: string; instructions?: string[] } | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const checkMigrationStatus = async () => {
    try {
      const response = await fetch('/api/admin/migrate');
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError('检查迁移状态失败');
    }
  };

  useEffect(() => {
    checkMigrationStatus();
  }, []);

  const runMigration = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/admin/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'add_device_id' })
      });
      
      const data = await response.json();
      setResult(data);
      
      if (!data.success) {
        setError(data.message || data.error || '迁移失败');
      }
    } catch (err) {
      setError('执行迁移失败，请手动执行 SQL');
    } finally {
      setLoading(false);
    }
  };

  const copySQL = () => {
    if (result?.sql) {
      navigator.clipboard.writeText(result.sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              返回管理
            </Button>
          </Link>
          <h1 className="font-semibold">数据库迁移</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              单设备登录功能迁移
            </CardTitle>
            <CardDescription>
              添加 device_id 字段到 users 表，启用单设备登录功能
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* 状态显示 */}
            {result?.success && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <AlertTitle className="text-green-800">迁移完成</AlertTitle>
                <AlertDescription className="text-green-700">
                  {result.message}
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert className="bg-amber-50 border-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <AlertTitle className="text-amber-800">需要手动迁移</AlertTitle>
                <AlertDescription className="text-amber-700">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            {/* SQL 代码块 */}
            {(result?.sql || !result?.success) && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">执行以下 SQL：</h3>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={copySQL}
                    className="gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    {copied ? '已复制' : '复制'}
                  </Button>
                </div>
                
                <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{result?.sql || `ALTER TABLE users ADD COLUMN device_id VARCHAR(100);
CREATE INDEX users_device_idx ON users(device_id);`}</code>
                </pre>
              </div>
            )}

            {/* 操作步骤 */}
            {result?.instructions && (
              <div className="space-y-3">
                <h3 className="font-medium">操作步骤：</h3>
                <ol className="space-y-2 text-sm text-gray-600 list-decimal list-inside">
                  {result.instructions.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ol>
              </div>
            )}

            {/* 手动步骤（默认显示） */}
            {!result?.success && (
              <div className="space-y-3">
                <h3 className="font-medium">手动迁移步骤：</h3>
                <ol className="space-y-2 text-sm text-gray-600 list-decimal list-inside bg-gray-50 p-4 rounded-lg">
                  <li>登录 Supabase 控制台 (https://app.supabase.com)</li>
                  <li>选择你的项目</li>
                  <li>点击左侧 &quot;SQL Editor&quot;</li>
                  <li>创建 New query</li>
                  <li>粘贴上面的 SQL 代码</li>
                  <li>点击 Run 执行</li>
                  <li>返回应用刷新页面，重新登录</li>
                </ol>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-3">
              <Button 
                onClick={runMigration}
                disabled={loading || result?.success}
                className="gap-2"
              >
                {loading ? '执行中...' : '检查并迁移'}
              </Button>
              
              <Button 
                variant="outline" 
                onClick={checkMigrationStatus}
                disabled={loading}
              >
                刷新状态
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 说明卡片 */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>关于单设备登录</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600 space-y-2">
            <p>单设备登录功能确保一个用户账号只能在一台设备上在线。</p>
            <p>当用户在新的设备登录时，之前登录的设备会自动被挤下线。</p>
            <p>这可以防止账号被多人同时使用，保护用户数据安全。</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
