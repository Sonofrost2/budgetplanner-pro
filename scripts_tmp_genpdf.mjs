import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import fs from 'fs';

const sanitizePdfText = (s) => {
  if (s == null) return '';
  return String(s)
    .replace(/[\u00A0\u202F\u2009\u2007]/g, ' ')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2022\u00B7]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u20AC/g, 'EUR')
    .replace(/[^\x00-\xFF]/g, '?');
};
const formatAmountAscii = (n, currency, locale) => {
  const isFr = locale === 'fr';
  const hasCents = !['XOF','XAF'].includes(currency);
  const formatted = n.toLocaleString(isFr?'fr-FR':'en-US',{minimumFractionDigits:hasCents?2:0,maximumFractionDigits:hasCents?2:0}).replace(/[\u00A0\u202F\u2009]/g,' ');
  return `${formatted} ${currency}`;
};

const receipt = { id:'a1b2c3d4-e5f6', plan_name:'pro', amount:8990, currency:'XOF', status:'confirmed', payment_token:'5cqxd05g80abc', created_at:'2026-05-02T01:12:00Z' };
const ctx = { locale:'fr', userEmail:'cedric.gahou19@gmail.com', displayName:'Cédric Gahou', plan:{name:'pro', features:['Transactions illimitées','Budgets avancés','Rapports PDF/CSV','Coach Financier IA','Support prioritaire']}, subscriptionPeriodStart:'2026-05-02', subscriptionPeriodEnd:'2026-06-02', paymentMethod:'paystack' };

// Inline the same downloadReceiptPDF logic
const isFr = ctx.locale === 'fr';
const tt = (f,e)=>isFr?f:e;
const doc = new jsPDF({unit:'mm',format:'a4'});
const pageW = doc.internal.pageSize.getWidth();
const pageH = doc.internal.pageSize.getHeight();
doc.setFillColor(76,81,191); doc.rect(0,0,pageW,42,'F');
doc.setFillColor(99,102,241); doc.rect(0,30,pageW,12,'F');
doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(20);
doc.text(sanitizePdfText('Budget Planner Pro'),20,20);
doc.setFont('helvetica','normal'); doc.setFontSize(9);
doc.text(sanitizePdfText(tt('Gestion budgetaire intelligente','Smart budget management')),20,27);
doc.setFont('helvetica','bold'); doc.setFontSize(13);
doc.text(sanitizePdfText(tt('RECU DE PAIEMENT','PAYMENT RECEIPT')),pageW-20,20,{align:'right'});
doc.setFont('helvetica','normal'); doc.setFontSize(9);
const refShort = receipt.payment_token ? String(receipt.payment_token).slice(0,16) : receipt.id.slice(0,8);
doc.text(sanitizePdfText(`N° ${refShort}`),pageW-20,27,{align:'right'});

let y=56;
const dateStr = format(new Date(receipt.created_at),'dd MMMM yyyy - HH:mm',{locale:fr});
doc.setTextColor(110,110,120); doc.setFontSize(8); doc.setFont('helvetica','normal');
doc.text(sanitizePdfText(tt('Emis le','Issued on').toUpperCase()),20,y);
doc.setTextColor(30,30,40); doc.setFont('helvetica','bold'); doc.setFontSize(10);
doc.text(sanitizePdfText(dateStr),20,y+5);

const isConfirmed=receipt.status==='confirmed';
const pillColor=isConfirmed?[16,185,129]:[245,158,11];
const statusLabel = isConfirmed?tt('CONFIRME','CONFIRMED'):tt('EN ATTENTE','PENDING');
const pillTextW = doc.getTextWidth(statusLabel);
const pillW = pillTextW+12;
const pillX = pageW-20-pillW;
doc.setFillColor(...pillColor);
doc.roundedRect(pillX,y-2,pillW,8,2,2,'F');
doc.setTextColor(255,255,255); doc.setFontSize(8); doc.setFont('helvetica','bold');
doc.text(sanitizePdfText(statusLabel),pillX+pillW/2,y+3.6,{align:'center'});

y=78;
doc.setDrawColor(230,230,235); doc.line(20,y-4,pageW-20,y-4);
doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(110,110,120);
doc.text(sanitizePdfText(tt('FACTURE A','BILLED TO')),20,y);
doc.setFont('helvetica','normal'); doc.setTextColor(30,30,40); doc.setFontSize(10);
doc.text(sanitizePdfText(ctx.displayName),20,y+6);
doc.setFontSize(9); doc.setTextColor(110,110,120);
doc.text(sanitizePdfText(ctx.userEmail),20,y+11);
doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(110,110,120);
doc.text(sanitizePdfText(tt('FOURNISSEUR','VENDOR')),pageW-20,y,{align:'right'});
doc.setFont('helvetica','normal'); doc.setTextColor(30,30,40); doc.setFontSize(10);
doc.text(sanitizePdfText('Budget Planner Pro'),pageW-20,y+6,{align:'right'});
doc.setFontSize(9); doc.setTextColor(110,110,120);
doc.text(sanitizePdfText('support@budget-planner-pro.eurekaci.dev'),pageW-20,y+11,{align:'right'});

