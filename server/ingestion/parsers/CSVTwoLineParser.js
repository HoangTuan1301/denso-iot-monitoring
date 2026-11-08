/**
 * @file server/ingestion/parsers/CSVTwoLineParser.js
 * @description Parser chuyên trách cho định dạng CSV 2 dòng header của nhà máy DENSO:
 * - Dòng 1: Tiêu đề phân đoạn dữ liệu (Section Header, e.g. "DATA").
 * - Dòng 2: Header thực tế chứa các tên cột (e.g. "DATA No","DATE","TIME","POS1","POS2","POS3").
 * - Dòng 3+: Dữ liệu đo lường theo chu kỳ.
 * 
 * Bảo đảm:
 * 1. Không tự suy đoán scale, unit hoặc ý nghĩa của POS1/POS2/POS3.
 * 2. Giữ nguyên giá trị thô (rawValue).
 * 3. Chuẩn hóa ngày giờ thành ISO 8601 (measuredAt).
 * 4. Bóc tách lỗi từng dòng độc lập (không làm hỏng toàn bộ file).
 */

import fs from 'fs';
import readline from 'readline';

export class CSVTwoLineParser {
  /**
   * @param {Object} options
   * @param {string} [options.sectionHeader='DATA'] Tiêu đề phân đoạn ở dòng 1
   * @param {string} [options.timezoneOffset='+07:00'] Múi giờ nhà máy (mặc định UTC+7 Việt Nam)
   */
  constructor(options = {}) {
    this.sectionHeader = options.sectionHeader || 'DATA';
    this.timezoneOffset = options.timezoneOffset || '+07:00';
  }

  /**
   * Kiểm tra xem tệp tin có phù hợp với parser này không
   * @param {string} filePath
   * @returns {Promise<boolean>}
   */
  async canParse(filePath) {
    return new Promise((resolve) => {
      const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
      const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

      let lineCount = 0;
      let firstLine = '';

      rl.on('line', (line) => {
        lineCount++;
        if (lineCount === 1) {
          firstLine = line.trim().replace(/^["']|["']$/g, '');
          rl.close();
        }
      });

      rl.on('close', () => {
        resolve(firstLine.toUpperCase() === this.sectionHeader.toUpperCase());
      });

      rl.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Phân tích tệp CSV theo luồng stream
   * @param {string} filePath
   * @returns {Promise<{
   *   totalRows: number,
   *   validRecords: Array<Object>,
   *   errorRows: Array<Object>,
   *   columns: Array<string>,
   *   channelNames: Array<string>
   * }>}
   */
  async parseFile(filePath) {
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
      const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

      let lineNumber = 0;
      let headers = [];
      let channelColumns = [];
      const validRecords = [];
      const errorRows = [];

      rl.on('line', (rawLine) => {
        lineNumber++;
        const line = rawLine.trim();
        if (!line) return; // Bỏ qua dòng trống

        // Dòng 1: Kiểm tra Section Header
        if (lineNumber === 1) {
          const cleanSection = line.replace(/^["']|["']$/g, '').trim();
          if (cleanSection.toUpperCase() !== this.sectionHeader.toUpperCase()) {
            errorRows.push({
              lineNumber,
              line,
              error: `Dòng 1 không phải phân đoạn hợp lệ. Kỳ vọng "${this.sectionHeader}", nhận được "${cleanSection}"`,
            });
          }
          return;
        }

        // Dòng 2: Trích xuất Header thực tế
        if (lineNumber === 2) {
          headers = line.split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
          // Xác định các cột kênh đo (bỏ qua DATA No, DATE, TIME)
          const metaCols = ['DATA NO', 'DATANO', 'DATE', 'TIME', 'TIMESTAMP'];
          channelColumns = headers.filter((h) => !metaCols.includes(h.toUpperCase()));
          return;
        }

        // Dòng 3+: Dữ liệu đo
        try {
          const values = line.split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''));

          if (values.length !== headers.length) {
            errorRows.push({
              lineNumber,
              line,
              error: `Số lượng cột không khớp: kỳ vọng ${headers.length}, nhận được ${values.length}`,
            });
            return;
          }

          // Trích xuất các trường cơ bản
          const rowObj = {};
          headers.forEach((h, idx) => {
            rowObj[h] = values[idx];
          });

          // Tìm cột Sequence (DATA No)
          const dataNoRaw = rowObj['DATA No'] ?? rowObj['DATA_NO'] ?? rowObj['dataNo'] ?? values[0];
          const dataNo = parseInt(dataNoRaw, 10);
          if (isNaN(dataNo)) {
            errorRows.push({
              lineNumber,
              line,
              error: `Trường DATA No không hợp lệ: "${dataNoRaw}"`,
            });
            return;
          }

          // Tìm cột DATE và TIME
          const dateStr = rowObj['DATE'] ?? rowObj['date'];
          const timeStr = rowObj['TIME'] ?? rowObj['time'];

          if (!dateStr || !timeStr) {
            errorRows.push({
              lineNumber,
              line,
              error: `Thiếu trường DATE hoặc TIME trên dòng: DATE="${dateStr}", TIME="${timeStr}"`,
            });
            return;
          }

          // Chuẩn hóa DATE: YYYY/MM/DD -> YYYY-MM-DD
          const normalizedDate = dateStr.replace(/\//g, '-').trim();
          const normalizedTime = timeStr.trim();

          // Ghép thành chuỗi ISO 8601 đầy đủ (measuredAt)
          const isoString = `${normalizedDate}T${normalizedTime}${this.timezoneOffset}`;
          const measuredDate = new Date(isoString);

          if (isNaN(measuredDate.getTime())) {
            errorRows.push({
              lineNumber,
              line,
              error: `Định dạng ngày giờ không thể phân tích: "${isoString}"`,
            });
            return;
          }

          // Trích xuất các kênh đo (POS1, POS2, POS3,...) và giữ nguyên raw value
          const channels = [];
          for (const chName of channelColumns) {
            const rawValStr = rowObj[chName];
            let rawNumeric = null;
            if (rawValStr !== undefined && rawValStr !== null && rawValStr !== '') {
              const parsedNum = Number(rawValStr);
              if (!isNaN(parsedNum)) {
                rawNumeric = parsedNum;
              }
            }

            channels.push({
              tagName: chName,
              rawValue: rawNumeric,
              rawString: rawValStr,
            });
          }

          validRecords.push({
            lineNumber,
            dataNo,
            dateRaw: dateStr,
            timeRaw: timeStr,
            measuredAt: isoString,
            measuredTimestamp: measuredDate.toISOString(),
            channels,
          });
        } catch (err) {
          errorRows.push({
            lineNumber,
            line,
            error: `Lỗi ngoại lệ khi phân tích dòng: ${err.message}`,
          });
        }
      });

      rl.on('close', () => {
        resolve({
          totalRows: lineNumber,
          dataRowsCount: validRecords.length,
          validRecords,
          errorRows,
          columns: headers,
          channelNames: channelColumns,
        });
      });

      rl.on('error', (err) => {
        reject(err);
      });
    });
  }
}
