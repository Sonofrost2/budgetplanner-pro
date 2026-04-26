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
import { MessageSquareText, Save, RotateCcw, Send, Eye, AlertTriangle, Mail, MessageCircle, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import {
  MESSAGE_TEMPLATES,
  MESSAGE_TEMPLATE_SAMPLES,
  DEFAULT_BODIES,
  DEFAULT_EMAIL_BODIES,
  type MessageTemplateId,
  type MessageChannel,
  extractPlaceholders,
  renderMsg,
} from '@/lib/messageTemplates';

/* eslint-disable @typescript-eslint/no-explicit-any */
const sb: any = supabase;

type OverrideRow = {
  channel: MessageChannel;
  template_id: string;
  body_fr: string | null;
  body_en: string | null;
  subject_fr: string | null;
  subject_en: string | null;
  html_fr: string | null;
  html_en: string | null;
};

type Draft = {
  body_fr: string;
  body_en: string;
  subject_fr: string;
  subject_en: string;
  html_fr: string;
  html_en: string;
};

type Key = `${MessageChannel}:${MessageTemplateId}`;
const k = (c: MessageChannel, t: MessageTemplateId): Key => `${c}:${t}`;

const CHANNELS: { id: MessageChannel; label_fr: string; label_en: string; icon: typeof Mail }[] = [
  { id: 'email', label_fr: 'Email', label_en: 'Email', icon: Mail },
  { id: 'sms', label_fr: 'SMS', label_en: 'SMS', icon: Smartphone },
  { id: 'whatsapp', label_fr: 'WhatsApp', label_en: 'WhatsApp', icon: MessageCircle },
];

function buildDefaultDraft(channel: MessageChannel, id: MessageTemplateId): Draft {
  if (channel === 'email') {
    const e = DEFAULT_EMAIL_BODIES[id];
    return {
      body_fr: '', body_en: '',
      subject_fr: e.subject_fr, subject_en: e.subject_en,
      html_fr: e.html_fr, html_en: e.html_en,
    };
  }
  const def = DEFAULT_BODIES[channel][id];
  return {
    body_fr: def.fr, body_en: def.en,
    subject_fr: '', subject_en: '', html_fr: '', html_en: '',
  };
}

const AdminSmsTemplatesPage = () => {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useRole();
  const { locale } = useLanguage();
  const isFr = locale === 'fr';

  const [overrides, setOverrides] = useState<Record<Key, OverrideRow>>({} as Record<Key, OverrideRow>);
  const [drafts, setDrafts] = useState<Record<Key, Draft>>({} as Record<Key, Draft>);
  const [vars, setVars] = useState<Record<MessageTemplateId, Record<string, string>>>({} as any);

  const [activeChannel, setActiveChannel] = useState<MessageChannel>('email');
  const [activeId, setActiveId] = useState<MessageTemplateId>(MESSAGE_TEMPLATES[0].id);
  const [activeLang, setActiveLang] = useState<'fr' | 'en'>('fr');

  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Initial load
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: ovs }, { data: prof }] = await Promise.all([
        sb.from('message_template_overrides').select('channel, template_id, body_fr, body_en, subject_fr, subject_en, html_fr, html_en'),
        sb.from('profiles').select('phone').eq('user_id', user.id).single(),
      ]);
      setPhone(prof?.phone || '');
      setEmail(user.email || '');

      const ovMap: Record<Key, OverrideRow> = {} as Record<Key, OverrideRow>;
      (ovs || []).forEach((o: OverrideRow) => { ovMap[k(o.channel, o.template_id as MessageTemplateId)] = o; });
      setOverrides(ovMap);

      const d: Record<Key, Draft> = {} as Record<Key, Draft>;
      for (const ch of CHANNELS) {
        for (const t of MESSAGE_TEMPLATES) {
          const key = k(ch.id, t.id);
          const def = buildDefaultDraft(ch.id, t.id);
          const ov = ovMap[key];
          d[key] = {
            body_fr: ov?.body_fr ?? def.body_fr,
            body_en: ov?.body_en ?? def.body_en,
            subject_fr: ov?.subject_fr ?? def.subject_fr,
            subject_en: ov?.subject_en ?? def.subject_en,
            html_fr: ov?.html_fr ?? def.html_fr,
            html_en: ov?.html_en ?? def.html_en,
          };
        }
      }
      setDrafts(d);

      const v: Record<MessageTemplateId, Record<string, string>> = {} as any;
      for (const t of MESSAGE_TEMPLATES) {
        const sample = MESSAGE_TEMPLATE_SAMPLES[t.id] || {};
        v[t.id] = Object.fromEntries(Object.entries(sample).map(([kk, val]) => [kk, String(val)]));
      }
      setVars(v);
    })();
  }, [user]);

  const activeKey = k(activeChannel, activeId);
  const activeTpl = MESSAGE_TEMPLATES.find(t => t.id === activeId)!;
  const activeDraft = drafts[activeKey] || buildDefaultDraft(activeChannel, activeId);
  const activeVars = vars[activeId] || {};

  const placeholders = useMemo(() => {
    const sources = activeChannel === 'email'
      ? [activeDraft.subject_fr, activeDraft.subject_en, activeDraft.html_fr, activeDraft.html_en]
      : [activeDraft.body_fr, activeDraft.body_en];
    return extractPlaceholders(...sources);
  }, [activeDraft, activeChannel]);

  const previewSubject = useMemo(
    () => renderMsg(activeLang === 'fr' ? activeDraft.subject_fr : activeDraft.subject_en, activeVars),
    [activeDraft, activeLang, activeVars],
  );
  const previewHtml = useMemo(
    () => renderMsg(activeLang === 'fr' ? activeDraft.html_fr : activeDraft.html_en, activeVars),
    [activeDraft, activeLang, activeVars],
  );
  const previewBody = useMemo(
    () => renderMsg(activeLang === 'fr' ? activeDraft.body_fr : activeDraft.body_en, activeVars),
    [activeDraft, activeLang, activeVars],
  );

  const isDirty = useMemo(() => {
    const def = buildDefaultDraft(activeChannel, activeId);
    const ov = overrides[activeKey];
    const base: Draft = {
      body_fr: ov?.body_fr ?? def.body_fr,
      body_en: ov?.body_en ?? def.body_en,
      subject_fr: ov?.subject_fr ?? def.subject_fr,
      subject_en: ov?.subject_en ?? def.subject_en,
      html_fr: ov?.html_fr ?? def.html_fr,
      html_en: ov?.html_en ?? def.html_en,
    };
    return JSON.stringify(base) !== JSON.stringify(activeDraft);
  }, [activeDraft, overrides, activeKey, activeChannel, activeId]);

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

  const updateDraft = (patch: Partial<Draft>) => {
    setDrafts(prev => ({ ...prev, [activeKey]: { ...activeDraft, ...patch } }));
  };

  const handleVarChange = (key: string, value: string) => {
    setVars(prev => ({ ...prev, [activeId]: { ...prev[activeId], [key]: value } }));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const payload: any = {
      channel: activeChannel,
      template_id: activeId,
      body_fr: activeChannel === 'email' ? null : activeDraft.body_fr,
      body_en: activeChannel === 'email' ? null : activeDraft.body_en,
      subject_fr: activeChannel === 'email' ? activeDraft.subject_fr : null,
      subject_en: activeChannel === 'email' ? activeDraft.subject_en : null,
      html_fr: activeChannel === 'email' ? activeDraft.html_fr : null,
      html_en: activeChannel === 'email' ? activeDraft.html_en : null,
      updated_by: user.id,
    };
    const { error } = await sb
      .from('message_template_overrides')
      .upsert(payload, { onConflict: 'channel,template_id' });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setOverrides(prev => ({ ...prev, [activeKey]: payload as OverrideRow }));
    toast.success(isFr ? 'Modèle enregistré' : 'Template saved');
  };

  const handleResetToDefault = () => {
    updateDraft(buildDefaultDraft(activeChannel, activeId));
    toast.info(isFr ? 'Modèle restauré (non enregistré)' : 'Template reset (not yet saved)');
  };

  const handleDeleteOverride = async () => {
    if (!overrides[activeKey]) {
      handleResetToDefault();
      return;
    }
    setSaving(true);
    const { error } = await sb
      .from('message_template_overrides')
      .delete()
      .eq('channel', activeChannel)
      .eq('template_id', activeId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    const def = buildDefaultDraft(activeChannel, activeId);
    setOverrides(prev => {
      const next = { ...prev };
      delete next[activeKey];
      return next;
    });
    updateDraft(def);
    toast.success(isFr ? 'Personnalisation supprimée' : 'Override removed');
  };

  const handleTestSend = async () => {
    setSending(true);
    try {
      if (activeChannel === 'email') {
        if (!email) { toast.error(isFr ? 'Aucun email' : 'No email'); return; }
        const subject = previewSubject || (isFr ? '(test sans sujet)' : '(test no subject)');
        const html = previewHtml;
        const { error } = await sb.functions.invoke('send-email', {
          body: { template: 'generic', to: email, data: { subject, html, displayName: email, body: subject, title: subject } },
        });
        if (error) throw error;
        toast.success(isFr ? `Email envoyé (${activeLang.toUpperCase()})` : `Email sent (${activeLang.toUpperCase()})`);
      } else {
        if (!phone) { toast.error(isFr ? 'Aucun numéro dans votre profil' : 'No phone on your profile'); return; }
        if (!/^\+\d{8,15}$/.test(phone)) { toast.error(isFr ? 'Numéro invalide (E.164 requis)' : 'Invalid phone (E.164 required)'); return; }
        const body = previewBody;
        if (!body.trim()) { toast.error(isFr ? 'Message vide' : 'Empty message'); return; }
        const fn = activeChannel === 'whatsapp' ? 'send-whatsapp' : 'send-sms';
        const { error } = await sb.functions.invoke(fn, { body: { to: phone, body, template_id: activeId } });
        if (error) throw error;
        toast.success(isFr ? `${activeChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'} envoyé (${activeLang.toUpperCase()})` : `${activeChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'} sent (${activeLang.toUpperCase()})`);
      }
    } catch (e: any) {
      toast.error(e?.message || String(e));
    } finally {
      setSending(false);
    }
  };

  const ChannelIcon = CHANNELS.find(c => c.id === activeChannel)!.icon;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <HeroHeaderShell topBlobClassName="bg-primary/25" bottomBlobClassName="bg-accent/15">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'var(--gradient-primary)' }}>
            <MessageSquareText className="w-7 h-7 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{isFr ? 'Admin' : 'Admin'}</span>
            <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight">{isFr ? 'Modèles de messages' : 'Message templates'}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{isFr ? 'Email · SMS · WhatsApp — édition live + envoi de test' : 'Email · SMS · WhatsApp — live edit + test send'}</p>
          </div>
        </div>
      </HeroHeaderShell>

      {/* Channel switcher */}
      <Tabs value={activeChannel} onValueChange={(v) => setActiveChannel(v as MessageChannel)}>
        <TabsList className="rounded-xl">
          {CHANNELS.map(c => {
            const Icon = c.icon;
            return (
              <TabsTrigger key={c.id} value={c.id} className="rounded-lg text-xs gap-1.5">
                <Icon className="w-3.5 h-3.5" />
                {isFr ? c.label_fr : c.label_en}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      <div className="grid lg:grid-cols-[260px_1fr] gap-6">
        {/* Template list */}
        <Card className="rounded-2xl glass border-border/50 self-start lg:sticky lg:top-4">
          <CardContent className="p-2 flex flex-col gap-1">
            {MESSAGE_TEMPLATES.map(t => {
              const active = t.id === activeId;
              const customized = !!overrides[k(activeChannel, t.id)];
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveId(t.id)}
                  className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-left transition-all ${active ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted/40'}`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{isFr ? t.label_fr : t.label_en}</p>
                    <p className={`text-[10px] truncate ${active ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{isFr ? t.description_fr : t.description_en}</p>
                  </div>
                  {customized && (
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full shrink-0 ${active ? 'bg-primary-foreground/20' : 'bg-accent/20 text-accent'}`}>
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
                <div className="flex items-center gap-2">
                  <ChannelIcon className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <h2 className="text-lg font-bold font-display leading-tight">{isFr ? activeTpl.label_fr : activeTpl.label_en}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">{activeChannel}:{activeId}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {overrides[activeKey] && (
                    <Badge variant="outline" className="rounded-full text-[10px]">{isFr ? 'Personnalisé' : 'Customized'}</Badge>
                  )}
                  {isDirty && (
                    <Badge className="rounded-full text-[10px] bg-warning/15 text-warning border-warning/20">{isFr ? 'Non enregistré' : 'Unsaved'}</Badge>
                  )}
                </div>
              </div>

              <Tabs value={activeLang} onValueChange={(v) => setActiveLang(v as 'fr' | 'en')}>
                <TabsList className="rounded-xl">
                  <TabsTrigger value="fr" className="rounded-lg text-xs">🇫🇷 Français</TabsTrigger>
                  <TabsTrigger value="en" className="rounded-lg text-xs">🇬🇧 English</TabsTrigger>
                </TabsList>

                {(['fr', 'en'] as const).map(lang => (
                  <TabsContent key={lang} value={lang} className="space-y-3 mt-3">
                    {activeChannel === 'email' ? (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{isFr ? 'Sujet' : 'Subject'}</Label>
                          <Input
                            value={lang === 'fr' ? activeDraft.subject_fr : activeDraft.subject_en}
                            onChange={e => updateDraft(lang === 'fr' ? { subject_fr: e.target.value } : { subject_en: e.target.value })}
                            className="rounded-xl text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{isFr ? 'Contenu HTML' : 'HTML body'}</Label>
                          <Textarea
                            value={lang === 'fr' ? activeDraft.html_fr : activeDraft.html_en}
                            onChange={e => updateDraft(lang === 'fr' ? { html_fr: e.target.value } : { html_en: e.target.value })}
                            rows={10}
                            className="rounded-xl font-mono text-xs"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{isFr ? 'Corps du message' : 'Message body'}</Label>
                        <Textarea
                          value={lang === 'fr' ? activeDraft.body_fr : activeDraft.body_en}
                          onChange={e => updateDraft(lang === 'fr' ? { body_fr: e.target.value } : { body_en: e.target.value })}
                          rows={4}
                          className="rounded-xl font-mono text-xs"
                        />
                        <p className="text-[10px] text-muted-foreground">{(lang === 'fr' ? activeDraft.body_fr : activeDraft.body_en).length} {isFr ? 'caractères' : 'characters'}</p>
                      </div>
                    )}
                  </TabsContent>
                ))}
              </Tabs>

              <div className="flex items-center gap-2 flex-wrap">
                <Button onClick={handleSave} disabled={saving || !isDirty} className="rounded-xl text-primary-foreground" style={{ background: 'var(--gradient-primary)' }}>
                  <Save className="w-3.5 h-3.5 mr-1.5" />{saving ? '...' : (isFr ? 'Enregistrer' : 'Save')}
                </Button>
                <Button variant="outline" onClick={handleResetToDefault} className="rounded-xl">
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />{isFr ? 'Restaurer défaut' : 'Reset to default'}
                </Button>
                {overrides[activeKey] && (
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
                <h3 className="text-sm font-bold">{isFr ? 'Variables d\'exemple' : 'Sample variables'}</h3>
                <Badge variant="outline" className="rounded-full text-[10px]">{placeholders.length}</Badge>
              </div>
              {placeholders.length === 0 ? (
                <p className="text-xs text-muted-foreground">{isFr ? 'Aucune variable. Utilisez {nom_variable} dans le contenu.' : 'No variables. Use {var_name} in the body.'}</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {placeholders.map(kk => (
                    <div key={kk} className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">{`{${kk}}`}</Label>
                      <Input
                        value={activeVars[kk] ?? ''}
                        onChange={e => handleVarChange(kk, e.target.value)}
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
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="text-sm font-bold">{isFr ? 'Aperçu rendu' : 'Rendered preview'} <span className="text-[10px] font-normal text-muted-foreground ml-1">({activeLang.toUpperCase()})</span></h3>
                <Button size="sm" onClick={handleTestSend} disabled={sending || (activeChannel === 'email' ? !email : !phone)} className="rounded-lg h-8 text-xs text-primary-foreground" style={{ background: 'var(--gradient-primary)' }}>
                  <Send className="w-3 h-3 mr-1.5" />{sending ? '...' : (isFr ? 'Envoyer un test' : 'Send a test')}
                </Button>
              </div>

              {activeChannel === 'email' ? (
                <div className="space-y-2">
                  <div className="rounded-xl border border-border/40 bg-muted/30 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{isFr ? 'Sujet' : 'Subject'}</p>
                    <p className="text-sm font-semibold">{previewSubject || <span className="text-muted-foreground italic">{isFr ? '(vide)' : '(empty)'}</span>}</p>
                  </div>
                  <div className="rounded-xl border border-border/40 bg-background overflow-hidden">
                    <iframe
                      title="email preview"
                      srcDoc={previewHtml || '<p style="font-family:sans-serif;color:#888;padding:1rem;">empty</p>'}
                      className="w-full h-[420px] bg-white"
                      sandbox=""
                    />
                  </div>
                </div>
              ) : (
                <div className={`p-3 rounded-xl border text-xs leading-relaxed whitespace-pre-wrap break-words ${activeChannel === 'whatsapp' ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200/40 dark:border-emerald-900/40' : 'bg-muted/40 border-border/40'}`}>
                  {previewBody || <span className="text-muted-foreground italic">{isFr ? '(vide)' : '(empty)'}</span>}
                </div>
              )}

              <p className="text-[11px] text-muted-foreground">
                {activeChannel === 'email'
                  ? (isFr ? 'Email de test envoyé à : ' : 'Test email sent to: ')
                  : (isFr ? 'Message de test envoyé au numéro : ' : 'Test message sent to: ')}
                <span className="font-mono">{activeChannel === 'email' ? (email || (isFr ? '— inconnu —' : '— unknown —')) : (phone || (isFr ? '— non défini —' : '— not set —'))}</span>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminSmsTemplatesPage;
