import { useState, useMemo } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HeroHeaderShell } from '@/components/dashboard/HeroHeaderShell';
import {
  BookOpen, HelpCircle, Play, ArrowRight, CreditCard, Tag, ArrowUpDown,
  PieChart, Target, FileText, BarChart3, Users, Sparkles, RefreshCw, Layers, Gem,
  Search, X, Compass,
} from 'lucide-react';

type GuideItem = { key: string; icon: any; link: string };
type FaqItem = { q: string; a: string };
type TutorialStep = { key: string; desc: string; link: string; icon: any };

const guideItems: GuideItem[] = [
  { key: 'gettingStarted', icon: CreditCard, link: '/dashboard/accounts' },
  { key: 'managingTransactions', icon: ArrowUpDown, link: '/dashboard/transactions' },
  { key: 'budgetsGuide', icon: PieChart, link: '/dashboard/budgets' },
  { key: 'savingsGuide', icon: Target, link: '/dashboard/savings' },
  { key: 'reportsGuide', icon: FileText, link: '/dashboard/reports' },
  { key: 'forecastsGuide', icon: BarChart3, link: '/dashboard/forecasts' },
  { key: 'familyGuide', icon: Users, link: '/dashboard/family' },
  { key: 'aiChatGuide', icon: Sparkles, link: '/dashboard' },
  { key: 'recurringGuide', icon: RefreshCw, link: '/dashboard/recurring' },
  { key: 'wealthGuide', icon: Gem, link: '/dashboard/wealth' },
  { key: 'subPagesGuide', icon: Layers, link: '/dashboard/accounts' },
];

const faqItems: FaqItem[] = [
  { q: 'faqChangeCurrency', a: 'faqChangeCurrencyAnswer' },
  { q: 'faqExportData', a: 'faqExportDataAnswer' },
  { q: 'faqBalanceExplain', a: 'faqBalanceExplainAnswer' },
  { q: 'faqCancelSub', a: 'faqCancelSubAnswer' },
  { q: 'faqDataSecurity', a: 'faqDataSecurityAnswer' },
  { q: 'faqAIChat', a: 'faqAIChatAnswer' },
  { q: 'faqInvestments', a: 'faqInvestmentsAnswer' },
  { q: 'faqSubPages', a: 'faqSubPagesAnswer' },
  { q: 'faqRecurring', a: 'faqRecurringAnswer' },
  { q: 'faqWealth', a: 'faqWealthAnswer' },
  { q: 'faqFamilySharing', a: 'faqFamilySharingAnswer' },
  { q: 'faqBudgetOverspend', a: 'faqBudgetOverspendAnswer' },
  { q: 'faqOfflineMode', a: 'faqOfflineModeAnswer' },
  { q: 'faqInterestCalc', a: 'faqInterestCalcAnswer' },
  { q: 'faqDeleteAccount', a: 'faqDeleteAccountAnswer' },
];

const tutorialSteps: TutorialStep[] = [
  { key: 'tutorialStep1', desc: 'tutorialStep1Desc', link: '/dashboard/accounts', icon: CreditCard },
  { key: 'tutorialStep2', desc: 'tutorialStep2Desc', link: '/dashboard/categories', icon: Tag },
  { key: 'tutorialStep3', desc: 'tutorialStep3Desc', link: '/dashboard/transactions', icon: ArrowUpDown },
  { key: 'tutorialStep4', desc: 'tutorialStep4Desc', link: '/dashboard/budgets', icon: PieChart },
  { key: 'tutorialStep5', desc: 'tutorialStep5Desc', link: '/dashboard/reports', icon: FileText },
  { key: 'tutorialStep6', desc: 'tutorialStep6Desc', link: '/dashboard', icon: Sparkles },
  { key: 'tutorialStep7', desc: 'tutorialStep7Desc', link: '/dashboard/accounts', icon: Layers },
];

const Highlight = ({ text, query }: { text: string; query: string }) => {
  if (!query) return <>{text}</>;
  const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${safeQuery})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-primary/20 text-foreground px-0.5 rounded-sm">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
};

