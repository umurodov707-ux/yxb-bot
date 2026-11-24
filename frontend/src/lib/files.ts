import { tg } from '../api/client';

/** Server vaqtni UTC'da beradi; zona ko'rsatilmagan bo'lsa UTC deb o'qiymiz. */
export function parseDate(iso: string | null | undefined): Date {
  if (!iso) return new Date(NaN);
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso.replace(' ', 'T') + 'Z');
}

export function absoluteUrl(url: string) {
  return new URL(url, window.location.origin).href;
}

/** Faylni Telegram'ning o'z yuklab olish oynasi orqali ochadi; eski klientlarda — tashqi havola. */
export function openFile(url: string, name: string) {
  const abs = absoluteUrl(url);
  try {
    if (tg?.downloadFile && tg.isVersionAtLeast?.('8.0')) {
      tg.downloadFile({ url: abs, file_name: name });
      return;
    }
    if (tg?.openLink) {
      tg.openLink(abs);
      return;
    }
  } catch { /* fall through */ }
  window.open(abs, '_blank', 'noopener');
}
