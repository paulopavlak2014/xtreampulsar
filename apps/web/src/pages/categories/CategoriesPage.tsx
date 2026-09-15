import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Edit2, FolderOpen, Square, CheckSquare, RefreshCw, ArrowUp, ArrowDown } from 'lucide-react';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory, useReorderCategories, type Category } from '@/hooks/useCategories';
import { useBouquets } from '@/hooks/useBouquets';
import { CountedBouquetSelector } from '@/components/ui/CountedBouquetSelector';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const TYPE_TABS: { id: string; labelKey: string }[] = [
  { id: '', labelKey: 'categories.all' },
  { id: 'LIVE', labelKey: 'categories.live' },
  { id: 'VOD', labelKey: 'categories.vod' },
  { id: 'SERIES', labelKey: 'categories.series' },
];

const TYPE_BADGE: Record<string, string> = {
  LIVE: 'badge-blue',
  VOD: 'badge-purple',
  SERIES: 'badge-warning',
};

const TYPE_LABEL_KEY: Record<string, string> = {
  LIVE: 'categories.live',
  VOD: 'categories.vod',
  SERIES: 'categories.series',
};

interface FormState { name: string; type: 'LIVE' | 'VOD' | 'SERIES'; bouquetIds: string[] }
const FORM_DEFAULT: FormState = { name: '', type: 'LIVE', bouquetIds: [] };

