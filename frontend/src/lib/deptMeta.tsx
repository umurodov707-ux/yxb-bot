import type { LucideIcon } from 'lucide-react';
import {
  TrainTrack, Construction, Factory, Landmark, ScanSearch, Calculator,
  HardHat, Shovel, Hammer, ScrollText, TrainFront, FolderOpen, Building2,
} from 'lucide-react';

export interface DeptMeta {
  Icon: LucideIcon;
  /** gradient: [from, to] */
  g: [string, string];
}

const BY_CODE: Record<string, DeptMeta> = {
  FOYDALANISH: { Icon: TrainTrack,   g: ['#3b82f6', '#22d3ee'] },
  KAPITAL:     { Icon: Construction, g: ['#f59e0b', '#f97316'] },
  ISHLAB:      { Icon: Factory,      g: ['#8b5cf6', '#6366f1'] },
  SUNIY:       { Icon: Landmark,     g: ['#14b8a6', '#10b981'] },
  REVIZOR:     { Icon: ScanSearch,   g: ['#f43f5e', '#ec4899'] },
  EKONOMIST:   { Icon: Calculator,   g: ['#22c55e', '#84cc16'] },
  PC:          { Icon: HardHat,      g: ['#f97316', '#ef4444'] },
  PMS:         { Icon: Shovel,       g: ['#0ea5e9', '#6366f1'] },
  RSP:         { Icon: Hammer,       g: ['#a855f7', '#d946ef'] },
  TELEGRAMMA:  { Icon: ScrollText,   g: ['#eab308', '#f59e0b'] },
  PASS_POYEZD: { Icon: TrainFront,   g: ['#06b6d4', '#3b82f6'] },
  BOSHQALAR:   { Icon: FolderOpen,   g: ['#64748b', '#94a3b8'] },
};

const PC_META: DeptMeta = BY_CODE.PC;
const PMS_META: DeptMeta = BY_CODE.PMS;

export function deptMeta(code: string, parentCode?: string | null): DeptMeta {
  if (BY_CODE[code]) return BY_CODE[code];
  if (parentCode === 'PC' || code.startsWith('ПЧ')) return PC_META;
  if (parentCode === 'PMS' || /П?МС/.test(code)) return PMS_META;
  return { Icon: Building2, g: ['#3b82f6', '#8b5cf6'] };
}

export const gradient = (m: DeptMeta) => `linear-gradient(135deg, ${m.g[0]} 0%, ${m.g[1]} 100%)`;

/** "ПЧ-7" → "7", "ПМС-279" → "279" */
export function unitNumber(name: string) {
  return name.match(/-(\d+)/)?.[1] ?? '';
}
