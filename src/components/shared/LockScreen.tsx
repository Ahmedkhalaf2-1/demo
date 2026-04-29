import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore, hashPasscode } from '../../store/useAuthStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { Delete, User as UserIcon, Shield, Briefcase, Lock } from 'lucide-react';
import type { User } from '../../types';

export const LockScreen: React.FC = () => {
  const { settings, loadSettings } = useSettingsStore();
  const { 
    users, 
    isLocked, 
    setLocked, 
    login, 
    initAuth,
    inputDigits,
    addDigit,
    removeDigit,
    clearInput,
    biometricAvailable,
    biometricRegistered
  } = useAuthStore();

  const [viewMode, setViewMode] = useState<'select_user' | 'enter_passcode' | 'force_change_passcode'>('select_user');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [forceNewPasscode, setForceNewPasscode] = useState('');
  const [forceConfirmPasscode, setForceConfirmPasscode] = useState('');
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);
  const lastAuthAttemptRef = useRef<number>(0);

  useEffect(() => {
    loadSettings();
    initAuth().then(() => {
      const storedUsers = useAuthStore.getState().users;
      if (storedUsers.length === 1 && storedUsers[0].passcodeHash === 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855') {
        // Handle empty passcode or default "000000"
      }
    });
  }, []);

  const triggerShake = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 300);
  };

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    clearInput();
    setError('');
    setViewMode('enter_passcode');
  };

  const handleDigitPress = async (digit: string) => {
    if (viewMode === 'enter_passcode') {
      if (inputDigits.length >= 6) return;
      const nextDigits = inputDigits + digit;
      addDigit(digit);

      if (nextDigits.length === 6) {
        if (!selectedUser) return;
        const success = await login(selectedUser.id, nextDigits);
        if (success) {
          const defaultAdminHash = await hashPasscode("000000");
          if (selectedUser.role === 'admin' && selectedUser.passcodeHash === defaultAdminHash) {
            setViewMode('force_change_passcode');
            clearInput();
          } else {
            setLocked(false);
            clearInput();
          }
        } else {
          setError('رمز الدخول غير صحيح.');
          triggerShake();
          clearInput();
        }
      }
    } else if (viewMode === 'force_change_passcode') {
      if (forceNewPasscode.length < 6) {
        const next = forceNewPasscode + digit;
        setForceNewPasscode(next);
      } else if (forceConfirmPasscode.length < 6) {
        const next = forceConfirmPasscode + digit;
        setForceConfirmPasscode(next);
        if (next.length === 6) {
          if (forceNewPasscode === next) {
            if (selectedUser) {
              const hashed = await hashPasscode(forceNewPasscode);
              useAuthStore.getState().updateUser(selectedUser.id, { passcodeHash: hashed });
              alert('تم تحديث رمز الدخول بنجاح');
              setLocked(false);
            }
          } else {
            setError('الرمزان غير متطابقين');
            triggerShake();
            setForceNewPasscode('');
            setForceConfirmPasscode('');
          }
        }
      }
    }
  };

  const handleBiometricAuth = async () => {
    const now = Date.now();
    if (now - lastAuthAttemptRef.current < 1500) return;
    lastAuthAttemptRef.current = now;

    const credentialId = localStorage.getItem('pharma_webauthn_credential_id');
    const bioUserId = localStorage.getItem('pharma_biometric_user_id');
    if (!credentialId || !bioUserId) return;
    
    try {
      const challenge = new Uint8Array([1, 2, 3, 4]);
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: window.location.hostname,
          allowCredentials: [{
            id: Uint8Array.from(atob(credentialId), c => c.charCodeAt(0)),
            type: 'public-key'
          }],
          userVerification: 'required'
        }
      });
      
      if (assertion) {
        const user = users.find(u => u.id === bioUserId);
        if (user) {
          useAuthStore.setState({ currentUser: user, isLocked: false });
          localStorage.setItem('pharma_current_user', JSON.stringify(user));
        }
      }
    } catch (err) {
      console.error('Biometric authentication failed:', err);
    }
  };

  useEffect(() => {
    if (viewMode === 'select_user' && biometricAvailable && biometricRegistered) {
      const timer = setTimeout(() => {
        handleBiometricAuth();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [viewMode, biometricAvailable, biometricRegistered]);

  const pharmacyName = settings?.pharmacyName || 'نظام الصيدلية';

  const keypadNumbers = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
  ];

  const getRoleIcon = (role: string) => {
    if (role === 'admin') return <Shield size={24} color="var(--danger)" />;
    if (role === 'pharmacist') return <Briefcase size={24} color="var(--info)" />;
    return <UserIcon size={24} color="var(--text-secondary)" />;
  };

  const getRoleLabel = (role: string) => {
    if (role === 'admin') return 'مدير النظام';
    if (role === 'pharmacist') return 'صيدلي';
    return 'كاشير';
  };

  return (
    <div className="flex-col items-center justify-center p-8 w-full h-full" style={{
      position: 'fixed',
      inset: 0,
      background: 'var(--surface)',
      zIndex: 9999,
      direction: 'rtl',
    }}>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-10px); }
          40%, 80% { transform: translateX(10px); }
        }
        .shake-active {
          animation: shake 0.3s ease-in-out;
        }
        .keypad-btn {
          width: 80px;
          height: 80px;
          border-radius: var(--r-full);
          background: var(--surface-hover);
          border: 1px solid var(--border);
          color: var(--text-primary);
          font-size: 24px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: var(--transition);
        }
        .keypad-btn:hover {
          background: var(--border);
          transform: translateY(-2px);
          box-shadow: var(--shadow-sm);
        }
        .keypad-btn:active {
          transform: scale(0.95);
        }
        .user-card-lock {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          padding: 24px;
          width: 180px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          cursor: pointer;
          transition: var(--transition);
        }
        .user-card-lock:hover {
          transform: translateY(-4px);
          border-color: var(--accent);
          box-shadow: var(--shadow-md);
        }
        .passcode-dot {
          width: 14px;
          height: 14px;
          border-radius: var(--r-full);
          border: 2px solid var(--border);
          transition: all 0.2s cubic-bezier(.4,0,.2,1);
        }
        .passcode-dot.filled {
          background: var(--accent);
          border-color: var(--accent);
          transform: scale(1.1);
        }
      `}</style>

      {/* TOP */}
      <div className="text-center mb-10 flex-col items-center gap-3">
        <div className="flex items-center gap-3 mb-2">
          <Lock size={32} className="color-primary" />
          <h1 className="text-display" style={{ fontSize: 28 }}>{pharmacyName}</h1>
        </div>
        <p className="text-sm font-medium text-muted">
          {viewMode === 'select_user' && 'الرجاء اختيار المستخدم للبدء'}
          {viewMode === 'enter_passcode' && `أدخل رمز الدخول لـ: ${selectedUser?.name}`}
          {viewMode === 'force_change_passcode' && 'يلزم تغيير الرمز الافتراضي (000000)'}
        </p>
      </div>

      {viewMode === 'select_user' && (
        <div className="flex gap-6 flex-wrap justify-center">
          {users.map(u => (
            <div key={u.id} className="user-card-lock" onClick={() => handleUserSelect(u)}>
              <div className="p-4 bg-light rounded-full mb-1">
                {getRoleIcon(u.role)}
              </div>
              <span className="text-sm font-bold color-primary">{u.name}</span>
              <span className="text-xs text-muted">{getRoleLabel(u.role)}</span>
            </div>
          ))}
        </div>
      )}

      {(viewMode === 'enter_passcode' || viewMode === 'force_change_passcode') && (
        <>
          {/* 6 dots */}
          <div 
            className={`flex gap-4 mb-6 justify-center ${shaking ? 'shake-active' : ''}`}
            style={{ direction: 'ltr' }}
          >
            {Array.from({ length: 6 }).map((_, i) => {
              let isFilled = false;
              if (viewMode === 'enter_passcode') {
                isFilled = i < inputDigits.length;
              } else {
                if (forceNewPasscode.length < 6) {
                  isFilled = i < forceNewPasscode.length;
                } else {
                  isFilled = i < forceConfirmPasscode.length;
                }
              }
              return (
                <div
                  key={i}
                  className={`passcode-dot ${isFilled ? 'filled' : ''}`}
                />
              );
            })}
          </div>

          <div className="text-xs font-bold text-muted mb-4 h-5">
            {viewMode === 'force_change_passcode' && (
              forceNewPasscode.length < 6 ? 'أدخل الرمز الجديد' : 'تأكيد الرمز الجديد'
            )}
            {viewMode === 'enter_passcode' && biometricAvailable && biometricRegistered && (
              <span className="opacity-60">يمكنك استخدام البصمة للدخول</span>
            )}
          </div>

          {error && <div className="text-sm font-bold text-danger mb-4">{error}</div>}

          {/* Keypad */}
          <div className="flex-col gap-6 items-center" style={{ direction: 'ltr' }}>
            {keypadNumbers.map((row, rIdx) => (
              <div key={rIdx} className="flex gap-6">
                {row.map((num) => (
                  <button key={num} onClick={() => handleDigitPress(num)} className="keypad-btn">
                    {num}
                  </button>
                ))}
              </div>
            ))}
            
            <div className="flex gap-6 items-center">
              <button 
                onClick={() => setViewMode('select_user')} 
                className="btn btn-ghost text-sm font-bold text-muted"
                style={{ width: 80, height: 80, borderRadius: 'var(--r-full)' }}
              >
                تغيير
              </button>

              <button onClick={() => handleDigitPress('0')} className="keypad-btn">
                0
              </button>

              <button 
                onClick={() => {
                  if (viewMode === 'enter_passcode') removeDigit();
                  else {
                    if (forceConfirmPasscode.length > 0) setForceConfirmPasscode(f => f.slice(0, -1));
                    else setForceNewPasscode(f => f.slice(0, -1));
                  }
                }} 
                className="keypad-btn"
                style={{ background: 'none', borderColor: 'transparent', color: 'var(--text-muted)' }}
              >
                <Delete size={28} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
export default LockScreen;
