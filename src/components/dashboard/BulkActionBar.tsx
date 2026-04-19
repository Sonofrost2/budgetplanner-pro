import { Button } from '@/components/ui/button';
import { Trash2, Download, Pencil, Copy, X } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';

interface BulkActionBarProps {
  count: number;
  onDelete?: () => void;
  onModify?: () => void;
  onDuplicate?: () => void;
  onExportCSV?: () => void;
  onExportExcel?: () => void;
  onClear: () => void;
  extraActions?: React.ReactNode;
}

const BulkActionBar = ({ count, onDelete, onModify, onDuplicate, onExportCSV, onExportExcel, onClear, extraActions }: BulkActionBarProps) => {
  const { locale } = useLanguage();
  const t = dashT[locale];

  return (
    <div className="flex items-center gap-2 sm:gap-3 p-3 rounded-xl bg-primary/10 border border-primary/20 flex-wrap">
      <span className="text-sm font-semibold text-primary whitespace-nowrap">
        {count} {locale === 'fr' ? 'sélectionné(s)' : 'selected'}
      </span>
      <div className="flex-1" />
      <div className="flex items-center gap-1.5 flex-wrap">
        {extraActions}
        {onModify && (
          <Button variant="outline" size="sm" className="rounded-xl" onClick={onModify}>
            <Pencil className="w-3.5 h-3.5 mr-1" />{locale === 'fr' ? 'Modifier' : 'Modify'}
          </Button>
        )}
        {onDuplicate && (
          <Button variant="outline" size="sm" className="rounded-xl" onClick={onDuplicate}>
            <Copy className="w-3.5 h-3.5 mr-1" />{locale === 'fr' ? 'Dupliquer' : 'Duplicate'}
          </Button>
        )}
        {onExportCSV && (
          <Button variant="outline" size="sm" className="rounded-xl" onClick={onExportCSV}>
            <Download className="w-3.5 h-3.5 mr-1" />CSV
          </Button>
        )}
        {onExportExcel && (
          <Button variant="outline" size="sm" className="rounded-xl" onClick={onExportExcel}>
            <Download className="w-3.5 h-3.5 mr-1" />Excel
          </Button>
        )}
        {onDelete && (
          <Button variant="destructive" size="sm" className="rounded-xl" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5 mr-1" />{t.delete}
          </Button>
        )}
        <Button variant="ghost" size="sm" className="rounded-xl" onClick={onClear}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
};

export default BulkActionBar;
