'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getLoginPath } from '@/lib/admin-config';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
                <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold">题库管理后台</h1>
                <p className="text-xs sm:text-sm text-slate-500">管理您的题库资源</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Button variant="outline" size="sm" onClick={loadBanks} disabled={banksLoading}>
                <RefreshCw className={`h-4 w-4 mr-1.5 ${banksLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">刷新</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">退出登录</span>
              </Button>
            </div>
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

        {/* 统计卡片 - 第一行 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
          <Card className="col-span-1 p-2">
            <div className="text-[10px] sm:text-xs text-slate-500 leading-none mb-1">题库总数</div>
            <div className="text-base sm:text-xl font-bold leading-none">{stats.totalBanks}</div>
          </Card>
          <Card className="col-span-1 p-2">
            <div className="text-[10px] sm:text-xs text-slate-500 leading-none mb-1">题目总数</div>
            <div className="text-base sm:text-xl font-bold leading-none">{stats.totalQuestions}</div>
          </Card>
          <Card className="col-span-1 p-2">
            <div className="text-[10px] sm:text-xs text-slate-500 leading-none mb-1">分类数量</div>
            <div className="text-base sm:text-xl font-bold leading-none">{categories.length}</div>
          </Card>
          {/* 用户管理入口 */}
          <Link href="/admin/users" className="col-span-1">
            <Card className="hover:shadow-sm transition-shadow cursor-pointer h-full p-2 flex items-center gap-2">
              <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-500 shrink-0" />
              <div>
                <div className="text-[10px] sm:text-xs text-slate-500 leading-none">用户管理</div>
                <div className="text-sm sm:text-base font-bold leading-none mt-0.5">管理</div>
              </div>
            </Card>
          </Link>
        </div>

        {/* 导入区域 */}
        <Card className="mb-4 sm:mb-6">
          <CardHeader className="flex flex-row items-center justify-between py-3 sm:py-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <FileJson className="h-4 w-4 sm:h-5 sm:w-5" />
                导入题库
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                导入 JSON 格式题库到指定分类
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsCategoryModalOpen(true)}>
                <Folder className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" />
                <span className="hidden sm:inline">管理分类</span>
                <span className="sm:hidden">分类</span>
              </Button>
              <Button variant="outline" size="sm" onClick={openExportDbDialog}>
                <Database className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" />
                <span className="hidden sm:inline">导出数据库</span>
                <span className="sm:hidden">导出</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <select
                value={importCategory}
                onChange={(e) => setImportCategory(e.target.value)}
                className="h-9 sm:h-10 rounded-md border border-input bg-white px-2 sm:px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring flex-1"
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
                <Button variant="outline" className="w-full sm:w-auto" disabled={isImporting} asChild>
                  <span>
                    <FileJson className="h-4 w-4 mr-1.5" />
                    {isImporting ? '导入中...' : '导入 JSON'}
                  </span>
                </Button>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* 操作栏 */}
        <div className="flex flex-col gap-3 sm:gap-4 mb-6">
          {/* 搜索和筛选 */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            <div className="relative flex-1">
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
              className="px-3 py-2 border rounded-md bg-white text-sm w-full sm:w-auto"
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
          {/* 操作按钮 */}
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/create" className="flex-shrink-0">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">新建题库</span>
                <span className="sm:hidden">新建</span>
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
                          <div className="overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
                            <Table className="min-w-[600px]">
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-10 text-center"></TableHead>
                                  <TableHead className="w-[40%]">题库名称</TableHead>
                                  <TableHead className="w-[120px] text-center">题目数量</TableHead>
                                  <TableHead className="w-[120px] text-center">创建时间</TableHead>
                                  <TableHead className="w-[100px] text-right">操作</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {categoryBanks.map((bank) => (
                                  <SortableBankRow
                                    key={bank.id}
                                    bank={bank}
                                    onEdit={() => openEditBankDialog(bank)}
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
                          </div>
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
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
            {/* 页码信息 */}
            <div className="text-sm text-slate-500 order-2 sm:order-1">
              第 {currentPage} / {totalPages} 页
            </div>
            {/* 分页按钮 */}
            <div className="flex items-center gap-1 sm:gap-2 order-1 sm:order-2">
              <Button variant="outline" size="sm" onClick={() => handlePageChange(1)} disabled={currentPage === 1} className="hidden sm:flex px-2 sm:px-3">
                首页
              </Button>
              <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="px-2 sm:px-3">
                <span className="hidden sm:inline">上一页</span>
                <span className="sm:hidden">←</span>
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
                      className="w-8 h-8 sm:w-10 sm:h-9 p-0 text-xs sm:text-sm"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="px-2 sm:px-3">
                <span className="hidden sm:inline">下一页</span>
                <span className="sm:hidden">→</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages} className="hidden sm:flex px-2 sm:px-3">
                末页
              </Button>
            </div>
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
