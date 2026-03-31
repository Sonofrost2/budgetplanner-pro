import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface Asset {
  name: string;
  asset_type: string;
  category: string;
  current_value: number;
  acquisition_cost: number;
  acquisition_date: string | null;
  location: string | null;
  icon: string;
}

interface ExportData {
  assets: Asset[];
  savingsGoals: { name: string; current_amount: number; icon: string }[];
  debts: { creditor_name?: string; total_amount: number; paid_amount: number | null }[];
  netWorth: number;
  totalAssets: number;
  totalSavings: number;
  totalDebt: number;
  totalGainLoss: number;
  projections: { year: string; optimistic: number; base: number; pessimistic: number }[];
  pieData: { name: string; value: number }[];
  isFr: boolean;
  fmt: (n: number) => string;
}

const TYPE_LABELS: Record<string, { fr: string; en: string }> = {
  real_estate: { fr: 'Immobilier', en: 'Real Estate' },
  vehicle: { fr: 'Véhicule', en: 'Vehicle' },
  financial: { fr: 'Investissement', en: 'Investment' },
  savings: { fr: 'Épargne', en: 'Savings' },
  jewelry: { fr: 'Bijoux', en: 'Jewelry' },
  other: { fr: 'Autre', en: 'Other' },
};

export function exportWealthPDF(data: ExportData) {
  const { assets, savingsGoals, debts, netWorth, totalAssets, totalSavings, totalDebt, totalGainLoss, projections, pieData, isFr, fmt } = data;
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();
  const now = new Date().toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  let y = 20;

  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(isFr ? 'Rapport Patrimoine' : 'Wealth Report', w / 2, y, { align: 'center' });
  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120);
  doc.text(now, w / 2, y, { align: 'center' });
  doc.setTextColor(0);
  y += 14;

  // KPI summary box
  doc.setFillColor(245, 245, 250);
  doc.roundedRect(14, y, w - 28, 32, 3, 3, 'F');
  y += 10;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(isFr ? 'Valeur nette' : 'Net Worth', 20, y);
  doc.setFontSize(16);
  doc.text(fmt(netWorth), w - 20, y, { align: 'right' });
  y += 10;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const kpis = [
    `${isFr ? 'Actifs' : 'Assets'}: ${fmt(totalAssets)}`,
    `${isFr ? 'Épargne' : 'Savings'}: ${fmt(totalSavings)}`,
    `${isFr ? 'Dettes' : 'Debts'}: -${fmt(totalDebt)}`,
    `${isFr ? 'Plus-value' : 'Gain'}: ${totalGainLoss >= 0 ? '+' : ''}${fmt(totalGainLoss)}`,
  ];
  doc.text(kpis.join('  •  '), w / 2, y, { align: 'center' });
  y += 18;

  // Allocation table
  if (pieData.length > 0) {
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(isFr ? 'Répartition du patrimoine' : 'Wealth Allocation', 14, y);
    y += 6;
    const total = pieData.reduce((s, d) => s + d.value, 0);
    autoTable(doc, {
      startY: y,
      head: [[isFr ? 'Catégorie' : 'Category', isFr ? 'Valeur' : 'Value', '%']],
      body: pieData.map(d => [d.name, fmt(d.value), `${((d.value / total) * 100).toFixed(1)}%`]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 248, 252] },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // Assets table
  if (assets.length > 0) {
    if (y > 220) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(isFr ? 'Détail des actifs' : 'Asset Details', 14, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [[isFr ? 'Actif' : 'Asset', 'Type', isFr ? 'Catégorie' : 'Category', isFr ? 'Valeur' : 'Value', isFr ? 'Coût' : 'Cost', isFr ? '+/- Value' : 'Gain/Loss']],
      body: assets.map(a => {
        const gain = Number(a.current_value) - Number(a.acquisition_cost || 0);
        return [
          a.name,
          TYPE_LABELS[a.asset_type]?.[isFr ? 'fr' : 'en'] || a.asset_type,
          a.category,
          fmt(a.current_value),
          fmt(a.acquisition_cost || 0),
          `${gain >= 0 ? '+' : ''}${fmt(gain)}`,
        ];
      }),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 248, 252] },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // Savings
  if (savingsGoals.length > 0) {
    if (y > 230) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(isFr ? 'Épargne' : 'Savings', 14, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [[isFr ? 'Objectif' : 'Goal', isFr ? 'Montant' : 'Amount']],
      body: savingsGoals.map(g => [`${g.icon} ${g.name}`, fmt(Number(g.current_amount))]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // Debts
  if (debts.length > 0) {
    if (y > 230) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(isFr ? 'Dettes' : 'Debts', 14, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [[isFr ? 'Créancier' : 'Creditor', 'Total', isFr ? 'Payé' : 'Paid', isFr ? 'Restant' : 'Remaining']],
      body: debts.map(d => [
        (d as any).creditor_name || '-',
        fmt(d.total_amount),
        fmt(Number(d.paid_amount || 0)),
        fmt(d.total_amount - Number(d.paid_amount || 0)),
      ]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [239, 68, 68], textColor: 255, fontStyle: 'bold' },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // Projections
  if (projections.length > 0) {
    if (y > 200) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(isFr ? 'Projections sur 5 ans' : '5-Year Projections', 14, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [[isFr ? 'Année' : 'Year', isFr ? 'Pessimiste' : 'Pessimistic', 'Base', isFr ? 'Optimiste' : 'Optimistic']],
      body: projections.map(p => [p.year, fmt(p.pessimistic), fmt(p.base), fmt(p.optimistic)]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 248, 252] },
      margin: { left: 14, right: 14 },
    });
  }

  // Footer on each page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Page ${i}/${totalPages}`, w / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
    doc.text('BudgetPlanner Pro', 14, doc.internal.pageSize.getHeight() - 10);
  }

  doc.save(`${isFr ? 'rapport-patrimoine' : 'wealth-report'}-${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportWealthExcel(data: ExportData) {
  const { assets, savingsGoals, debts, netWorth, totalAssets, totalSavings, totalDebt, totalGainLoss, projections, pieData, isFr, fmt } = data;
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryRows = [
    [isFr ? 'RAPPORT PATRIMOINE' : 'WEALTH REPORT', '', new Date().toLocaleDateString(isFr ? 'fr-FR' : 'en-US')],
    [],
    [isFr ? 'Valeur nette' : 'Net Worth', netWorth],
    [isFr ? 'Total Actifs' : 'Total Assets', totalAssets],
    [isFr ? 'Total Épargne' : 'Total Savings', totalSavings],
    [isFr ? 'Total Dettes' : 'Total Debts', totalDebt],
    [isFr ? 'Plus/Moins-value' : 'Total Gain/Loss', totalGainLoss],
    [],
    [isFr ? 'RÉPARTITION' : 'ALLOCATION'],
    [isFr ? 'Catégorie' : 'Category', isFr ? 'Valeur' : 'Value', '%'],
    ...pieData.map(d => {
      const total = pieData.reduce((s, p) => s + p.value, 0);
      return [d.name, d.value, total > 0 ? Number(((d.value / total) * 100).toFixed(1)) : 0];
    }),
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 25 }, { wch: 18 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, isFr ? 'Résumé' : 'Summary');

  // Assets sheet
  if (assets.length > 0) {
    const assetRows = [
      [isFr ? 'Actif' : 'Asset', 'Type', isFr ? 'Catégorie' : 'Category', isFr ? 'Valeur actuelle' : 'Current Value', isFr ? 'Coût acquisition' : 'Acquisition Cost', isFr ? 'Plus/Moins-value' : 'Gain/Loss', isFr ? 'Localisation' : 'Location', isFr ? 'Date acquisition' : 'Acquisition Date'],
      ...assets.map(a => [
        a.name,
        TYPE_LABELS[a.asset_type]?.[isFr ? 'fr' : 'en'] || a.asset_type,
        a.category,
        Number(a.current_value),
        Number(a.acquisition_cost || 0),
        Number(a.current_value) - Number(a.acquisition_cost || 0),
        a.location || '',
        a.acquisition_date || '',
      ]),
    ];
    const wsAssets = XLSX.utils.aoa_to_sheet(assetRows);
    wsAssets['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsAssets, isFr ? 'Actifs' : 'Assets');
  }

  // Savings sheet
  if (savingsGoals.length > 0) {
    const savRows = [
      [isFr ? 'Objectif' : 'Goal', isFr ? 'Montant actuel' : 'Current Amount'],
      ...savingsGoals.map(g => [g.name, Number(g.current_amount)]),
    ];
    const wsSav = XLSX.utils.aoa_to_sheet(savRows);
    wsSav['!cols'] = [{ wch: 25 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsSav, isFr ? 'Épargne' : 'Savings');
  }

  // Debts sheet
  if (debts.length > 0) {
    const debtRows = [
      [isFr ? 'Créancier' : 'Creditor', 'Total', isFr ? 'Payé' : 'Paid', isFr ? 'Restant' : 'Remaining'],
      ...debts.map(d => [
        (d as any).creditor_name || '-',
        d.total_amount,
        Number(d.paid_amount || 0),
        d.total_amount - Number(d.paid_amount || 0),
      ]),
    ];
    const wsDebt = XLSX.utils.aoa_to_sheet(debtRows);
    wsDebt['!cols'] = [{ wch: 25 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsDebt, isFr ? 'Dettes' : 'Debts');
  }

  // Projections sheet
  if (projections.length > 0) {
    const projRows = [
      [isFr ? 'Année' : 'Year', isFr ? 'Pessimiste' : 'Pessimistic', 'Base', isFr ? 'Optimiste' : 'Optimistic'],
      ...projections.map(p => [p.year, p.pessimistic, p.base, p.optimistic]),
    ];
    const wsProj = XLSX.utils.aoa_to_sheet(projRows);
    wsProj['!cols'] = [{ wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsProj, 'Projections');
  }

  XLSX.writeFile(wb, `${isFr ? 'rapport-patrimoine' : 'wealth-report'}-${new Date().toISOString().split('T')[0]}.xlsx`);
}
