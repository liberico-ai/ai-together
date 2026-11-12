import { createHash } from 'node:crypto';
import { z } from 'zod';

const cell = z.union([z.string(), z.null()]);
const sha256 = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** An operator-provided export of one Google Sheet range. Never implies task acceptance. */
export const sourceSnapshot = z.object({
  source_id: z.string().min(1),
  source_type: z.literal('google_sheet'),
  source_url: z.url(),
  ingested_at: z.iso.datetime({ offset: true }),
  quality_score: z.number().min(0).max(1),
  quality_basis: z.string().min(5),
  sheet: z.string().min(1),
  range: z.string().regex(/^A1:H\d+$/),
  source_modified_at: z.iso.datetime({ offset: true }).nullable(),
  values: z.array(z.array(cell)).min(1),
}).strict();
export type SourceSnapshot = z.infer<typeof sourceSnapshot>;

export type SourceException = {
  code: 'MISSING_OWNER'|'MISSING_DUE'|'AMBIGUOUS_DUE'|'DATE_FORMAT_CONFLICT'|'INVALID_DUE'|'DUPLICATE_STT'|'SOURCE_CHANGED'|'SOURCE_REMOVED';
  row: number;
  stt: string;
  source_ref: string;
  message: string;
  next_step: string;
};

const header = ['STT','BU','Đầu việc','Người phụ trách','Phối hợp','Trạng thái','Hạn','Ghi chú'];
const value = (v: string|null|undefined) => (v??'').trim();
const open = (status: string) => !['Hoàn thành','Đã hoàn thành'].includes(status);

function dueIssue(raw: string): 'AMBIGUOUS_DUE'|'DATE_FORMAT_CONFLICT'|'INVALID_DUE'|null {
  if (!raw) return null;
  // Google Sheets CSV export renders date-only cells as midnight timestamps.
  // Preserve the original cell; validate only its date portion here.
  if (/^\d{4}-\d{2}-\d{2} 00:00:00$/.test(raw)) raw=raw.slice(0,10);
  let day: number,month: number,year: number;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  const slashes = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (iso) [year,month,day] = iso.slice(1).map(Number);
  else if (slashes) {
    [day,month,year] = slashes.slice(1).map(Number);
    if (day<=12 && month<=12 && day!==month) return 'AMBIGUOUS_DUE';
    if (month>12 && day<=12) {
      const us=new Date(Date.UTC(year,day-1,month));
      if(us.getUTCFullYear()===year && us.getUTCMonth()===day-1 && us.getUTCDate()===month)
        return 'DATE_FORMAT_CONFLICT';
    }
  } else return 'INVALID_DUE';
  const d = new Date(Date.UTC(year,month-1,day));
  return d.getUTCFullYear()===year && d.getUTCMonth()===month-1 && d.getUTCDate()===day ? null : 'INVALID_DUE';
}

function validated(raw: unknown): SourceSnapshot {
  const s = sourceSnapshot.parse(raw);
  if (s.values[0].length !== 8 || header.some((name,index)=>value(s.values[0][index])!==name))
    throw new Error('SOURCE_HEADER_MISMATCH: expected the eight columns of Đầu việc Tech');
  const last = Number(s.range.split('H')[1]);
  if (s.values.length > last) throw new Error('SOURCE_RANGE_MISMATCH');
  return s;
}

export function inspectSourceSnapshot(raw: unknown, previousRaw?: unknown) {
  const s = validated(raw);
  const previous = previousRaw === undefined ? null : validated(previousRaw);
  if (previous && (previous.source_id!==s.source_id || previous.sheet!==s.sheet))
    throw new Error('SOURCE_ID_MISMATCH: cannot compare unrelated sheets');
  const exceptions: SourceException[] = [];
  const rows: Array<{row:number;stt:string;source_ref:string;fingerprint:string;status:string}> = [];
  const seen = new Map<string,number>();
  const ref = (row:number) => `${s.source_id}/${s.sheet}!A${row}:H${row}`;
  const add = (code:SourceException['code'],row:number,stt:string,message:string,next_step:string) =>
    exceptions.push({code,row,stt,source_ref:ref(row),message,next_step});
  const old = new Map<number,string>();
  if (previous) for(let index=1;index<previous.values.length;index++) {
    const v=previous.values[index];
    if(v.some(x=>value(x))) old.set(index+1,sha256(Array.from({length:8},(_,j)=>value(v[j]))));
  }
  for(let index=1;index<s.values.length;index++) {
    const v=s.values[index];
    if(!v.some(x=>value(x))) continue;
    const row=index+1, stt=value(v[0]), status=value(v[5]);
    const fingerprint=sha256(Array.from({length:8},(_,j)=>value(v[j])));
    rows.push({row,stt,source_ref:ref(row),fingerprint,status});
    if(stt) {
      const first=seen.get(stt);
      if(first) add('DUPLICATE_STT',row,stt,`STT trùng dòng ${first}.`,'Người quản lý xác nhận từng việc trước khi gán mã bền.');
      else seen.set(stt,row);
    }
    if(!value(v[3])) add('MISSING_OWNER',row,stt,'Thiếu người phụ trách.','Phương xác nhận người chủ trì và phạm vi việc.');
    if(open(status) && !value(v[6])) add('MISSING_DUE',row,stt,'Việc chưa hoàn thành còn trống hạn.','Người chủ trì đề xuất hạn, Phương xác nhận baseline.');
    const issue=dueIssue(value(v[6]));
    if(issue) add(issue,row,stt,issue==='AMBIGUOUS_DUE'?'Ngày có thể hiểu theo hai thứ tự ngày/tháng.':
      issue==='DATE_FORMAT_CONFLICT'?'Ngày hợp lệ theo tháng/ngày nhưng khác dạng ngày/tháng của phần lớn bảng.':'Hạn không phải ngày hợp lệ.',
      'Giữ giá trị gốc; hỏi chủ nguồn về ngày chuẩn và múi giờ.');
    if(old.has(row) && old.get(row)!==fingerprint)
      add('SOURCE_CHANGED',row,stt,'Nội dung tại dòng nguồn thay đổi so với snapshot trước.',
        'Đối chiếu hai phiên bản với người phụ trách; không tự coi là đổi phân công hoặc nghiệm thu.');
    old.delete(row);
  }
  for(const row of old.keys()) add('SOURCE_REMOVED',row,'','Dòng nguồn không còn trong snapshot mới.',
    'Kiểm tra di chuyển/xóa và mã việc bền trước khi đóng hoặc gộp việc.');
  return {
    kind:'source_exception_report_v1' as const,
    source:{source_id:s.source_id,source_type:s.source_type,source_url:s.source_url,
      ingested_at:s.ingested_at,quality_score:s.quality_score,quality_basis:s.quality_basis,
      source_modified_at:s.source_modified_at,sheet:s.sheet,range:s.range},
    snapshot_hash:sha256(s.values),
    previous_hash:previous?sha256(previous.values):null,
    counts:{rows:rows.length,source_done:rows.filter(r=>!open(r.status)).length,
      source_open:rows.filter(r=>open(r.status)).length,exceptions:exceptions.length},
    rows,exceptions,
    note:'Source status is a report from the Sheet. It is not technical or business acceptance; no source changes were made.'
  };
}
