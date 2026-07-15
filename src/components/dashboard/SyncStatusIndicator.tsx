import { useEffect, useState } from 'react';
import { Wifi, WifiOff, CircleAlert, Loader2, RefreshCw, FlaskConical, CheckCircle2 } from 'lucide-react';
import { useSyncStatus, retrySync } from '@/hooks/useRealtimeSync';
import { useLanguage } from '@/i18n/LanguageContext';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

function formatRelative(ts: number | null, locale: 'fr' | 'en'): string {
  if (!ts) return locale === 'fr' ? 'jamais' : 'never';
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (sec < 5) return locale === 'fr' ? "à l'instant" : 'just now';
  if (sec < 60) return locale === 'fr' ? `il y a ${sec}s` : `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return locale === 'fr' ? `il y a ${min} min` : `${min} min ago`;
  const h = Math.floor(min / 60);
  return locale === 'fr' ? `il y a ${h} h` : `${h}h ago`;
}

export const SyncStatusIndicator = () => {
  const { online, channel, lastRefetchAt, lastChangeAt, demo } = useSyncStatus();
  const { locale } = useLanguage();
  // Re-render every 15s so the relative timestamp stays fresh
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  type View = {
    label: string;
    short: string;
    hint?: string;
    dot: string;
    icon: JSX.Element;
    pulse?: boolean;
    tone: 'live' | 'warn' | 'off' | 'idle' | 'demo';
    classes: string;
  };

  const toneClasses: Record<View['tone'], string> = {
    live: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15',
    warn: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/15',
    off: 'border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15',
    idle: 'border-border/50 bg-background/60 text-muted-foreground hover:bg-background',
    demo: 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/15',
  };

  let view: View;
  if (demo) {
    view = {
      label: locale === 'fr' ? 'Mode démo' : 'Demo mode',
      short: locale === 'fr' ? 'Démo' : 'Demo',
      dot: 'bg-sky-500',
      icon: <FlaskConical className="w-4 h-4" />,
      tone: 'demo',
      classes: toneClasses.demo,
    };
  } else if (!online) {
    view = {
      label: locale === 'fr' ? 'Hors-ligne' : 'Offline',
      short: locale === 'fr' ? 'Hors-ligne' : 'Offline',
      hint: locale === 'fr' ? 'Aucune connexion internet' : 'No internet connection',
      dot: 'bg-destructive',
      icon: <WifiOff className="w-4 h-4" />,
      tone: 'off',
      classes: toneClasses.off,
    };
  } else if (channel === 'live') {
    view = {
      label: locale === 'fr' ? 'Synchro en direct' : 'Live sync',
      short: locale === 'fr' ? 'En direct' : 'Live',
      dot: 'bg-emerald-500',
      icon: <CheckCircle2 className="w-4 h-4" />,
      pulse: true,
      tone: 'live',
      classes: toneClasses.live,
    };
  } else if (channel === 'connecting') {
    view = {
      label: locale === 'fr' ? 'Connexion…' : 'Connecting…',
      short: locale === 'fr' ? 'Connexion' : 'Connecting',
      dot: 'bg-amber-500',
      icon: <Loader2 className="w-4 h-4 animate-spin" />,
      tone: 'warn',
      classes: toneClasses.warn,
    };
  } else if (channel === 'error') {
    view = {
      label: locale === 'fr' ? 'Synchro interrompue' : 'Sync failed',
      short: locale === 'fr' ? 'Erreur' : 'Error',
      hint: locale === 'fr' ? 'Impossible de joindre le serveur' : 'Cannot reach server',
      dot: 'bg-destructive',
      icon: <CircleAlert className="w-4 h-4" />,
      tone: 'off',
      classes: toneClasses.off,
    };
  } else {
    view = {
      label: locale === 'fr' ? 'Inactif' : 'Idle',
      short: locale === 'fr' ? 'Inactif' : 'Idle',
      dot: 'bg-muted-foreground',
      icon: <Wifi className="w-4 h-4 opacity-70" />,
      tone: 'idle',
      classes: toneClasses.idle,
    };
  }

  const refetchTxt = locale === 'fr' ? 'Dernière mise à jour' : 'Last refresh';
  const changeTxt = locale === 'fr' ? 'Dernier changement' : 'Last change';

  const showRetry = channel === 'error' && !demo;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={view.label}
            onClick={showRetry ? () => retrySync() : undefined}
            className={cn(
              'inline-flex items-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-full shrink-0 whitespace-nowrap',
              'border transition-colors text-xs font-semibold',
              view.classes,
            )}
          >
            <span className="relative inline-flex items-center justify-center">
              {view.pulse && (
                <span className={cn('absolute inset-0 rounded-full opacity-40 animate-ping', view.dot)} />
              )}
              <span className="relative inline-flex">{view.icon}</span>
            </span>
            <span className="hidden sm:inline">{view.short}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <div className="flex flex-col gap-1 min-w-[180px]">
            <div className="flex items-center gap-2 font-semibold">
              {view.icon}
              <span>{view.label}</span>
            </div>
            {view.hint && (
              <div className="text-muted-foreground">{view.hint}</div>
            )}
            {!demo && (
              <>
                <div className="flex justify-between gap-4 text-muted-foreground">
                  <span>{refetchTxt}</span>
                  <span className="text-foreground">{formatRelative(lastRefetchAt, locale)}</span>
                </div>
                <div className="flex justify-between gap-4 text-muted-foreground">
                  <span>{changeTxt}</span>
                  <span className="text-foreground">{formatRelative(lastChangeAt, locale)}</span>
                </div>
              </>
            )}
            {demo && (
              <div className="text-muted-foreground">
                {locale === 'fr'
                  ? 'Aucune synchro serveur en mode démo.'
                  : 'No server sync in demo mode.'}
              </div>
            )}
            {showRetry && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); retrySync(); }}
                className="mt-1 inline-flex items-center gap-1.5 justify-center h-7 px-2 rounded-md border border-border/60 bg-background hover:bg-muted text-foreground"
              >
                <RefreshCw className="w-3 h-3" />
                {locale === 'fr' ? 'Réessayer' : 'Retry'}
              </button>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default SyncStatusIndicator;