y=110;
doc.setFillColor(244,245,250); doc.rect(20,y,pageW-40,9,'F');
doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(80,80,95);
doc.text(sanitizePdfText('DESCRIPTION'),24,y+6);
doc.text(sanitizePdfText('PERIODE'),pageW/2,y+6);
doc.text(sanitizePdfText('MONTANT'),pageW-24,y+6,{align:'right'});
y+=12;
const planName = ctx.plan.name;
const planLabel = `Abonnement ${planName.charAt(0).toUpperCase()+planName.slice(1)}`;
const ps = format(new Date(ctx.subscriptionPeriodStart),'dd/MM/yyyy');
const pe = format(new Date(ctx.subscriptionPeriodEnd),'dd/MM/yyyy');
const periodLabel = `${ps} -> ${pe}`;
doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(30,30,40);
doc.text(sanitizePdfText(planLabel),24,y+4);
doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(110,110,120);
doc.text(sanitizePdfText(periodLabel),pageW/2,y+4);
doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(30,30,40);
doc.text(sanitizePdfText(formatAmountAscii(receipt.amount,receipt.currency,'fr')),pageW-24,y+4,{align:'right'});
y+=12;
doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(110,110,120);
ctx.plan.features.slice(0,5).forEach(f=>{ doc.text(sanitizePdfText(`- ${f}`),28,y); y+=4.5; });
y+=3;
doc.setDrawColor(230,230,235); doc.line(20,y,pageW-20,y); y+=8;

const totalsX = pageW-90;
const writeTotal = (label,value,bold=false)=>{
  doc.setFontSize(9); doc.setFont('helvetica',bold?'bold':'normal');
  doc.setTextColor(bold?30:110,bold?30:110,bold?40:120);
  doc.text(sanitizePdfText(label),totalsX,y);
  doc.setTextColor(30,30,40); doc.setFont('helvetica',bold?'bold':'normal');
  doc.text(sanitizePdfText(value),pageW-20,y,{align:'right'}); y+=6;
};
writeTotal('Sous-total',formatAmountAscii(receipt.amount,receipt.currency,'fr'));
writeTotal('Taxes',formatAmountAscii(0,receipt.currency,'fr'));
y+=1;
doc.setDrawColor(230,230,235); doc.line(totalsX,y-3,pageW-20,y-3); y+=2;
doc.setFillColor(244,245,250); doc.rect(totalsX-4,y-5,pageW-20-totalsX+4,10,'F');
doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(76,81,191);
doc.text(sanitizePdfText('TOTAL PAYE'),totalsX,y+1);
doc.text(sanitizePdfText(formatAmountAscii(receipt.amount,receipt.currency,'fr')),pageW-20,y+1,{align:'right'});
y+=14;

y+=4;
doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(110,110,120);
doc.text(sanitizePdfText('DETAILS DU PAIEMENT'),20,y); y+=6;
const detailRow=(l,v)=>{
  doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(110,110,120);
  doc.text(sanitizePdfText(l),20,y);
  doc.setTextColor(30,30,40); doc.setFont('helvetica','bold');
  doc.text(sanitizePdfText(v),80,y); y+=5.5;
};
detailRow('Methode','PAYSTACK');
detailRow('Devise',receipt.currency);
detailRow('Reference',receipt.payment_token);
detailRow('ID transaction',receipt.id);

y=pageH-50;
doc.setDrawColor(230,230,235); doc.line(20,y,pageW-20,y); y+=8;
doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(76,81,191);
doc.text(sanitizePdfText('Merci pour votre confiance !'),pageW/2,y,{align:'center'}); y+=5;
doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(110,110,120);
doc.text(sanitizePdfText('Ce document tient lieu de recu officiel. Conservez-le pour vos archives.'),pageW/2,y,{align:'center'});
doc.setFontSize(7); doc.setTextColor(160,160,170);
doc.text(sanitizePdfText(`© ${new Date().getFullYear()} Budget Planner Pro - support@budget-planner-pro.eurekaci.dev`),pageW/2,pageH-10,{align:'center'});

fs.writeFileSync('/tmp/preview.pdf', Buffer.from(doc.output('arraybuffer')));
console.log('done');
