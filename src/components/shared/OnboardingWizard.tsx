import React, { useState } from 'react';
import { settingsService } from '../../db/storageService';
import { Command, ArrowLeft, Check, Zap } from 'lucide-react';

interface Props {
  onComplete: () => void;
}

const steps = [
  { key: 'welcome', title: 'مرحباً بك في صيدليتي Pro' },
  { key: 'setup',   title: 'إعداد بيانات الصيدلية' },
  { key: 'done',    title: 'النظام جاهز!' },
];

export const OnboardingWizard: React.FC<Props> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [pharmacyName, setPharmacyName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [currency, setCurrency] = useState('EGP');
  const [saving, setSaving] = useState(false);

  const handleFinish = async () => {
    setSaving(true);
    await settingsService.update({
      pharmacyName: pharmacyName.trim() || 'صيدليتي',
      phone,
      address,
      currency,
    });
    localStorage.setItem('pharma_onboarding_done', '1');
    setSaving(false);
    onComplete();
  };

  return (
    <div className="flex items-center justify-center w-full h-full" style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'radial-gradient(circle at top left, var(--bg) 0%, #e8eded 100%)',
      direction: 'rtl',
      overflowY: 'auto',
      padding: '40px 20px'
    }}>
      <div style={{ width: '100%', maxWidth: 580, display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* Logo Section */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center shadow-xl transform rotate-3 hover:rotate-0 transition-transform duration-500">
            <Command size={32} className="color-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-black color-primary mb-1">صيدليتي <span className="text-xs font-bold bg-accent-dark text-white px-3 py-1 rounded-full" style={{ verticalAlign: 'middle' }}>Pro</span></h1>
            <p className="text-sm text-secondary font-medium tracking-wide">نظام الإدارة الذكي للصيدليات المتطورة</p>
          </div>
        </div>

        {/* Card Container */}
        <div style={{
          background: 'var(--surface)',
          borderRadius: '32px',
          padding: '48px',
          boxShadow: '0 20px 50px rgba(0, 43, 43, 0.08)',
          border: '1px solid rgba(0, 43, 43, 0.03)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Subtle Background Decoration */}
          <div style={{
            position: 'absolute', top: -50, left: -50, width: 200, height: 200,
            background: 'var(--accent-light)', borderRadius: '50%', filter: 'blur(60px)', opacity: 0.5, zIndex: 0
          }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* Progress Bar */}
            <div className="flex justify-center gap-3 mb-12">
              {steps.map((s, i) => (
                <div key={s.key} style={{
                  height: 6,
                  borderRadius: 10,
                  flex: 1,
                  background: i === step ? 'var(--accent-dark)' : i < step ? 'var(--accent)' : 'var(--border)',
                  transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                  opacity: i === step ? 1 : i < step ? 0.8 : 0.4
                }} />
              ))}
            </div>

            {/* Step Content */}
            <div style={{ minHeight: 300, display: 'flex', flexDirection: 'column' }}>
              
              {/* Step 0: Welcome */}
              {step === 0 && (
                <div className="flex flex-col items-center text-center">
                  <div className="text-4xl font-black color-primary mb-6">أهلاً وسهلاً بك</div>
                  <p className="text-lg text-secondary leading-loose mb-10 max-w-md">
                    اكتشف القوة الحقيقية في إدارة صيدليتك مع <span className="font-bold color-primary">Pro</span>. 
                    نظام متكامل يجمع بين السرعة، البساطة، والذكاء الاصطناعي.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4 w-full mb-10 text-right">
                    {[
                      { icon: '📦', text: 'إدارة المخزون' },
                      { icon: '💰', text: 'نقطة بيع سريعة' },
                      { icon: '📊', text: 'تقارير ذكية' },
                      { icon: '🛡️', text: 'بيانات مؤمنة' }
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 rounded-2xl bg-light border border-all">
                        <span className="text-xl">{item.icon}</span>
                        <span className="text-xs font-bold color-primary">{item.text}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    className="btn btn-primary w-full group"
                    style={{ height: 64, fontSize: 18, borderRadius: 20 }}
                    onClick={() => setStep(1)}
                  >
                    ابدأ الإعداد السريع
                    <ArrowLeft size={20} className="mr-2 group-hover:-translate-x-2 transition-transform" />
                  </button>
                </div>
              )}

              {/* Step 1: Setup */}
              {step === 1 && (
                <div className="flex flex-col gap-8">
                  <div className="flex flex-col gap-2 border-r-4 border-accent pr-4">
                    <h2 className="text-2xl font-black color-primary">إعداد الهوية</h2>
                    <p className="text-sm text-secondary">هذه البيانات ستظهر في فواتيرك وتقاريرك.</p>
                  </div>

                  <div className="flex flex-col gap-6">
                    <div className="form-group">
                      <label className="form-label font-bold mb-2 block">اسم الصيدلية</label>
                      <input
                        className="form-input"
                        value={pharmacyName}
                        onChange={(e) => setPharmacyName(e.target.value)}
                        placeholder="مثال: صيدلية المستقبل المتطورة"
                        autoFocus
                        style={{ height: 56, fontSize: 16, borderRadius: 16 }}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="form-group">
                        <label className="form-label font-bold mb-2 block text-xs">رقم الهاتف</label>
                        <input className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010xxxxxxxx" style={{ height: 52, borderRadius: 14 }} />
                      </div>
                      <div className="form-group">
                        <label className="form-label font-bold mb-2 block text-xs">العملة</label>
                        <select className="form-input" value={currency} onChange={(e) => setCurrency(e.target.value)} style={{ height: 52, borderRadius: 14 }}>
                          <option value="EGP">جنيه مصري</option>
                          <option value="SAR">ريال سعودي</option>
                          <option value="AED">درهم إماراتي</option>
                          <option value="USD">دولار أمريكي</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label font-bold mb-2 block text-xs">العنوان</label>
                      <input className="form-input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="العنوان التفصيلي للمقر" style={{ height: 52, borderRadius: 14 }} />
                    </div>
                  </div>

                  <div className="flex gap-4 mt-4">
                    <button className="btn btn-secondary flex-1" style={{ height: 56, borderRadius: 16 }} onClick={() => setStep(0)}>
                      رجوع
                    </button>
                    <button className="btn btn-primary flex-[2]" style={{ height: 56, borderRadius: 16 }} onClick={() => setStep(2)} disabled={!pharmacyName.trim()}>
                      حفظ واستمرار
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Done */}
              {step === 2 && (
                <div className="flex flex-col items-center text-center py-4">
                  <div className="w-24 h-24 rounded-full bg-accent flex items-center justify-center mb-8 shadow-inner animate-bounce">
                    <Check size={48} className="color-primary" />
                  </div>
                  
                  <div className="flex flex-col gap-4 mb-10">
                    <h2 className="text-3xl font-black color-primary">أهلاً بك في المستقبل!</h2>
                    <p className="text-lg text-secondary leading-relaxed">
                      صيدلية <span className="font-bold text-accent-dark">"{pharmacyName}"</span> أصبحت الآن جاهزة للانطلاق.
                    </p>
                  </div>

                  <div className="w-full p-6 bg-light rounded-3xl border-all mb-10 text-right relative overflow-hidden">
                    <div style={{ position: 'absolute', top: -10, left: -10, opacity: 0.1 }}>
                      <Zap size={80} />
                    </div>
                    <div className="text-xs font-bold text-muted uppercase mb-3 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-accent" />
                      تلميح للاحترافية:
                    </div>
                    <p className="text-sm font-medium leading-relaxed color-primary">
                      يمكنك استخدام ميزة <span className="font-bold underline decoration-accent decoration-2">المسح الضوئي للباركود</span> لتسريع عمليات البيع وإضافة المنتجات بضغطة واحدة.
                    </p>
                  </div>

                  <button
                    className="btn btn-primary w-full"
                    style={{ height: 64, fontSize: 18, borderRadius: 20 }}
                    onClick={handleFinish}
                    disabled={saving}
                  >
                    {saving ? 'جارٍ تهيئة النظام...' : 'الدخول إلى لوحة التحكم'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="flex flex-col items-center gap-2 text-muted">
          <div className="flex items-center gap-2 bg-white/50 px-4 py-2 rounded-full border border-all backdrop-blur-sm">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs font-bold">يعمل بدون إنترنت • بياناتك مؤمنة بالكامل</span>
          </div>
          <div className="text-[10px] uppercase tracking-widest font-black opacity-30">Pharma Pro System &copy; 2026</div>
        </div>
      </div>
    </div>
  );
};
