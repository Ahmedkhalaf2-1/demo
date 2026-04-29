import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '24px' }}>
          <div style={{ maxWidth: 500, width: '100%', background: 'var(--surface)', padding: '32px', borderRadius: '16px', boxShadow: 'var(--shadow-lg)', textAlign: 'center' }}>
            <div style={{ background: '#FEE2E2', width: 64, height: 64, borderRadius: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <AlertTriangle size={32} color="#DC2626" />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>عذراً، حدث خطأ غير متوقع</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
              واجه النظام مشكلة أثناء معالجة طلبك. نعتذر عن هذا الإزعاج. البيانات الخاصة بك آمنة، يرجى إعادة تحميل الصفحة.
            </p>
            <div style={{ background: 'var(--surface-2)', padding: 16, borderRadius: 8, marginBottom: 24, textAlign: 'left', fontSize: 12, overflowX: 'auto', color: 'var(--danger)', direction: 'ltr' }}>
              {this.state.error?.message}
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', background: 'var(--accent-dark)', color: '#FFF', padding: '12px', borderRadius: '8px', fontWeight: 700, border: 'none', cursor: 'pointer' }}
            >
              <RefreshCw size={18} />
              إعادة تحميل النظام
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
