/**
 * @file MachineDocuments.tsx
 * @description Tài liệu máy theo 3 nhóm: Bản vẽ máy · Chương trình máy · Khác.
 * Mọi người dùng đăng nhập được xem/tải xuống; ADMIN và MAINTENANCE được tải lên/xóa (tối đa 10 MB/file).
 */
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Download, Trash2, FileText } from 'lucide-react';
import { apiClient } from '../../../services/api';
import { useAuthStore } from '../../../stores/useAuthStore';
import type { MachineDocument, MachineDocCategory } from '../../../types/machineDetail';

const CATS: MachineDocCategory[] = ['DRAWING', 'PROGRAM', 'OTHER'];
const MAX_BYTES = 10 * 1024 * 1024;

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export function MachineDocuments({ machineId }: { machineId: string }) {
  const { t, i18n } = useTranslation();
  const role = (useAuthStore((s) => s.currentUser?.role) || 'OPERATOR').toUpperCase();
  const canEdit = role === 'ADMIN' || role === 'MAINTENANCE';
  const [cat, setCat] = useState<MachineDocCategory>('DRAWING');
  const [docs, setDocs] = useState<MachineDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.getMachineDocuments(machineId);
      setDocs(res.documents);
    } catch (err: any) {
      setMsg(t('machine.docs.error', { msg: err?.message || '' }));
    } finally {
      setLoading(false);
    }
  }, [machineId, t]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setMsg(t('machine.docs.tooLarge'));
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await apiClient.uploadMachineDocument(machineId, file, cat);
      await load();
    } catch (err: any) {
      setMsg(t('machine.docs.error', { msg: err?.message || '' }));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (doc: MachineDocument) => {
    if (confirmId !== doc.id) {
      setConfirmId(doc.id);
      return;
    }
    setConfirmId(null);
    try {
      await apiClient.deleteMachineDocument(machineId, doc.id);
      await load();
    } catch (err: any) {
      setMsg(t('machine.docs.error', { msg: err?.message || '' }));
    }
  };

  const onDownload = async (doc: MachineDocument) => {
    try {
      await apiClient.downloadMachineDocument(machineId, doc);
    } catch (err: any) {
      setMsg(t('machine.docs.error', { msg: err?.message || '' }));
    }
  };

  const list = docs.filter((d) => d.category === cat);
  const dateFmt = new Intl.DateTimeFormat(i18n.language === 'ja' ? 'ja-JP' : i18n.language === 'en' ? 'en-GB' : 'vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <div className="flex flex-col gap-2.5 pt-3 border-t border-slate-100 dark:border-factory-border">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('machine.docs.title')}</h4>
        {canEdit ? (
          <>
            <input ref={inputRef} type="file" className="hidden" onChange={onPick} aria-label={t('machine.docs.upload')} />
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="min-h-[34px] inline-flex items-center gap-1.5 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              {busy ? t('machine.docs.uploading') : t('machine.docs.upload')}
            </button>
          </>
        ) : (
          <span className="text-[10px] text-slate-400">{t('machine.docs.noPermission')}</span>
        )}
      </div>

      <div role="tablist" className="flex gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800">
        {CATS.map((c) => {
          const n = docs.filter((d) => d.category === c).length;
          return (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={cat === c}
              onClick={() => setCat(c)}
              className={`flex-1 min-h-[34px] rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                cat === c ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t(`machine.docs.${c}`)} · {n}
            </button>
          );
        })}
      </div>

      {msg && <p className="text-[11px] text-rose-600 dark:text-rose-400">{msg}</p>}

      {loading ? (
        <div className="h-12 rounded-lg bg-slate-100 dark:bg-white/5 animate-pulse" />
      ) : list.length === 0 ? (
        <p className="text-[11px] text-slate-400 py-2 text-center">{t('machine.docs.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {list.map((d) => {
            const ext = (d.fileName.split('.').pop() || 'FILE').slice(0, 4).toUpperCase();
            return (
              <li key={d.id} className="flex items-center gap-2.5 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="w-9 h-9 shrink-0 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 flex flex-col items-center justify-center text-[9px] font-extrabold">
                  <FileText className="w-3.5 h-3.5" />
                  {ext}
                </span>
                <span className="flex-1 min-w-0 flex flex-col">
                  <strong className="text-xs text-slate-900 dark:text-white truncate" title={d.fileName}>{d.fileName}</strong>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {fmtSize(d.sizeBytes)} · {dateFmt.format(new Date(d.createdAt))}{d.uploadedBy ? ` · ${d.uploadedBy}` : ''}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onDownload(d)}
                  aria-label={t('machine.docs.download')}
                  title={t('machine.docs.download')}
                  className="w-8 h-8 shrink-0 rounded-md border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-emerald-600 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => onDelete(d)}
                    onBlur={() => setConfirmId(null)}
                    aria-label={t('machine.docs.delete')}
                    className={`h-8 shrink-0 rounded-md border flex items-center justify-center gap-1 px-2 text-[10px] font-bold cursor-pointer ${
                      confirmId === d.id
                        ? 'border-rose-400 bg-rose-600 text-white'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {confirmId === d.id && t('machine.docs.confirmDelete')}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
