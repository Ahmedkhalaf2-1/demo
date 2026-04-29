import React from 'react';
import { format } from 'date-fns';
import type { Sale } from '../../types';

interface Props {
  sale: Sale;
  pharmacyName: string;
}

const formatCurrency = (n: number) =>
  n.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 });

export const ReceiptPrint: React.FC<Props> = ({ sale, pharmacyName }) => {
  return (
    <div className="thermal-receipt">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .thermal-receipt, .thermal-receipt * { visibility: visible; }
          .thermal-receipt { 
            position: absolute; 
            left: 50%; 
            top: 20mm; 
            transform: translateX(-50%);
            width: 148mm; 
            padding: 10mm; 
            margin: 0 auto;
            border: 1px solid #ddd;
          }
        }
        .thermal-receipt { 
          font-family: system-ui, -apple-system, sans-serif; 
          font-size: 15px; 
          color: #000; 
          display: none; 
          line-height: 1.6;
        }
        @media print {
          .thermal-receipt { display: block; }
        }
        .receipt-divider { border-bottom: 2px dashed #333; margin: 16px 0; }
        .flex-between { display: flex; justify-content: space-between; padding: 4px 0; }
      `}</style>

      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 18, marginBottom: 4 }}>
        {pharmacyName}
      </div>
      <div style={{ textAlign: 'center', fontSize: 11, marginBottom: 12 }}>
        فاتورة ضريبية مبسطة
      </div>
      
      <div className="flex-between">
        <span>التاريخ:</span>
        <span>{format(new Date(sale.createdAt), 'yyyy-MM-dd HH:mm')}</span>
      </div>
      <div className="flex-between" style={{ marginBottom: 4 }}>
        <span>رقم الفاتورة:</span>
        <span>#{sale.id.slice(-8).toUpperCase()}</span>
      </div>
      <div className="receipt-divider" />

      <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #000' }}>
            <th style={{ paddingBottom: 8, fontSize: '15px' }}>الصنف</th>
            <th style={{ textAlign: 'center', paddingBottom: 8, fontSize: '15px' }}>الكمية</th>
            <th style={{ textAlign: 'left', paddingBottom: 8, fontSize: '15px' }}>السعر</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map(item => (
            <tr key={item.id} style={{ borderBottom: '1px solid #ddd' }}>
              <td style={{ padding: '12px 0', fontSize: '14.5px', fontWeight: 600 }}>{item.productName}</td>
              <td style={{ textAlign: 'center', padding: '12px 0', fontSize: '14.5px' }}>{item.quantity}</td>
              <td style={{ textAlign: 'left', padding: '12px 0', fontSize: '14.5px', fontWeight: 700 }}>{formatCurrency(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <div className="receipt-divider" style={{ marginTop: 16 }} />
      
      <div className="flex-between" style={{ fontSize: '14.5px', padding: '6px 0' }}>
        <span>الإجمالي قبل الخصم:</span>
        <span style={{ fontWeight: 600 }}>{formatCurrency(sale.subtotal)}</span>
      </div>
      {sale.discountTotal > 0 && (
        <div className="flex-between" style={{ fontSize: '14.5px', padding: '6px 0' }}>
          <span>الخصم:</span>
          <span style={{ color: '#d32f2f', fontWeight: 600 }}>{formatCurrency(sale.discountTotal)}</span>
        </div>
      )}
      
      <div className="flex-between" style={{ fontWeight: 'bold', fontSize: '18px', padding: '10px 0', borderTop: '2px solid #000', marginTop: 12 }}>
        <span>الإجمالي النهائي:</span>
        <span>{formatCurrency(sale.total)}</span>
      </div>
      
      <div className="receipt-divider" />
      
      <div style={{ textAlign: 'center', fontSize: 11, marginTop: 16 }}>
        شكراً لزيارتكم!
        <br />
        مع تمنياتنا بالشفاء العاجل.
      </div>
    </div>
  );
};
