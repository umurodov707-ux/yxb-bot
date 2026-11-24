import type { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { avatarBg, initials } from './RecordCard';

interface Props {
  subtitle?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  children?: ReactNode;
}

export default function AppHeader({ subtitle, onRefresh, refreshing, children }: Props) {
  const { user } = useAuth();
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <img className="logo-img" src="/logo.jpg" alt="Yoʻl xoʻjaligi boshqarmasi" width={44} height={44} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="app-title">Yoʻl xoʻjaligi boshqarmasi</div>
          <div className="app-sub">
            <span className="live-dot" />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {subtitle ?? user?.department_name ?? 'Onlayn'}
            </span>
          </div>
        </div>
        {onRefresh && (
          <button className="icon-btn" onClick={onRefresh} aria-label="Yangilash">
            <RefreshCw size={18} className={refreshing ? 'spin' : ''} />
          </button>
        )}
        {user && (
          <div className="avatar avatar-sm" title={user.full_name} style={{ background: avatarBg(user.full_name) }}>
            {initials(user.full_name)}
          </div>
        )}
      </div>
      {children}
    </header>
  );
}
