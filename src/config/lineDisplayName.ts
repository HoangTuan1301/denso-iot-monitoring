/**
 * @file lineDisplayName.ts
 * @description Tên hiển thị của dây chuyền = tên ô trên sơ đồ nhà máy (góp ý mentor 26/11).
 * Mã line (LN-PRS-01…) vẫn giữ để tra cứu, nhưng giao diện ưu tiên tên ô: CVT, CVT MID, APM, AT…
 */
export const LINE_DISPLAY_NAME: Record<string, string> = {
  'LN-PRS-01': 'CVT',
  'LN-PNT-02': 'APM',
  'LN-ASM-03': 'CVT MID',
  'LN-AT-04': 'AT',
  'LN-AFM-05': 'AFM',
  'LN-JAT-06': 'JATCO',
  'LN-AVS-07': 'AVS',
  'LN-HSG-08': 'HOUSING',
  'LN-DCS-09': 'Decast 1',
  'LN-DCT-10': 'DCT',
  'LN-MH1-11': 'H1',
  'LN-WS7-12': 'WS7',
  'LN-OCV-13': 'OCV3',
};

/** Tên ô trên sơ đồ của một line; không có thì trả về fallback (mặc định là chính mã line) */
export function lineDisplayName(code?: string | null, fallback?: string): string {
  if (code && LINE_DISPLAY_NAME[code]) return LINE_DISPLAY_NAME[code];
  return fallback ?? code ?? '';
}
