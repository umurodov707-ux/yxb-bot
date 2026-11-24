import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { openFile } from '../../lib/files';

export interface LightboxItem { url: string; downloadUrl: string; name: string }

interface Props {
  items: LightboxItem[];
  start: number;
  onClose: () => void;
}

export default function Lightbox({ items, start, onClose }: Props) {
  const [i, setI] = useState(start);
  const touchX = useRef<number | null>(null);
  const item = items[i];
  const go = (d: number) => setI(v => (v + d + items.length) % items.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, []);

  return createPortal(
    <div
      className="lightbox"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      onTouchStart={e => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 50 && items.length > 1) go(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
    >
      <div className="lb-top">
        <span className="lb-count">{items.length > 1 ? `${i + 1} / ${items.length}` : item.name}</span>
        <button className="lb-btn" onClick={() => openFile(item.downloadUrl, item.name)} aria-label="Yuklab olish"><Download size={20} /></button>
        <button className="lb-btn" onClick={onClose} aria-label="Yopish"><X size={22} /></button>
      </div>
      <img key={item.url} src={item.url} alt={item.name} className="lb-img" onClick={onClose} />
      {items.length > 1 && (
        <>
          <button className="lb-nav lb-prev" onClick={() => go(-1)} aria-label="Oldingi"><ChevronLeft size={26} /></button>
          <button className="lb-nav lb-next" onClick={() => go(1)} aria-label="Keyingi"><ChevronRight size={26} /></button>
        </>
      )}
    </div>,
    document.body,
  );
}
