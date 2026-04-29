import React from 'react';
import { ShieldAlert } from 'lucide-react';

export const Unauthorized: React.FC = () => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '70vh',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: '40px',
      boxShadow: 'var(--shadow-sm)',
      marginTop: '20px'
    }}>
      <ShieldAlert size={64} color="var(--danger)" style={{ marginBottom: 20 }} />
      <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12 }}>غير مصرح بالدخول</h2>
      <p style={{ fontSize: 16, color: 'var(--text-secondary)', textAlign: 'center', maxWidth: 400, lineHeight: 1.6 }}>
        عذراً، لا تمتلك الصلاحيات الكافية للوصول إلى هذه الصفحة. يرجى مراجعة إدارة الصيدلية.
      </p>
    </div>
  );
};
