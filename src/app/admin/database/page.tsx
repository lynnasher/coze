'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Database,
  Download,
  Upload,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';

export default function DatabasePage() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ success: boolean; message: string } | null>(null);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string; details?: string } | null>(null);

  // 导出数据库
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setExportResult(null);

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/export-db', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();

      if (!data.success) {
        setExportResult({ success: false, message: data.error || '导出失败' });
        return;
      }

      // 创建下载链接
      const sqlContent = data.sql || '';
      const blob = new Blob([sqlContent], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename || `database_export_${new Date().toISOString().slice(0, 10)}.sql`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setExportResult({ 
        success: true, 
        message: `成功导出 ${data.tables?.length || 0} 个表，共 ${data.totalRecords || 0} 条记录` 
      });
    } catch (error) {
      setExportResult({ success: false, message: '导出失败，请稍后重试' });
    } finally {
      setIsExporting(false);
    }
  }, []);

  // 导入数据库
  const handleImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      const content = await file.text();
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/import-db', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ sql: content }),
      });
      const data = await response.json();

      if (!data.success) {
        setImportResult({ 
          success: false, 
          message: data.error || '导入失败',
          details: data.details 
        });
        return;
      }

      setImportResult({ 
        success: true, 
        message: `成功导入 ${data.results?.length || 0} 个表` 
      });
    } catch (error) {
      setImportResult({ success: false, message: '导入失败，请稍后重试' });
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 页头 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-4">
              <Link href="/admin" className="flex items-center gap-2 text-slate-600 hover:text-slate-900">
                <ArrowLeft className="h-4 w-4" />
                <span>返回</span>
              </Link>
              <div className="h-4 w-px bg-slate-200" />
              <h1 className="text-lg font-semibold">数据库管理</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* 导出区域 */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Download className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">数据库导出</CardTitle>
                  <CardDescription>
                    将用户、激活码等数据导出为 SQL 文件
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={handleExport} 
                disabled={isExporting}
                className="w-full sm:w-auto"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    导出中...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    导出数据库
                  </>
                )}
              </Button>
              {exportResult && (
                <Alert variant={exportResult.success ? 'default' : 'destructive'} className={exportResult.success ? 'border-green-500 bg-green-50' : ''}>
                  {exportResult.success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <AlertDescription className={exportResult.success ? 'text-green-700' : ''}>
                    {exportResult.message}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* 导入区域 */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Upload className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">数据库导入</CardTitle>
                  <CardDescription>
                    从 SQL 文件导入数据（会清空目标表后导入）
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".sql"
                    onChange={handleImport}
                    className="hidden"
                    disabled={isImporting}
                  />
                  <Button variant="outline" asChild>
                    <span>
                      {isImporting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          导入中...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          选择 SQL 文件
                        </>
                      )}
                    </span>
                  </Button>
                </label>
                <span className="text-sm text-slate-500">
                  支持 .sql 格式文件
                </span>
              </div>
              {importResult && (
                <div className="space-y-2">
                  <Alert variant={importResult.success ? 'default' : 'destructive'} className={importResult.success ? 'border-green-500 bg-green-50' : ''}>
                    {importResult.success ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    <AlertDescription className={importResult.success ? 'text-green-700' : ''}>
                      {importResult.message}
                    </AlertDescription>
                  </Alert>
                  {importResult.details && (
                    <pre className="text-xs text-slate-600 bg-slate-100 p-2 rounded overflow-auto max-h-40">
                      {importResult.details}
                    </pre>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 说明 */}
          <Card className="bg-slate-50 border-dashed">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <Database className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                <div className="space-y-2 text-sm text-slate-600">
                  <p className="font-medium">使用说明</p>
                  <ul className="list-disc list-inside space-y-1 text-slate-500">
                    <li>导出的 SQL 文件包含用户、激活码等数据</li>
                    <li>导入时会先清空目标表，再插入新数据</li>
                    <li>建议先导出备份，再进行导入操作</li>
                    <li>导入仅支持 INSERT 语句格式的 SQL 文件</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
