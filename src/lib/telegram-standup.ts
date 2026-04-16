export interface StandupTask {
  id: string;
  title: string;
  deadline: Date | null;
  assignee: { id: string; name: string } | null;
}

export interface StandupFormatOptions {
  maxChunkLen?: number;
}

/**
 * Format tasks vào HTML chunks sẵn sàng gửi Telegram.
 * Pure function — không side effect, test được 100%.
 *
 * @param tasks Danh sách task đang in_progress
 * @param now Thời điểm "hôm nay" (inject để test được)
 * @param options Tuỳ chọn (maxChunkLen default 4000)
 * @returns Mảng HTML strings, mỗi phần tử ≤ maxChunkLen ký tự
 */
export function formatStandupMessage(
  tasks: StandupTask[],
  now: Date,
  options: StandupFormatOptions = {}
): string[] {
  throw new Error('not implemented');
}
