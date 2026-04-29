import React from 'react';
import { Timer, ExternalLink, MessageSquare } from 'lucide-react';

export const TrialExpired: React.FC = () => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      width: '100vw',
      background: 'radial-gradient(circle at center, #1a1a1a 0%, #000000 100%)',
      color: 'white',
      padding: '20px',
      textAlign: 'center',
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: 9999
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '24px',
        padding: '60px 40px',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          borderRadius: '50%',
          width: '100px',
          height: '100px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 30px'
        }}>
          <Timer size={48} color="#ef4444" />
        </div>

        <h1 style={{ 
          fontSize: '32px', 
          fontWeight: 800, 
          marginBottom: '16px',
          background: 'linear-gradient(to right, #fff, #a1a1aa)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          انتهت الفترة التجريبية
        </h1>

        <p style={{ 
          fontSize: '18px', 
          color: '#a1a1aa', 
          marginBottom: '40px',
          lineHeight: '1.6'
        }}>
          لقد استهلكت الـ 15 دقيقة المخصصة لتجربة النظام. نتمنى أن تكون قد استمتعت بالتعرف على مميزاتنا.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <button 
            onClick={() => window.location.reload()}
            style={{
              background: 'white',
              color: 'black',
              border: 'none',
              padding: '16px 32px',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'transform 0.2s'
            }}
          >
            تواصل معنا للحصول على النسخة الكاملة
            <MessageSquare size={20} />
          </button>

          <a 
            href="#" 
            style={{
              color: '#a1a1aa',
              textDecoration: 'none',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            زيارة موقعنا الإلكتروني
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
      
      <div style={{
        marginTop: '40px',
        fontSize: '14px',
        color: '#52525b'
      }}>
        نظام إدارة الصيدليات المتطور &copy; 2026
      </div>
    </div>
  );
};
