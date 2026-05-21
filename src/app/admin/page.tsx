'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getLoginPath } from '@/lib/admin-config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  BookOpen,
  FileText,
  LogOut,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  BarChart3,
  Search,
  Download,
  FileJson,
  List,
  Folder,
  Plus,
  Database,
  GripVertical,
  User,
  Key,
} from 'lucide-react';

import { useAdminAuth, useBanks, useCategories, useExportDb, useImport } from './hooks';
import {
  SortableBankRow,
  ExportDbDialog,
  CategoryManageDialog,
  DeleteConfirmDialog,
  MoveCategoryDialog,
  EditBankDialog,
} from './components';
import type { QuestionBank, Category } from './types';
import { categoryColors } from './types';

export default function AdminPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, handleLogout } = useAdminAuth();
  const { banks, stats, isLoading: banksLoading, loadBanks, updateBankOrder, deleteBank, updateBank } = useBanks();
  const { categories, loadCategories, saveCategory, deleteCategory, getCategoryName, getCategoryColorClass } = useCategories();
  const { availableTables, loadingTables, fetchAvailableTables, exportDatabase } = useExportDb();
  const { isImporting, importJson } = useImport();

  // UI State
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [importCategory, setImportCategory] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Dialog State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [bankToDelete, setBankToDelete] = useState<QuestionBank | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isMoveCategoryDialogOpen, setIsMoveCategoryDialogOpen] = useState(false);
  const [bankToMove, setBankToMove] = useState<QuestionBank | null>(null);
  const [isExportDbDialogOpen, setIsExportDbDialogOpen] = useState(false);
  const [isEditBankDialogOpen, setIsEditBankDialogOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<QuestionBank | null>(null);
  const [editingBankName, setEditingBankName] = useState('');
  const [editingBankDesc, setEditingBankDesc] = useState('');

  // Inline editing state
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineEditingName, setInlineEditingName] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Filter and pagination
  const filteredBanks = useMemo(() => {
    return banks.filter((bank) => {
      const matchesSearch = bank.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (bank.description?.toLowerCase() || '').includes(searchTerm.toLowerCase());
      const matchesCategory = filterCategory === 'all' || bank.categoryId === filterCategory;
      return matchesSearch && matchesCategory;
    });
  }, [banks, searchTerm, filterCategory]);

  const totalPages = Math.ceil(filteredBanks.length / pageSize);
  const paginatedBanks = filteredBanks.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const groupedBanks = useMemo(() => {
    return paginatedBanks.reduce((acc, bank) => {
      const categoryId = bank.categoryId || 'uncategorized';
      if (!acc[categoryId]) acc[categoryId] = [];
      acc[categoryId].push(bank);
      return acc;
    }, {} as Record<string, QuestionBank[]>);
  }, [paginatedBanks]);

  // Handlers
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = banks.findIndex((b) => b.id === active.id);
    const newIndex = banks.findIndex((b) => b.id === over.id);

    const newBanks = [...banks];
    const [removed] = newBanks.splice(oldIndex, 1);
    newBanks.splice(newIndex, 0, removed);

    await updateBankOrder(newBanks);
  }, [banks, updateBankOrder]);

  const handleDelete = async () => {
    if (!bankToDelete) return;
    const result = await deleteBank(bankToDelete.id);
    if (result.success) {
      setSuccess('题库已删除');
    } else {
      setError(result.error || '删除失败');
    }
    setIsDeleteDialogOpen(false);
    setBankToDelete(null);
  };

  const handleJsonImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!importCategory) {
      setError('请先选择要导入的分类');
      e.target.value = '';
      return;
    }

    const result = await importJson(file, importCategory);
    if (result.success) {
      setSuccess(`成功导入 ${result.data?.count || 0} 道题目`);
      await loadBanks();
    } else {
      setError(result.error || '导入失败');
    }
    e.target.value = '';
  };

  const handleExportBank = async (bank: QuestionBank) => {
    try {
      const response = await fetch(`/api/admin/banks/export/${bank.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${bank.name}.docx`;
        a.click();
        window.URL.revokeObjectURL(url);
        setSuccess('导出成功');
      } else {
        setError('导出失败');
      }
    } catch {
      setError('导出失败');
    }
  };

  const handleMoveCategory = async (categoryId: string) => {
    if (!bankToMove) return;
    const result = await updateBank(bankToMove.id, { categoryId });
    if (result.success) {
      setSuccess('分类已更新');
    } else {
      setError(result.error || '更新失败');
    }
    setBankToMove(null);
  };

  const handleEditBankSave = async () => {
    if (!editingBank) return;
    const result = await updateBank(editingBank.id, {
      name: editingBankName,
      description: editingBankDesc,
    });
    if (result.success) {
      setSuccess('题库信息已更新');
      setIsEditBankDialogOpen(false);
      setEditingBank(null);
    } else {
      setError(result.error || '更新失败');
    }
  };

  const handleInlineEditStart = (bank: QuestionBank) => {
    setInlineEditingId(bank.id);
    setInlineEditingName(bank.name);
  };

  const handleInlineEditSave = async () => {
    if (!inlineEditingId) return;
    const result = await updateBank(inlineEditingId, { name: inlineEditingName });
    if (result.success) {
      setInlineEditingId(null);
    } else {
      setError(result.error || '保存失败');
    }
  };

  const handleInlineEditCancel = () => {
    setInlineEditingId(null);
    setInlineEditingName('');
  };

  const handleExportDatabase = async (selectedTables: string[]) => {
    const result = await exportDatabase(selectedTables);
    if (result.success) {
      const blob = new Blob([result.data?.sql || ''], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `database_export_${new Date().toISOString().slice(0, 10)}.sql`;
      a.click();
      window.URL.revokeObjectURL(url);
      setSuccess('数据库导出成功');
    } else {
      setError(result.error || '导出失败');
    }
  };

  const openMoveCategoryDialog = (bank: QuestionBank) => {
    setBankToMove(bank);
    setIsMoveCategoryDialogOpen(true);
  };

  const openEditBankDialog = (bank: QuestionBank) => {
    setEditingBank(bank);
    setEditingBankName(bank.name);
    setEditingBankDesc(bank.description || '');
    setIsEditBankDialogOpen(true);
  };

  const openDeleteDialog = (bank: QuestionBank) => {
    setBankToDelete(bank);
    setIsDeleteDialogOpen(true);
  };

  const openExportDbDialog = () => {
    fetchAvailableTables();
    setIsExportDbDialogOpen(true);
  };

  const goToBankEdit = (bank: QuestionBank) => {
    router.push(`/admin/bank/${bank.id}`);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BookOpen className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold">题库管理后台</h1>
              <p className="text-sm text-slate-500">管理您的题库资源</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={loadBanks} disabled={banksLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${banksLoading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              退出登录
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="mb-6 border-green-500 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700">{success}</AlertDescription>
          </Alert>
        )}

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">题库总数</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalBanks}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">题目总数</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalQuestions}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">分类数量</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{categories.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">平均正确率</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {stats.totalQuestions > 0
                  ? Math.round((banks.reduce((s, b) => s + (b.correctRate || 0) * (b.questionCount || 0), 0) / stats.totalQuestions) * 100)
                  : 0}%
              </div>
            </CardContent>
          </Card>

          {/* 用户管理入口 */}
          <Link href="/admin/users">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                  <User className="h-4 w-4 text-purple-500" />
                  用户管理
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">管理</div>
              </CardContent>
            </Card>
          </Link>

          {/* 激活码管理入口 */}
          <Link href="/admin/codes">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                  <Key className="h-4 w-4 text-green-500" />
                  激活码管理
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">生成</div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* 操作栏 */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 flex gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="搜索题库..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="pl-10"
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e) => { setFilterCategory(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 border rounded-md bg-white text-sm"
            >
              <option value="all">所有分类</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {(cat.depth || 0) > 0
                    ? `${'  '.repeat(cat.depth || 0)}└ ${cat.name}`
                    : cat.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsCategoryModalOpen(true)}>
              <Folder className="h-4 w-4 mr-2" />
              分类管理
            </Button>
            <Button variant="outline" onClick={openExportDbDialog}>
              <Database className="h-4 w-4 mr-2" />
              导出数据库
            </Button>
            <div className="flex items-center gap-2">
              <select
                value={importCategory}
                onChange={(e) => setImportCategory(e.target.value)}
                className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">选择导入分类</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {(cat.depth || 0) > 0
                      ? `${'  '.repeat(cat.depth || 0)}└ ${cat.name}`
                      : cat.name}
                  </option>
                ))}
              </select>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleJsonImport}
                  className="hidden"
                  disabled={isImporting}
                />
                <Button variant="outline" asChild>
                  <span>
                    <FileJson className="h-4 w-4 mr-2" />
                    {isImporting ? '导入中...' : '导入JSON'}
                  </span>
                </Button>
              </label>
            </div>
            <Link href="/admin/create">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                新建题库
              </Button>
            </Link>
          </div>
        </div>

        {/* 题库列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <List className="h-5 w-5" />
              题库列表
            </CardTitle>
          </CardHeader>
          <CardContent>
            {banks.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <p>暂无题库，点击"新建题库"开始创建</p>
              </div>
            ) : filteredBanks.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Search className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <p>没有找到匹配的题库</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedBanks).map(([categoryId, categoryBanks]) => {
                  const category = categories.find((c) => c.id === categoryId);
                  return (
                    <div key={categoryId}>
                      <h3 className="text-sm font-medium text-slate-500 mb-3 flex items-center gap-2">
                        <Folder className="h-4 w-4" />
                        {categoryId === 'uncategorized'
                          ? '未分类'
                          : category?.parentId
                          ? `  ├ ${category?.name}`
                          : category?.name}
                      </h3>
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={categoryBanks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-10"></TableHead>
                                <TableHead>题库名称</TableHead>
                                <TableHead>题目数量</TableHead>
                                <TableHead>创建时间</TableHead>
                                <TableHead className="text-right">操作</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {categoryBanks.map((bank) => (
                                <SortableBankRow
                                  key={bank.id}
                                  bank={bank}
                                  onEdit={() => handleInlineEditStart(bank)}
                                  onDelete={() => openDeleteDialog(bank)}
                                  onClick={() => goToBankEdit(bank)}
                                  onMoveCategory={() => openMoveCategoryDialog(bank)}
                                  onEditQuestions={() => goToBankEdit(bank)}
                                  onExportWord={() => handleExportBank(bank)}
                                  isEditing={inlineEditingId === bank.id}
                                  editingName={inlineEditingName}
                                  onEditingNameChange={setInlineEditingName}
                                  onSave={handleInlineEditSave}
                                  onCancel={handleInlineEditCancel}
                                />
                              ))}
                            </TableBody>
                          </Table>
                        </SortableContext>
                      </DndContext>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <Button variant="outline" size="sm" onClick={() => handlePageChange(1)} disabled={currentPage === 1}>
              首页
            </Button>
            <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>
              上一页
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handlePageChange(pageNum)}
                    className="w-10"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>
              下一页
            </Button>
            <Button variant="outline" size="sm" onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages}>
              末页
            </Button>
          </div>
        )}
      </main>

      {/* Dialogs */}
      <ExportDbDialog
        open={isExportDbDialogOpen}
        onOpenChange={setIsExportDbDialogOpen}
        availableTables={availableTables}
        loadingTables={loadingTables}
        onExport={handleExportDatabase}
      />

      <CategoryManageDialog
        open={isCategoryModalOpen}
        onOpenChange={setIsCategoryModalOpen}
        categories={categories}
        onSave={saveCategory}
        onDelete={deleteCategory}
      />

      <DeleteConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        bank={bankToDelete}
        onConfirm={handleDelete}
      />

      <MoveCategoryDialog
        open={isMoveCategoryDialogOpen}
        onOpenChange={setIsMoveCategoryDialogOpen}
        bank={bankToMove}
        categories={categories}
        onConfirm={handleMoveCategory}
      />

      <EditBankDialog
        open={isEditBankDialogOpen}
        onOpenChange={setIsEditBankDialogOpen}
        bankName={editingBankName}
        bankDesc={editingBankDesc}
        onNameChange={setEditingBankName}
        onDescChange={setEditingBankDesc}
        onSave={handleEditBankSave}
      />
    </div>
  );
}
