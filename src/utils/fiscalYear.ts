/**
 * @file fiscalYear.ts
 * @description Năm tài chính DENSO (góp ý anh Huy 27/11): 1/4 → 31/3 năm sau, tên theo năm kết thúc.
 *   Ví dụ: 4/2026 – 3/2027 = FY27 → tháng 11/2026 thuộc FY27.
 * Chỉ dùng ở chỗ web ghi NĂM / KỲ (nhãn tháng, tuần, tên file xuất); ngày cụ thể dd/mm/yyyy giữ nguyên.
 */
export const FY_START_MONTH = 4;

/** Năm kết thúc của năm tài chính chứa ngày đã cho (vd 2026-11-26 → 2027) */
export function fiscalYearOf(d: Date | string): number {
  const [y, m] = typeof d === 'string' ? [Number(d.slice(0, 4)), Number(d.slice(5, 7))] : [d.getFullYear(), d.getMonth() + 1];
  return m >= FY_START_MONTH ? y + 1 : y;
}

/** "FY27" */
export function fyLabel(d: Date | string): string {
  return `FY${String(fiscalYearOf(d) % 100).padStart(2, '0')}`;
}

/** Gắn vào tên file: "2026-11-26" → "FY27-11-26", "2026-11" → "FY27-11" */
export function fyFileTag(iso: string): string {
  return `${fyLabel(iso)}${iso.slice(4)}`;
}
