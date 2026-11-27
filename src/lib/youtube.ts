/** Video id from any common YouTube URL shape (watch, youtu.be, embed, shorts, live). */
export function extractYoutubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/|live\/))([\w-]{11})/);
  return m ? m[1] : null;
}

/** "1:12:08", "12:08", "1시간 2분 3초", "2분 3초" → seconds. */
export function parseTimestamp(ts: string | null | undefined): number | null {
  if (!ts) return null;
  let m = ts.match(/(\d+):(\d+):(\d+)/);
  if (m) return +m[1] * 3600 + +m[2] * 60 + +m[3];
  m = ts.match(/(\d+):(\d+)/);
  if (m) return +m[1] * 60 + +m[2];
  m = ts.match(/(\d+)시간\s*(\d+)분\s*(\d+)초/);
  if (m) return +m[1] * 3600 + +m[2] * 60 + +m[3];
  m = ts.match(/(\d+)분\s*(\d+)초/);
  if (m) return +m[1] * 60 + +m[2];
  return null;
}

/** seconds → "m:ss" or "h:mm:ss" */
export function formatSeconds(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const h = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h > 0 ? `${h}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}` : `${mm}:${String(ss).padStart(2, "0")}`;
}

export const formatTimestamp = (ts: string) => {
  const s = parseTimestamp(ts);
  return s == null ? ts : formatSeconds(s);
};
