import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { BookOpen, HelpCircle, Play, ArrowRight, CreditCard, Tag, ArrowUpDown, PieChart, Target, FileText, BarChart3, Users, Sparkles, RefreshCw, Layers, Gem } from 'lucide-react';

const GuidePage = () => {
  const { locale } = useLanguage();
  const t = dashT[locale];

  const guideItems = [
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

  const faqItems = [
    { q: 'faqChangeCurrency', a: 'faqChangeCurrencyAnswer' },
    { q: 'faqExportData', a: 'faqExportDataAnswer' },
    { q: 'faqBalanceExplain', a: 'faqBalanceExplainAnswer' },
    { q: 'faqCancelSub', a: 'faqCancelSubAnswer' },
    { q: 'faqDataSecurity', a: 'faqDataSecurityAnswer' },
    { q: 'faqAIChat', a: 'faqAIChatAnswer' },
    { q: 'faqInvestments', a: 'faqInvestmentsAnswer' },
    { q: 'faqSubPages', a: 'faqSubPagesAnswer' },
    { q: 'faqRecurring', a: 'faqRecurringAnswer' },
    { q: 'faqFamilySharing', a: 'faqFamilySharingAnswer' },
    { q: 'faqBudgetOverspend', a: 'faqBudgetOverspendAnswer' },
    { q: 'faqOfflineMode', a: 'faqOfflineModeAnswer' },
    { q: 'faqInterestCalc', a: 'faqInterestCalcAnswer' },
    { q: 'faqDeleteAccount', a: 'faqDeleteAccountAnswer' },
  ];

  const tutorialSteps = [
    { key: 'tutorialStep1', desc: 'tutorialStep1Desc', link: '/dashboard/accounts', icon: CreditCard },
    { key: 'tutorialStep2', desc: 'tutorialStep2Desc', link: '/dashboard/categories', icon: Tag },
    { key: 'tutorialStep3', desc: 'tutorialStep3Desc', link: '/dashboard/transactions', icon: ArrowUpDown },
    { key: 'tutorialStep4', desc: 'tutorialStep4Desc', link: '/dashboard/budgets', icon: PieChart },
    { key: 'tutorialStep5', desc: 'tutorialStep5Desc', link: '/dashboard/reports', icon: FileText },
    { key: 'tutorialStep6', desc: 'tutorialStep6Desc', link: '/dashboard', icon: Sparkles },
    { key: 'tutorialStep7', desc: 'tutorialStep7Desc', link: '/dashboard/accounts', icon: Layers },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-display">{t.guideTitle}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t.guideSubtitle}</p>
      </div>

      <Tabs defaultValue="guide">
        <TabsList className="rounded-xl">
          <TabsTrigger value="guide" className="rounded-lg gap-1.5"><BookOpen className="w-4 h-4" />{t.guide}</TabsTrigger>
          <TabsTrigger value="faq" className="rounded-lg gap-1.5"><HelpCircle className="w-4 h-4" />{t.faq}</TabsTrigger>
          <TabsTrigger value="tutorial" className="rounded-lg gap-1.5"><Play className="w-4 h-4" />{t.tutorial}</TabsTrigger>
        </TabsList>

        <TabsContent value="guide" className="mt-6">
          <Card className="border border-border/50 rounded-2xl">
            <CardContent className="p-0">
              <Accordion type="multiple" className="divide-y divide-border/50">
                {guideItems.map((item) => (
                  <AccordionItem key={item.key} value={item.key} className="border-0">
                    <AccordionTrigger className="px-5 py-4 hover:no-underline">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                          <item.icon className="w-4 h-4 text-primary" />
                        </div>
                        <span className="font-semibold">{t[item.key as keyof typeof t] as string}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-5 pb-4">
                      <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                        {t[`${item.key}Desc` as keyof typeof t] as string}
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
        </TabsContent>

        <TabsContent value="faq" className="mt-6">
          <Card className="border border-border/50 rounded-2xl">
            <CardContent className="p-0">
              <Accordion type="multiple" className="divide-y divide-border/50">
                {faqItems.map((item) => (
                  <AccordionItem key={item.q} value={item.q} className="border-0">
                    <AccordionTrigger className="px-5 py-4 hover:no-underline">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
                          <HelpCircle className="w-4 h-4 text-accent" />
                        </div>
                        <span className="font-semibold text-left">{t[item.q as keyof typeof t] as string}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-5 pb-4">
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {t[item.a as keyof typeof t] as string}
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tutorial" className="mt-6">
          <div className="space-y-4">
            {tutorialSteps.map((step, i) => (
              <Card key={step.key} className="border border-border/50 rounded-2xl overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--gradient-primary)' }}>
                      <step.icon className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-base mb-1">{t[step.key as keyof typeof t] as string}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                        {t[step.desc as keyof typeof t] as string}
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
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GuidePage;
