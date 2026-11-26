import { createHash } from 'node:crypto';
import { AppError } from './errors';
import { header } from './source-snapshot';

// Reader of the CSV that Google Sheets exports for the tab «Đầu việc Tech» (RFC 4180). Pure functions: no I/O, no database.
// The file's identity is the sha256 of its raw bytes. Every refusal is a fixed sentence with a code; none quotes a cell.
export const SHEET_LIMITS = { fileBytes: 256 * 1024, bodyBytes: 400 * 1024, dataRows: 500, cellChars: 2000 };
/** One data row: `row` is the source row (header = 1, then the order of records, not of physical lines); `cells` are the eight cells, trimmed, absent cells empty. */
export type SheetRow = { row: number; cells: string[] };

const XLSX = 'Đây là tệp Excel (.xlsx), chưa nhập được. Mở trang «Đầu việc Tech» trong Google Sheets, chọn Tệp → Tải xuống → Giá trị phân tách bằng dấu phẩy (.csv), rồi chọn tệp .csv đó.';
const NOT_UTF8 = 'Tệp không phải UTF-8. Tải lại từ Google Sheets theo bước 2, không lưu qua Excel.';

/** Decodes bytes as UTF-8, strictly: any invalid sequence is refused. A leading BOM is dropped. */
export function decodeUtf8Strict(bytes: Uint8Array): string {
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes); }
  catch { throw new AppError('NOT_UTF8', NOT_UTF8, 422); }
}

const malformed = () => new AppError('CSV_MALFORMED', 'Tệp CSV không đọc được: có ô mở ngoặc kép mà không đóng, chữ nằm sau ngoặc đóng, hoặc ngoặc kép giữa một ô không bao trong ngoặc kép.', 422);

/** Records of cells. A final line end does not make an empty record; a blank line inside the text is a record with one empty cell. */
export function parseCsv(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [], cell = '', i = 0;
  const n = text.length;
  let touched = false; // the current record holds something (a cell started or a delimiter was read)
  const endCell = () => { record.push(cell); cell = ''; };
  const endRecord = () => { endCell(); records.push(record); record = []; touched = false; };
  while (i < n) {
    const c = text[i];
    if (c === '"' && cell === '' ) {
      // a quoted cell: runs to the closing quote; "" is a quote; after it comes a delimiter, a line end or the end of the text
      touched = true; i++;
      for (;;) {
        if (i >= n) throw malformed();
        if (text[i] === '"') { if (text[i + 1] === '"') { cell += '"'; i += 2; continue; } i++; break; }
        cell += text[i++];
      }
      if (i < n && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') throw malformed();
      continue;
    }
    if (c === ',') { endCell(); touched = true; i++; continue; }
    if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      i++; endRecord(); continue;
    }
    // RFC 4180: a cell that does not start with a quote may not hold one
    if (c === '"') throw malformed();
    cell += c; touched = true; i++;
  }
  if (touched || cell !== '' || record.length) endRecord();
  return records;
}

const cellProblem = () => new AppError('CELL_TOO_LONG', `Có ô dài quá ${SHEET_LIMITS.cellChars} ký tự. Kiểm tra lại trang nguồn.`, 422);
const headerProblem = () => new AppError('SOURCE_HEADER_MISMATCH', 'Tệp không phải trang «Đầu việc Tech»: dòng 1 phải đúng tám cột STT, BU, Đầu việc, Người phụ trách, Phối hợp, Trạng thái, Hạn, Ghi chú, và không có chữ ở cột thứ chín trở đi.', 422);

/** The file as the sheet's rows. Blank records (all cells empty) are skipped; their numbers are still counted in the source row of the rows after them. */
export function readSheetCsv(bytes: Uint8Array): { fileHash: string; rows: SheetRow[] } {
  if (bytes.byteLength > SHEET_LIMITS.fileBytes) throw new AppError('FILE_TOO_LARGE', `Tệp vượt ${SHEET_LIMITS.fileBytes / 1024} KB.`, 413);
  // a .xlsx workbook is a ZIP: say it is Excel and how to export the CSV, rather than «not UTF-8»
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) throw new AppError('XLSX_NOT_SUPPORTED', XLSX, 422);
  const records = parseCsv(decodeUtf8Strict(bytes));
  const head = records[0];
  if (!head || header.some((name, index) => (head[index] ?? '').trim() !== name) || head.slice(header.length).some(c => c.trim() !== '')) throw headerProblem();
  const rows: SheetRow[] = [];
  for (let index = 1; index < records.length; index++) {
    const record = records[index];
    if (record.some(c => c.length > SHEET_LIMITS.cellChars)) throw cellProblem();
    if (record.every(c => c.trim() === '')) continue;
    if (record.slice(header.length).some(c => c.trim() !== '')) throw headerProblem();
    if (rows.length >= SHEET_LIMITS.dataRows) throw new AppError('TOO_MANY_ROWS', `Tệp có hơn ${SHEET_LIMITS.dataRows} dòng dữ liệu.`, 422);
    rows.push({ row: index + 1, cells: Array.from({ length: header.length }, (_, j) => (record[j] ?? '').trim()) });
  }
  return { fileHash: createHash('sha256').update(bytes).digest('hex'), rows };
}
