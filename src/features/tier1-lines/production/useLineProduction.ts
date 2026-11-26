/**
 * @file useLineProduction.ts
 * @description Hook lấy dữ liệu sản xuất (mô phỏng) của 1 dây chuyền: ca sản xuất + điều kiện gia công.
 */
import { PRODUCTION_REFRESH_EVENT, isAutoRefreshOn } from '../../../utils/productionRefresh';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../../../services/api';
import type { LineDailyProduction, LineShiftProduction, ProcessConditionsResponse } from '../../../types/production';

const REFRESH_MS = 60_000;

/** Ca sản xuất của line. `shift`/`date` bỏ trống = ca hiện tại. */
export function useLineShift(lineCode: string | null, shift?: 1 | 2 | 3, date?: string) {
  const [data, setData] = useState<LineShiftProduction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  const load = useCallback(async () => {
    if (!lineCode) return;
    try {
      const res = await apiClient.getLineProduction(lineCode, shift ? { shift, date } : undefined);
      if (!alive.current) return;
      setData(res);
      setError(null);
    } catch (err: any) {
      if (alive.current) setError(err?.message || 'error');
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [lineCode, shift, date]);

  useEffect(() => {
    alive.current = true;
    setLoading(true);
    load();
    const id = window.setInterval(() => isAutoRefreshOn() && load(), REFRESH_MS);
    const onRefresh = () => load();
    window.addEventListener(PRODUCTION_REFRESH_EVENT, onRefresh);
    return () => {
      alive.current = false;
      window.clearInterval(id);
      window.removeEventListener(PRODUCTION_REFRESH_EVENT, onRefresh);
    };
  }, [load]);

  return { data, loading, error, reload: load };
}

/** Sản lượng theo ngày (tuần / tháng). `period = null` = không tải (đang xem theo ca). */
export function useLineDaily(lineCode: string | null, period: 'week' | 'month' | null, date?: string) {
  const [data, setData] = useState<LineDailyProduction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!lineCode || !period) return;
    try {
      const res = await apiClient.getLineDaily(lineCode, period, date);
      setData(res);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'error');
    } finally {
      setLoading(false);
    }
  }, [lineCode, period, date]);

  useEffect(() => {
    if (!period) return;
    setLoading(true);
    setData(null);
    load();
    const id = window.setInterval(() => isAutoRefreshOn() && load(), REFRESH_MS * 5);
    const onRefresh = () => load();
    window.addEventListener(PRODUCTION_REFRESH_EVENT, onRefresh);
    return () => window.clearInterval(id);
      window.removeEventListener(PRODUCTION_REFRESH_EVENT, onRefresh);
  }, [load, period]);

  return { data, loading, error, reload: load };
}

export function useProcessConditions(lineCode: string | null, days = 30) {
  const [data, setData] = useState<ProcessConditionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!lineCode) return;
    setLoading(true);
    try {
      setData(await apiClient.getLineProcessConditions(lineCode, days));
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'error');
    } finally {
      setLoading(false);
    }
  }, [lineCode, days]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}

/** Phút kể từ đầu ca cho mốc "HH:mm" (xử lý ca 3 qua nửa đêm). */
export function minutesFromShiftStart(hhmm: string, shiftStartHour: number) {
  const [h, m] = hhmm.split(':').map(Number);
  let diff = (h - shiftStartHour) * 60 + m;
  if (diff < 0) diff += 24 * 60;
  return diff;
}
