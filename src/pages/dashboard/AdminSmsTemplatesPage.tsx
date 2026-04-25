import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { HeroHeaderShell } from '@/components/dashboard/HeroHeaderShell';
import { MessageSquareText, Save, RotateCcw, Send, Eye, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  SMS_TEMPLATES,
  SMS_TEMPLATE_SAMPLES,
  type SmsTemplateId,
  extractPlaceholders,
  getDefaultBodies,
  renderBody,
} from '@/lib/smsTemplates';

type Override = { template_id: string; body_fr: string; body_en: string };

const AdminSmsTemplatesPage = () => {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useRole();
  const { locale } = useLanguage();
  const isFr = locale === 'fr';

  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [drafts, setDrafts] = useState<Record<string, { fr: string; en: string }>>({});
  const [vars, setVars] = useState<Record<string, Record<string, string>>>({});
  const [activeId, setActiveId] = useState<SmsTemplateId>(SMS_TEMPLATES[0].id);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [phone, setPhone] = useState('');

  // Initial load
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: ovs }, { data: prof }] = await Promise.all([
        supabase.from('sms_template_overrides').select('template_id, body_fr, body_en'),
        supabase.from('profiles').select('phone').eq('user_id', user.id).single(),
      ]);
      setPhone(prof?.phone || '');

      const map: Record<string, Override> = {};
      (ovs || []).forEach((o: any) => { map[o.template_id] = o; });
      setOverrides(map);

      // Build initial drafts from overrides or defaults
      const d: Record<string, { fr: string; en: string }> = {};
      const v: Record<string, Record<string, string>> = {};
      for (const t of SMS_TEMPLATES) {
        const def = getDefaultBodies(t.id);
        d[t.id] = {
          fr: map[t.id]?.body_fr ?? def.fr,
          en: map[t.id]?.body_en ?? def.en,
        };
        const sample = SMS_TEMPLATE_SAMPLES[t.id] || {};
        v[t.id] = Object.fromEntries(Object.entries(sample).map(([k, val]) => [k, String(val)]));
      }
      setDrafts(d);
      setVars(v);
    })();
  }, [user]);

  const activeTpl = SMS_TEMPLATES.find(t => t.id === activeId)!;
  const activeDraft = drafts[activeId] || { fr: '', en: '' };
  const activeVars = vars[activeId] || {};

  // Auto-detect placeholders from current body (FR + EN union)
  const placeholders = useMemo(() => {
    const set = new Set<string>([
      ...extractPlaceholders(activeDraft.fr),
      ...extractPlaceholders(activeDraft.en),
    ]);
    return Array.from(set);
  }, [activeDraft.fr, activeDraft.en]);

  const previewFr = useMemo(() => renderBody(activeDraft.fr, activeVars), [activeDraft.fr, activeVars]);
  const previewEn = useMemo(() => renderBody(activeDraft.en, activeVars), [activeDraft.en, activeVars]);

  const isDirty = useMemo(() => {
    const def = getDefaultBodies(activeId);
    const ov = overrides[activeId];
    const baseFr = ov?.body_fr ?? def.fr;
    const baseEn = ov?.body_en ?? def.en;
    return activeDraft.fr !== baseFr || activeDraft.en !== baseEn;
  }, [activeDraft, overrides, activeId]);

  if (roleLoading) return <div className="p-6 text-sm text-muted-foreground">{isFr ? 'Chargement…' : 'Loading…'}</div>;
  if (!isAdmin) {
    return (
      <Card className="rounded-2xl glass border-destructive/30 max-w-xl mx-auto mt-8">
        <CardContent className="p-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">{isFr ? 'Accès réservé aux administrateurs' : 'Admins only'}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {isFr ? 'Cette page nécessite le rôle administrateur.' : 'This page requires the admin role.'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleBodyChange = (lang: 'fr' | 'en', value: string) => {
    setDrafts(prev => ({ ...prev, [activeId]: { ...prev[activeId], [lang]: value } }));
  };

  const handleVarChange = (key: string, value: string) => {
    setVars(prev => ({ ...prev, [activeId]: { ...prev[activeId], [key]: value } }));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('sms_template_overrides')
      .upsert({
        template_id: activeId,
        body_fr: activeDraft.fr,
        body_en: activeDraft.en,
        updated_by: user.id,
      }, { onConflict: 'template_id' });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setOverrides(prev => ({
      ...prev,
      [activeId]: { template_id: activeId, body_fr: activeDraft.fr, body_en: activeDraft.en },
    }));
    toast.success(isFr ? 'Modèle enregistré' : 'Template saved');
  };

  const handleResetToDefault = () => {
    const def = getDefaultBodies(activeId);
    setDrafts(prev => ({ ...prev, [activeId]: { fr: def.fr, en: def.en } }));
    toast.info(isFr ? 'Modèle restauré (non enregistré)' : 'Template reset (not yet saved)');
  };

  const handleDeleteOverride = async () => {
    if (!overrides[activeId]) {
      handleResetToDefault();
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('sms_template_overrides')
      .delete()
      .eq('template_id', activeId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    const def = getDefaultBodies(activeId);
    setOverrides(prev => {
      const next = { ...prev };
      delete next[activeId];
      return next;
    });
    setDrafts(prev => ({ ...prev, [activeId]: { fr: def.fr, en: def.en } }));
    toast.success(isFr ? 'Personnalisation supprimée' : 'Override removed');
  };

  const handleTestSend = async (lang: 'fr' | 'en') => {
    if (!phone) {
      toast.error(isFr ? 'Aucun numéro dans votre profil' : 'No phone on your profile');
      return;
    }
    if (!/^\+\d{8,15}$/.test(phone)) {
      toast.error(isFr ? 'Numéro invalide (format E.164 requis)' : 'Invalid phone (E.164 required)');
      return;
    }
    const body = lang === 'fr' ? previewFr : previewEn;
    if (!body.trim()) { toast.error(isFr ? 'Message vide' : 'Empty message'); return; }
    setSending(true);
    const { data, error } = await supabase.functions.invoke('send-sms', { body: { to: phone, body, template_id: activeId } });
    setSending(false);
    if (error || (data as any)?.error) {
      toast.error((error?.message || (data as any)?.error) ?? 'Error');
      return;
    }
    toast.success(isFr ? `SMS envoyé (${lang.toUpperCase()})` : `SMS sent (${lang.toUpperCase()})`);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <HeroHeaderShell topBlobClassName="bg-primary/25" bottomBlobClassName="bg-accent/15">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'var(--gradient-primary)' }}>
            <MessageSquareText className="w-7 h-7 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{isFr ? 'Admin' : 'Admin'}</span>
            <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight">{isFr ? 'Modèles SMS' : 'SMS templates'}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{isFr ? 'Personnalisez les messages envoyés aux utilisateurs (FR + EN)' : 'Customize messages sent to users (FR + EN)'}</p>
          </div>
        </div>
      </HeroHeaderShell>

      <div className="grid lg:grid-cols-[260px_1fr] gap-6">
        {/* Template list */}
        <Card className="rounded-2xl glass border-border/50 self-start lg:sticky lg:top-4">
          <CardContent className="p-2 flex flex-col gap-1 max-h-[70vh] overflow-y-auto">
            {SMS_TEMPLATES.map(t => {
              const active = t.id === activeId;
              const customized = !!overrides[t.id];
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveId(t.id)}
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-left transition-all ${active ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted/40'}`}
                >
                  <span className="text-xs font-semibold truncate">{isFr ? t.label_fr : t.label_en}</span>
                  {customized && (
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${active ? 'bg-primary-foreground/20' : 'bg-accent/20 text-accent'}`}>
                      {isFr ? 'Perso' : 'Custom'}
                    </span>
                  )}
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Editor */}
        <div className="space-y-5 min-w-0">
          <Card className="rounded-2xl glass border-border/50">
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-lg font-bold font-display leading-tight">{isFr ? activeTpl.label_fr : activeTpl.label_en}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono">{activeTpl.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  {overrides[activeId] && (
                    <Badge variant="outline" className="rounded-full text-[10px]">{isFr ? 'Personnalisé' : 'Customized'}</Badge>
                  )}
                  {isDirty && (
                    <Badge className="rounded-full text-[10px] bg-warning/15 text-warning border-warning/20">{isFr ? 'Non enregistré' : 'Unsaved'}</Badge>
                  )}
                </div>
              </div>

              <Tabs defaultValue="fr">
                <TabsList className="rounded-xl">
                  <TabsTrigger value="fr" className="rounded-lg text-xs">🇫🇷 Français</TabsTrigger>
                  <TabsTrigger value="en" className="rounded-lg text-xs">🇬🇧 English</TabsTrigger>
                </TabsList>
                <TabsContent value="fr" className="space-y-2 mt-3">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{isFr ? 'Corps du message' : 'Message body'}</Label>
                  <Textarea
                    value={activeDraft.fr}
                    onChange={e => handleBodyChange('fr', e.target.value)}
                    rows={3}
                    className="rounded-xl font-mono text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">{activeDraft.fr.length} {isFr ? 'caractères' : 'characters'}</p>
                </TabsContent>
                <TabsContent value="en" className="space-y-2 mt-3">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{isFr ? 'Corps du message' : 'Message body'}</Label>
                  <Textarea
                    value={activeDraft.en}
                    onChange={e => handleBodyChange('en', e.target.value)}
                    rows={3}
                    className="rounded-xl font-mono text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">{activeDraft.en.length} {isFr ? 'caractères' : 'characters'}</p>
                </TabsContent>
              </Tabs>

              <div className="flex items-center gap-2 flex-wrap">
                <Button onClick={handleSave} disabled={saving || !isDirty} className="rounded-xl text-primary-foreground" style={{ background: 'var(--gradient-primary)' }}>
                  <Save className="w-3.5 h-3.5 mr-1.5" />{saving ? '...' : (isFr ? 'Enregistrer' : 'Save')}
                </Button>
                <Button variant="outline" onClick={handleResetToDefault} className="rounded-xl">
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />{isFr ? 'Restaurer défaut' : 'Reset to default'}
                </Button>
                {overrides[activeId] && (
                  <Button variant="ghost" onClick={handleDeleteOverride} className="rounded-xl text-destructive hover:bg-destructive/10">
                    {isFr ? 'Supprimer la personnalisation' : 'Remove override'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Variables */}
          <Card className="rounded-2xl glass border-border/50">
            <CardContent className="p-5 sm:p-6 space-y-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-bold">{isFr ? 'Variables détectées' : 'Detected variables'}</h3>
                <Badge variant="outline" className="rounded-full text-[10px]">{placeholders.length}</Badge>
              </div>
              {placeholders.length === 0 ? (
                <p className="text-xs text-muted-foreground">{isFr ? 'Aucune variable. Utilisez {nom_variable} dans le corps.' : 'No variables. Use {var_name} in the body.'}</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {placeholders.map(k => (
                    <div key={k} className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">{`{${k}}`}</Label>
                      <Input
                        value={activeVars[k] ?? ''}
                        onChange={e => handleVarChange(k, e.target.value)}
                        placeholder={isFr ? 'valeur de test' : 'test value'}
                        className="rounded-xl h-9 text-xs"
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preview */}
          <Card className="rounded-2xl glass border-border/50">
            <CardContent className="p-5 sm:p-6 space-y-4">
              <h3 className="text-sm font-bold">{isFr ? 'Aperçu rendu' : 'Rendered preview'}</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">🇫🇷 Français</Label>
                    <Button size="sm" variant="outline" onClick={() => handleTestSend('fr')} disabled={sending || !phone} className="rounded-lg h-7 text-[11px]">
                      <Send className="w-3 h-3 mr-1" />{isFr ? 'Tester FR' : 'Test FR'}
                    </Button>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/40 border border-border/40 text-xs leading-relaxed whitespace-pre-wrap break-words">
                    {previewFr || <span className="text-muted-foreground italic">{isFr ? '(vide)' : '(empty)'}</span>}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{previewFr.length} {isFr ? 'caractères' : 'characters'}</p>
                </div>
                <Separator />
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">🇬🇧 English</Label>
                    <Button size="sm" variant="outline" onClick={() => handleTestSend('en')} disabled={sending || !phone} className="rounded-lg h-7 text-[11px]">
                      <Send className="w-3 h-3 mr-1" />{isFr ? 'Tester EN' : 'Test EN'}
                    </Button>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/40 border border-border/40 text-xs leading-relaxed whitespace-pre-wrap break-words">
                    {previewEn || <span className="text-muted-foreground italic">{isFr ? '(vide)' : '(empty)'}</span>}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{previewEn.length} {isFr ? 'caractères' : 'characters'}</p>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {isFr ? 'Les SMS de test sont envoyés à votre numéro de profil : ' : 'Test SMS will be sent to your profile phone: '}
                <span className="font-mono">{phone || (isFr ? '— non défini —' : '— not set —')}</span>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminSmsTemplatesPage;