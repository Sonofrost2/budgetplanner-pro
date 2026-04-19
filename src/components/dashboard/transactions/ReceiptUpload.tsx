import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip, X, Loader2, FileText, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { Link } from 'react-router-dom';

interface Props {
  value: string | null;
  onChange: (url: string | null) => void;
  locale?: string;
}

export const ReceiptUpload = ({ value, onChange, locale = 'fr' }: Props) => {
  const { user } = useAuth();
  const { canUseReceipts } = useSubscription();
  const [uploading, setUploading] = useState(false);
  const fr = locale === 'fr';

  if (!canUseReceipts) {
    return (
      <Link to="/dashboard/payment" className="flex items-center gap-2 p-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors">
        <Lock className="w-4 h-4 text-primary" />
        <span className="text-xs text-primary flex-1 font-semibold">
          {fr ? 'Joindre un reçu — Premium uniquement' : 'Attach receipt — Premium only'}
        </span>
      </Link>
    );
  }

  const handleUpload = async (file: File) => {
    if (!user) return;
    if (file.size > 5 * 1024 * 1024) { toast.error(fr ? 'Max 5 Mo' : 'Max 5MB'); return; }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('receipts').upload(path, file);
      if (error) throw error;
      const { data: signed } = await supabase.storage.from('receipts').createSignedUrl(path, 60 * 60 * 24 * 365);
      onChange(signed?.signedUrl || path);
      toast.success(fr ? 'Pièce jointe ajoutée' : 'Receipt attached');
    } catch (e: any) {
      toast.error(e.message);
    } finally { setUploading(false); }
  };

  return (
    <div className="space-y-2">
      {value ? (
        <div className="flex items-center gap-2 p-2 rounded-xl border border-border bg-muted/30">
          <FileText className="w-4 h-4 text-primary" />
          <a href={value} target="_blank" rel="noreferrer" className="text-xs flex-1 truncate text-primary hover:underline">
            {fr ? 'Voir la pièce jointe' : 'View receipt'}
          </a>
          <Button size="sm" variant="ghost" onClick={() => onChange(null)} className="h-6 w-6 p-0">
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <label className="flex items-center gap-2 p-2 rounded-xl border border-dashed border-border hover:border-primary cursor-pointer transition-colors">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4 text-muted-foreground" />}
          <span className="text-xs text-muted-foreground flex-1">
            {uploading ? (fr ? 'Téléversement...' : 'Uploading...') : (fr ? 'Joindre une pièce (max 5 Mo)' : 'Attach receipt (max 5MB)')}
          </span>
          <input type="file" accept="image/*,application/pdf" className="hidden"
            onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} disabled={uploading} />
        </label>
      )}
    </div>
  );
};