const GuidePage = () => {
  const { locale } = useLanguage();
  const t = dashT[locale];
  const isFr = locale === 'fr';
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const matches = (...texts: string[]) => !q || texts.some(s => (s ?? '').toLowerCase().includes(q));

  const filteredGuide = useMemo(
    () => guideItems.filter(it =>
      matches(t[it.key as keyof typeof t] as string, t[`${it.key}Desc` as keyof typeof t] as string)
    ),
    [q, t]
  );
  const filteredFaq = useMemo(
    () => faqItems.filter(it => matches(t[it.q as keyof typeof t] as string, t[it.a as keyof typeof t] as string)),
    [q, t]
  );
  const filteredTutorial = useMemo(
    () => tutorialSteps.filter(it => matches(t[it.key as keyof typeof t] as string, t[it.desc as keyof typeof t] as string)),
    [q, t]
  );

  const totalResults = q ? filteredGuide.length + filteredFaq.length + filteredTutorial.length : 0;

  return (
    <div className="space-y-6">
      <HeroHeaderShell topBlobClassName="bg-primary/25" bottomBlobClassName="bg-accent/20">
        <div className="space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'var(--gradient-primary)' }}>
              <Compass className="w-6 h-6 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight">
                {t.guideTitle}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">{t.guideSubtitle}</p>
            </div>
          </div>

          {/* Global search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isFr ? 'Rechercher dans le guide, FAQ, tutoriel…' : 'Search the guide, FAQ, tutorial…'}
              className="h-12 pl-10 pr-10 rounded-2xl bg-background/60 border-border/50 backdrop-blur-md text-sm"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full hover:bg-muted/50 flex items-center justify-center transition-colors"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
          </div>

          {q && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap items-center gap-2 text-xs"
            >
              <span className="text-muted-foreground">
                {totalResults} {isFr ? 'résultat' : 'result'}{totalResults !== 1 ? 's' : ''}
              </span>
              {filteredGuide.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                  {filteredGuide.length} {t.guide}
                </span>
              )}
              {filteredFaq.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent font-semibold">
                  {filteredFaq.length} FAQ
                </span>
              )}
              {filteredTutorial.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-secondary/10 text-secondary font-semibold">
                  {filteredTutorial.length} {t.tutorial}
                </span>
              )}
            </motion.div>
          )}
        </div>
      </HeroHeaderShell>

      <Tabs defaultValue="guide">
        <TabsList className="rounded-xl glass">
          <TabsTrigger value="guide" className="rounded-lg gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <BookOpen className="w-4 h-4" />{t.guide}
            {q && filteredGuide.length > 0 && (
              <span className="ml-1 text-[10px] rounded-full bg-background/30 px-1.5">{filteredGuide.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="faq" className="rounded-lg gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <HelpCircle className="w-4 h-4" />{t.faq}
            {q && filteredFaq.length > 0 && (
              <span className="ml-1 text-[10px] rounded-full bg-background/30 px-1.5">{filteredFaq.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="tutorial" className="rounded-lg gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Play className="w-4 h-4" />{t.tutorial}
            {q && filteredTutorial.length > 0 && (
              <span className="ml-1 text-[10px] rounded-full bg-background/30 px-1.5">{filteredTutorial.length}</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="guide" className="mt-6 animate-fade-in">
          {filteredGuide.length === 0 ? (
            <EmptyState isFr={isFr} />
          ) : (
            <Card className="border border-border/50 rounded-2xl glass">
              <CardContent className="p-0">
                <Accordion type="multiple" className="divide-y divide-border/50">
                  {filteredGuide.map((item) => (
                    <AccordionItem key={item.key} value={item.key} className="border-0">
                      <AccordionTrigger className="px-5 py-4 hover:no-underline">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                            <item.icon className="w-4 h-4 text-primary" />
                          </div>
                          <span className="font-semibold text-left">
                            <Highlight text={t[item.key as keyof typeof t] as string} query={q} />
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-5 pb-4">
                        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                          <Highlight text={t[`${item.key}Desc` as keyof typeof t] as string} query={q} />
                        </p>
                        <Link to={item.link}>
                          <Button variant="outline" size="sm" className="rounded-xl">
                            {t.goToPage} <ArrowRight className="w-3.5 h-3.5 ml-1" />
                          </Button>
                        </Link>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="faq" className="mt-6 animate-fade-in">
          {filteredFaq.length === 0 ? (
            <EmptyState isFr={isFr} />
          ) : (
            <Card className="border border-border/50 rounded-2xl glass">
              <CardContent className="p-0">
                <Accordion type="multiple" className="divide-y divide-border/50">
                  {filteredFaq.map((item) => (
                    <AccordionItem key={item.q} value={item.q} className="border-0">
                      <AccordionTrigger className="px-5 py-4 hover:no-underline">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                            <HelpCircle className="w-4 h-4 text-accent" />
                          </div>
                          <span className="font-semibold text-left">
                            <Highlight text={t[item.q as keyof typeof t] as string} query={q} />
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-5 pb-4">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          <Highlight text={t[item.a as keyof typeof t] as string} query={q} />
                        </p>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="tutorial" className="mt-6 animate-fade-in">
          {filteredTutorial.length === 0 ? (
            <EmptyState isFr={isFr} />
          ) : (
            <div className="space-y-4">
              {filteredTutorial.map((step, i) => (
                <motion.div
                  key={step.key}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="border border-border/50 rounded-2xl overflow-hidden glass">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--gradient-primary)' }}>
                          <step.icon className="w-5 h-5 text-primary-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-base mb-1">
                            <Highlight text={t[step.key as keyof typeof t] as string} query={q} />
                          </h3>
                          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                            <Highlight text={t[step.desc as keyof typeof t] as string} query={q} />
                          </p>
                          <Link to={step.link}>
                            <Button variant="outline" size="sm" className="rounded-xl">
                              {t.goToPage} <ArrowRight className="w-3.5 h-3.5 ml-1" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

const EmptyState = ({ isFr }: { isFr: boolean }) => (
  <Card className="border border-dashed border-border/50 rounded-2xl">
    <CardContent className="p-10 text-center">
      <div className="w-12 h-12 rounded-2xl bg-muted/40 flex items-center justify-center mx-auto mb-3">
        <Search className="w-5 h-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">{isFr ? 'Aucun résultat' : 'No results'}</p>
      <p className="text-xs text-muted-foreground mt-1">
        {isFr ? 'Essayez avec d\'autres mots-clés' : 'Try other keywords'}
      </p>
    </CardContent>
  </Card>
);

export default GuidePage;
