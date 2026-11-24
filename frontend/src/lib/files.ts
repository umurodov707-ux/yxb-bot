import { tg } from '../api/client';

/** Server vaqtni UTC'da beradi; zona ko'rsatilmagan bo'lsa UTC deb o'qiymiz. */
export function parseDate(iso: string | null | undefined): Date {
  if (!iso) return new Date(NaN);
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso.replace(' ', 'T') + 'Z');
}

export function absoluteUrl(url: string) {
  return new URL(url, window.location.origin).href;
}

const isPdf = (name: string) => /\.pdf$/i.test(name);

function openExternal(abs: string) {
  try {
    if (tg?.openLink) { tg.openLink(abs); return; }
  } catch { /* fall through */ }
  window.open(abs, '_blank', 'noopener');
}

/**
 * PDF — ko'ruvchida ochiladi; Word/Excel/rasm va boshqalar — asl nomi bilan saqlanadi,
 * so'ng telefon ularni o'z dasturida (Word, Excel, Galereya) ochadi.
 */
export function openFile(url: string, name: string) {
  const abs = absoluteUrl(url);
  if (isPdf(name)) {
    openExternal(abs + (abs.includes('?') ? '&' : '?') + 'inline=1');
    return;
  }
  try {
    if (tg?.downloadFile && tg.isVersionAtLeast?.('8.0')) {
      tg.downloadFile({ url: abs, file_name: name });
      return;
    }
  } catch { /* fall through */ }
  openExternal(abs);
}
