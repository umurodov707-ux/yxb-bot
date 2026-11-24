import React from 'react';

interface Props {
  status: 'pending' | 'rejected' | 'error';
}

export default function PendingPage({ status }: Props) {
  const content = {
    pending: {
      icon: '⏳',
      title: 'Ariza ko\'rib chiqilmoqda',
      text: 'Arizangiz admin tomonidan ko\'rib chiqilmoqda. Tasdiqlangach sizga xabar beriladi.',
    },
    rejected: {
      icon: '❌',
      title: 'Ariza rad etildi',
      text: 'Arizangiz rad etildi. Qo\'shimcha ma\'lumot uchun admin bilan bog\'laning.',
    },
    error: {
      icon: '🔐',
      title: 'Autentifikatsiya xatosi',
      text: 'Iltimos Telegram orqali kirishga urinib ko\'ring.',
    },
  }[status];

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 24,
    }}>
      <div className="card" style={{ textAlign: 'center', maxWidth: 360, width: '100%' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>{content.icon}</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{content.title}</div>
        <div className="text-mute text-sm">{content.text}</div>
      </div>
    </div>
  );
}
