import React, { useState } from 'react';
import { settingsService } from '../../db/storageService';
import { Command, ArrowLeft, Check } from 'lucide-react';

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
    // Mark onboarding as done
    localStorage.setItem('pharma_onboarding_done', '1');
    setSaving(false);
    onComplete();
  };

  return (
    <div className="flex items-center justify-center w-full h-full" style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'var(--bg)',
      direction: 'rtl',
    }}>
      <div style={{ width: '100%', maxWidth: 520, padding: 16 }}>

        {/* Logo */}
        <div className="flex items-center justify-center gap-4 mb-10">
          <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center shadow-sm">
            <Command size={24} className="color-primary" />
          </div>
          <div className="flex-col">
            <div className="text-2xl font-black color-primary">صيدليتي <span className="text-xs font-bold bg-accent-light px-2 py-0.5 rounded-xs" style={{ verticalAlign: 'middle' }}>Pro</span></div>
            <div className="text-xs text-muted font-medium">نظام إدارة الصيدليات المتكامل</div>
          </div>
        </div>

        {/* Step Indicators */}
        <div className="flex justify-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s.key} className={`h-2 rounded-full transition-all duration-300 ${i === step ? 'w-8 bg-accent' : i < step ? 'w-2 bg-accent-dark' : 'w-2 bg-border'}`} />
          ))}
        </div>

        {/* Card */}
        <div className="card p-8 shadow-lg">

          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="text-center flex-col gap-6">
              <div className="flex-col gap-2">
                <div className="text-2xl font-black color-primary">أهلاً وسهلاً!</div>
                <div className="text-sm text-secondary leading-relaxed">
                  نظام صيدليتي Pro هو نظام إدارة صيدلية متكامل يعمل بدون إنترنت.
                  <br />يتضمن: نقطة البيع، المخزون، المشتريات، المرتجعات، الروشتات، والتقارير.
                </div>
              </div>
              <button
                className="btn btn-primary w-full h-52-px"
                style={{ fontSize: 15, height: 52 }}
                onClick={() => setStep(1)}
              >
                ابدأ الإعداد السريع
              </button>
            </div>
          )}

          {/* Step 1: Setup */}
          {step === 1 && (
            <div className="flex-col gap-6">
              <div className="flex-col gap-1">
                <div className="text-lg font-black color-primary">بيانات الصيدلية الأساسية</div>
                <div className="text-xs text-muted">
                  هذه البيانات ستظهر على الفواتير والتقارير الرسمية.
                </div>
              </div>

              <div className="flex-col gap-4">
                <div className="form-group">
                  <label className="form-label">اسم الصيدلية <span className="text-danger">*</span></label>
                  <input
                    className="form-input"
                    value={pharmacyName}
                    onChange={(e) => setPharmacyName(e.target.value)}
                    placeholder="مثال: صيدلية النخبة"
                    autoFocus
                    style={{ height: 48 }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">رقم الهاتف للاتصال</label>
                  <input className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010xxxxxxxx" style={{ height: 48 }} />
                </div>
                <div className="form-group">
                  <label className="form-label">العنوان الجغرافي</label>
                  <input className="form-input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="العنوان التفصيلي" style={{ height: 48 }} />
                </div>
                <div className="form-group">
                  <label className="form-label">عملة النظام</label>
                  <select className="form-input" value={currency} onChange={(e) => setCurrency(e.target.value)} style={{ height: 48 }}>
                    <option value="EGP">جنيه مصري (EGP)</option>
                    <option value="SAR">ريال سعودي (SAR)</option>
                    <option value="AED">درهم إماراتي (AED)</option>
                    <option value="KWD">دينار كويتي (KWD)</option>
                    <option value="USD">دولار أمريكي (USD)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3">
                <button className="btn btn-secondary flex-1" style={{ height: 48 }} onClick={() => setStep(0)}>
                  <ArrowLeft size={16} className="ml-2" /> رجوع
                </button>
                <button className="btn btn-primary flex-2" style={{ height: 48 }} onClick={() => setStep(2)} disabled={!pharmacyName.trim()}>
                  التالي
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Done */}
          {step === 2 && (
            <div className="text-center flex-col gap-6">
              <div className="flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-success-light flex items-center justify-center">
                  <Check size={32} className="color-success" />
                </div>
                <div className="flex-col gap-2">
                  <div className="text-xl font-black color-primary">صيدليتي "{pharmacyName || 'صيدليتي'}" جاهزة!</div>
                  <div className="text-sm text-secondary leading-relaxed">
                    النظام الآن جاهز للعمل بكامل طاقته.
                    <br />تم تحميل البيانات الأولية للبدء الفوري.
                  </div>
                </div>
              </div>

              <div className="p-4 bg-light rounded-lg border-all text-right flex-col gap-2">
                <div className="text-xs font-bold text-muted uppercase tracking-wider">تلميح سريع:</div>
                <div className="text-sm font-medium">
                  استخدم مفتاح <span className="badge badge-neutral mx-1">F2</span> للوصول السريع لمحرك البحث في صفحة المبيعات.
                </div>
              </div>

              <button
                className="btn btn-primary w-full h-52-px"
                style={{ fontSize: 15, height: 52 }}
                onClick={handleFinish}
                disabled={saving}
              >
                {saving ? 'جارٍ الحفظ...' : 'الدخول إلى لوحة التحكم'}
              </button>
            </div>
          )}
        </div>

        <div className="text-center mt-8 text-xs font-medium text-muted">
          <span className="flex items-center justify-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
            يعمل بدون إنترنت • بياناتك مؤمنة ومحفوظة محلياً
          </span>
        </div>
      </div>
    </div>
  );
};