export function CategoriesPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(FORM_DEFAULT);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBulkBouquetModal, setShowBulkBouquetModal] = useState(false);
  const [bulkBouquetIds, setBulkBouquetIds] = useState<string[]>([]);
  const [bulkBouquetMode, setBulkBouquetMode] = useState<'replace' | 'add'>('replace');

  const { data: categories = [], isLoading } = useCategories(activeTab || undefined);
  const { data: bouquets = [] } = useBouquets();
  const createCat = useCreateCategory();
  const updateCat = useUpdateCategory();
  const deleteCat = useDeleteCategory();
  const reorderCat = useReorderCategories();

  const moveCategory = (index: number, direction: -1 | 1) => {
    const next = [...categories];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    reorderCat.mutate(next.map((c) => c.id));
  };

  const toggleSelect = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const toggleAll = () => {
    if (selected.size === categories.length) setSelected(new Set());
    else setSelected(new Set(categories.map((c) => c.id)));
  };

  const bulkDelete = async () => {
    if (!selected.size) return;
    if (!confirm(t('categories.bulkDeleteConfirm', { count: selected.size }))) return;
    let failed = 0;
    for (const id of selected) {
      try { await deleteCat.mutateAsync(id); } catch { failed++; }
    }
    setSelected(new Set());
    if (failed > 0) toast.error(t('categories.bulkDeleteFailed', { count: failed }));
    else toast.success(t('categories.bulkDeleteSuccess'));
  };

  const openBulkBouquet = () => {
    setBulkBouquetIds([]);
    setBulkBouquetMode('replace');
    setShowBulkBouquetModal(true);
  };

  const handleBulkBouquet = async () => {
    if (!bulkBouquetIds.length) {
      toast.error(t('categories.selectAtLeastOneBouquet'));
      return;
    }
    const total = selected.size;
    let failed = 0;
    for (const id of selected) {
      try {
        const cat = categories.find((c) => c.id === id);
        if (!cat) continue;
        let newIds: string[];
        if (bulkBouquetMode === 'add') {
          const existing = cat.categoryBouquets.map((cb) => cb.bouquetId);
          newIds = Array.from(new Set([...existing, ...bulkBouquetIds]));
        } else {
          newIds = bulkBouquetIds;
        }
        await updateCat.mutateAsync({ id, data: { name: cat.name, type: cat.type, bouquetIds: newIds } });
      } catch { failed++; }
    }
    setShowBulkBouquetModal(false);
    setSelected(new Set());
    if (failed > 0) toast.error(`${failed} categoria(s) falharam`);
    else toast.success(`Bouquet atualizado em ${total} categoria(s)`);
  };

  const openAdd = () => { setForm(FORM_DEFAULT); setEditTarget(null); setShowModal(true); };
  const openEdit = (c: Category) => {
    setForm({
      name: c.name,
      type: c.type,
      bouquetIds: c.categoryBouquets.map((cb) => cb.bouquetId),
    });
    setEditTarget(c.id);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.bouquetIds.length) {
      toast.error(t('categories.selectAtLeastOneBouquet'));
      return;
    }
    if (editTarget) {
      await updateCat.mutateAsync({ id: editTarget, data: form });
    } else {
      await createCat.mutateAsync(form);
    }
    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('categories.deleteConfirm'))) return;
    await deleteCat.mutateAsync(id);
  };

  const tabsWithCount: TabItem[] = TYPE_TABS.map((tab) => ({
    id: tab.id,
    label: t(tab.labelKey),
    badge: tab.id === '' ? categories.length : categories.filter((c) => c.type === tab.id).length,
  }));

  const columns: Column<Category>[] = [
    {
      key: 'select',
      header: (
        <button onClick={toggleAll} className="p-0.5">
          {selected.size === categories.length && categories.length > 0
            ? <CheckSquare className="w-4 h-4 text-primary" />
            : <Square className="w-4 h-4 text-muted" />}
        </button>
      ) as unknown as string,
      className: 'w-10',
      render: (row) => (
        <button onClick={() => toggleSelect(row.id)} className="p-0.5">
          {selected.has(row.id)
            ? <CheckSquare className="w-4 h-4 text-primary" />
            : <Square className="w-4 h-4 text-muted" />}
        </button>
      ),
    },
    {
      key: 'name',
      header: t('categories.category'),
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FolderOpen className="w-4 h-4 text-primary-light" />
          </div>
          <div>
            <div className="font-medium text-slate-200">{row.name}</div>
            {row.categoryBouquets.length > 0 && (
              <div className="text-xs text-muted">
                {row.categoryBouquets.map((cb) => cb.bouquet.name).join(', ')}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: t('categories.type'),
      render: (row) => (
        <span className={cn('badge', TYPE_BADGE[row.type])}>{t(TYPE_LABEL_KEY[row.type])}</span>
      ),
    },
    {
      key: 'streams',
      header: t('categories.streamCount'),
      render: (row) => (
        <span className="text-sm font-medium text-slate-300">{t('categories.channelCount', { count: row._count?.streams ?? 0 })}</span>
      ),
    },
    {
      key: 'isActive',
      header: t('common.status'),
      render: (row) => (
        <span className={cn('badge', row.isActive ? 'badge-success' : 'badge-gray')}>
          {row.isActive ? t('common.active') : t('common.inactive')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-px',
      render: (row, index) => (
        <div className="flex items-center gap-1">
          <button className="btn btn-ghost p-1.5" onClick={() => moveCategory(index, -1)} disabled={index === 0}>
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button className="btn btn-ghost p-1.5" onClick={() => moveCategory(index, 1)} disabled={index === categories.length - 1}>
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          <button className="btn btn-ghost p-1.5" onClick={() => openEdit(row)}>
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button className="btn btn-ghost p-1.5 hover:text-danger" onClick={() => void handleDelete(row.id)}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">{t('categories.title')}</h1>
          <p className="text-sm text-muted mt-0.5">{t('categories.categoryCount', { count: categories.length })}</p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <>
              <button onClick={openBulkBouquet} className="btn btn-ghost border-primary/30 hover:bg-primary/10 text-sm text-primary-light">
                <RefreshCw className="w-4 h-4" /> Trocar Bouquet ({selected.size})
              </button>
              <button onClick={() => void bulkDelete()} className="btn btn-ghost text-danger border-danger/30 hover:bg-danger/10 text-sm">
                <Trash2 className="w-4 h-4" /> {t('categories.deleteSelected', { count: selected.size })}
              </button>
            </>
          )}
          <button onClick={openAdd} className="btn btn-primary">
            <Plus className="w-4 h-4" /> {t('categories.addCategory')}
          </button>
        </div>
      </div>

      <Tabs tabs={tabsWithCount} active={activeTab} onChange={setActiveTab} />

      <DataTable columns={columns} data={categories} isLoading={isLoading} emptyMessage={t('categories.empty')} />

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editTarget ? t('common.edit') : t('categories.addCategory')} size="md">
        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4 p-6">
          <div>
            <label className="label">{t('common.name')}</label>
            <input required className="input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder={t('categories.namePlaceholder')} />
          </div>
          <div>
            <label className="label">{t('categories.type')}</label>
            <select className="input" value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as FormState['type'] }))}>
              <option value="LIVE">{t('categories.live')}</option>
              <option value="VOD">{t('categories.vod')}</option>
              <option value="SERIES">{t('categories.series')}</option>
            </select>
          </div>
          <div>
            <label className="label">{t('categories.bouquets')}</label>
            <CountedBouquetSelector
              value={form.bouquetIds}
              onChange={(ids) => setForm((p) => ({ ...p, bouquetIds: ids }))}
              maxHeight={240}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={createCat.isPending || updateCat.isPending}>
              {editTarget ? t('common.update') : t('common.create')}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={showBulkBouquetModal} onClose={() => setShowBulkBouquetModal(false)} title={`Trocar Bouquet — ${selected.size} categoria(s)`} size="md">
        <div className="space-y-4 p-6">
          <div>
            <label className="label">Modo</label>
            <div className="flex gap-3 mt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="bulkMode" value="replace" checked={bulkBouquetMode === 'replace'} onChange={() => setBulkBouquetMode('replace')} className="accent-primary" />
                <span className="text-sm text-slate-300">Substituir bouquets</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="bulkMode" value="add" checked={bulkBouquetMode === 'add'} onChange={() => setBulkBouquetMode('add')} className="accent-primary" />
                <span className="text-sm text-slate-300">Adicionar aos existentes</span>
              </label>
            </div>
            <p className="text-xs text-muted mt-1">
              {bulkBouquetMode === 'replace'
                ? 'Os bouquets selecionados vão substituir os atuais em todas as categorias escolhidas.'
                : 'Os bouquets selecionados serão adicionados sem remover os que já existem.'}
            </p>
          </div>
          <div>
            <label className="label">Bouquets</label>
            <CountedBouquetSelector value={bulkBouquetIds} onChange={setBulkBouquetIds} maxHeight={280} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-ghost" onClick={() => setShowBulkBouquetModal(false)}>{t('common.cancel')}</button>
            <button type="button" className="btn btn-primary" disabled={updateCat.isPending || !bulkBouquetIds.length} onClick={() => void handleBulkBouquet()}>
              <RefreshCw className="w-4 h-4" /> Aplicar em {selected.size} categoria(s)
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
