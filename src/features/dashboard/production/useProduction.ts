/**
 * @file useProduction.ts
 * @description Hook lấy dữ liệu sản xuất (mô phỏng) cho Dashboard: tổng quan nhà máy và What-If của 1 line.
 */
import { PRODUCTION_REFRESH_EVENT, isAutoRefreshOn } from '../../../utils/productionRefresh';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../../services/api';
import type { FactoryProductionOverview, WhatIfResponse } from '../../../types/production';

const OVERVIEW_REFRESH_MS = 60_000;

export function useProductionOverview() {
  const [data, setData] = useState<FactoryProductionOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  const retry = useRef<number | undefined>(undefined);
  const load = useCallback(async () => {
    window.clearTimeout(retry.current);
    try {
      const res = await apiClient.getProductionOverview();
      if (!alive.current) return;
      setData(res);
      setError(null);
    } catch (err: any) {
      if (!alive.current) return;
      setError(err?.message || 'error');
      // Máy chủ vừa khởi động lại (CSDL chưa sẵn sàng): giữ số liệu cũ và thử lại sau 10 giây
      retry.current = window.setTimeout(() => load(), 10_000);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    load();
    const id = window.setInterval(() => isAutoRefreshOn() && load(), OVERVIEW_REFRESH_MS);
    const onRefresh = () => load();
    window.addEventListener(PRODUCTION_REFRESH_EVENT, onRefresh);
    return () => {
      alive.current = false;
      window.clearInterval(id);
      window.clearTimeout(retry.current);
      window.removeEventListener(PRODUCTION_REFRESH_EVENT, onRefresh);
    };
  }, [load]);

  return { data, loading, error, reload: load };
}

export function useLineWhatIf(lineCode: string | null) {
  const [data, setData] = useState<WhatIfResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!lineCode) return;
    setLoading(true);
    try {
      const res = await apiClient.getLineWhatIf(lineCode);
      setData(res);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'error');
    } finally {
      setLoading(false);
    }
  }, [lineCode]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}

/** Dịch nguyên nhân dừng theo mã (JAM, POWER, ...) kèm số OP nếu có. */
export function useCauseText() {
  const { t } = useTranslation();
  return useCallback(
    (code: string | null | undefined, op?: string | null, fallback?: string | null) => {
      if (!code) return fallback || '';
      const label = t(`cause.${code}`, { defaultValue: fallback || code });
      return op ? `${label} ${op}` : label;
    },
    [t]
  );
}
