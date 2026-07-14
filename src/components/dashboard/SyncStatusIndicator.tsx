import { useEffect, useState } from 'react';
import { Wifi, WifiOff, CircleAlert, Loader2, RefreshCw, FlaskConical } from 'lucide-react';
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
    dot: string;
    icon: JSX.Element;
    pulse?: boolean;
    tone: 'live' | 'warn' | 'off' | 'idle';
  };

  let view: View;
  if (demo) {
    view = {
      label: locale === 'fr' ? 'Mode démo' : 'Demo mode',
      dot: 'bg-sky-500',
      icon: <FlaskConical className="w-3.5 h-3.5" />,
      tone: 'idle',
    };
  } else if (!online) {
    view = {
      label: locale === 'fr' ? 'Hors-ligne' : 'Offline',
      dot: 'bg-destructive',
      icon: <WifiOff className="w-3.5 h-3.5" />,
      tone: 'off',
    };
  } else if (channel === 'live') {
    view = {
      label: locale === 'fr' ? 'Synchro en direct' : 'Live sync',
      dot: 'bg-emerald-500',
      icon: <Wifi className="w-3.5 h-3.5" />,
      pulse: true,
      tone: 'live',
    };
  } else if (channel === 'connecting') {
    view = {
      label: locale === 'fr' ? 'Connexion…' : 'Connecting…',
      dot: 'bg-amber-500',
      icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
      tone: 'warn',
    };
  } else if (channel === 'error') {
    view = {
      label: locale === 'fr' ? 'Erreur de synchro' : 'Sync error',
      dot: 'bg-destructive',
      icon: <CircleAlert className="w-3.5 h-3.5" />,
      tone: 'warn',
    };
  } else {
    view = {
      label: locale === 'fr' ? 'Inactif' : 'Idle',
      dot: 'bg-muted-foreground',
      icon: <Wifi className="w-3.5 h-3.5 opacity-60" />,
      tone: 'idle',
    };
  }

  const refetchTxt = locale === 'fr' ? 'Dernière mise à jour' : 'Last refresh';
  const changeTxt = locale === 'fr' ? 'Dernier changement' : 'Last change';

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={view.label}
            className={cn(
              'inline-flex items-center gap-1.5 h-8 px-2 sm:px-2.5 rounded-xl',
              'border border-border/50 bg-background/50 hover:bg-background transition-colors',
              'text-[11px] font-medium text-muted-foreground',
            )}
          >
            <span className="relative inline-flex w-2 h-2">
              {view.pulse && (
                <span className={cn('absolute inset-0 rounded-full opacity-60 animate-ping', view.dot)} />
              )}
              <span className={cn('relative inline-block w-2 h-2 rounded-full', view.dot)} />
            </span>
            <span className="hidden md:inline">{view.label}</span>
            <span className="md:hidden inline-flex items-center">{view.icon}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <div className="flex flex-col gap-1 min-w-[180px]">
            <div className="flex items-center gap-2 font-semibold">
              {view.icon}
              <span>{view.label}</span>
            </div>
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
            {channel === 'error' && !demo && (
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