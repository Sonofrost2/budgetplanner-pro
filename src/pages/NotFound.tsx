import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Wallet, ArrowLeft, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";

const copy = {
  fr: {
    code: "404",
    title: "Page introuvable",
    description:
      "La page que vous cherchez n'existe pas, a été déplacée ou vous n'y avez plus accès.",
    path: "Chemin demandé",
    backDashboard: "Retour au tableau de bord",
    backHome: "Retour à l'accueil",
    explore: "Explorer les fonctionnalités",
  },
  en: {
    code: "404",
    title: "Page not found",
    description:
      "The page you're looking for doesn't exist, has moved, or you no longer have access to it.",
    path: "Requested path",
    backDashboard: "Back to dashboard",
    backHome: "Back to home",
    explore: "Explore features",
  },
} as const;

const NotFound = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { locale } = useLanguage();
  const t = copy[locale];

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  const primaryHref = user ? "/dashboard" : "/";
  const primaryLabel = user ? t.backDashboard : t.backHome;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header shell */}
      <header className="w-full border-b border-border/40 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-primary-foreground shadow-[var(--shadow-card)] transition-transform group-hover:scale-105"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Wallet className="w-5 h-5" />
            </div>
            <span className="font-display font-semibold text-base sm:text-lg">
              Budget Planner Pro
            </span>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg text-center space-y-6">
          <div
            className="mx-auto w-20 h-20 rounded-2xl flex items-center justify-center text-primary-foreground shadow-[var(--shadow-card)]"
            style={{ background: "var(--gradient-primary)" }}
          >
            <Compass className="w-10 h-10" />
          </div>

          <div className="space-y-3">
            <p
              className="text-6xl sm:text-7xl font-bold font-display bg-clip-text text-transparent"
              style={{ backgroundImage: "var(--gradient-primary)" }}
            >
              {t.code}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold font-display">{t.title}</h1>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              {t.description}
            </p>
          </div>

          {location.pathname && location.pathname !== "/" && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/60 border border-border/40">
              <span className="text-xs text-muted-foreground">{t.path}:</span>
              <code className="text-xs font-mono text-foreground truncate max-w-[240px]">
                {location.pathname}
              </code>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link to={primaryHref}>
              <Button
                size="lg"
                className="text-primary-foreground gap-2"
                style={{ background: "var(--gradient-primary)" }}
              >
                <ArrowLeft className="w-4 h-4" />
                {primaryLabel}
              </Button>
            </Link>
            {!user && (
              <Link to="/#features">
                <Button size="lg" variant="outline" className="gap-2">
                  <Compass className="w-4 h-4" />
                  {t.explore}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default NotFound;
