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

/** 600 KB dan katta rasmlarni yuklashdan oldin yengillashtiradi. */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size < 600_000) return file;
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    URL.revokeObjectURL(url);
    const max = 1600;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
