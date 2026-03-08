import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useLanguage } from '@/i18n/LanguageContext';

const content = {
  fr: {
    title: 'À propos de Budget Planner',
    mission: 'Notre mission',
    missionText: "Budget Planner est né d'une conviction simple : chacun mérite des outils financiers accessibles, intelligents et adaptés à son quotidien. Nous aidons les familles et les individus à reprendre le contrôle de leurs finances.",
    team: 'Notre équipe',
    teamText: "Nous sommes une équipe passionnée de développeurs, designers et experts financiers basés en Afrique de l'Ouest, déterminés à rendre la gestion financière simple et accessible à tous.",
    values: 'Nos valeurs',
    valuesList: ['Transparence totale', 'Simplicité avant tout', 'Sécurité des données', 'Accessibilité pour tous'],
  },
  en: {
    title: 'About Budget Planner',
    mission: 'Our Mission',
    missionText: 'Budget Planner was born from a simple belief: everyone deserves accessible, smart financial tools adapted to their daily life. We help families and individuals take control of their finances.',
    team: 'Our Team',
    teamText: 'We are a passionate team of developers, designers, and financial experts based in West Africa, determined to make financial management simple and accessible to all.',
    values: 'Our Values',
    valuesList: ['Total transparency', 'Simplicity first', 'Data security', 'Accessibility for all'],
  },
};

const AboutPage = () => {
  const { locale } = useLanguage();
  const t = content[locale];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold mb-8">{t.title}</h1>
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-3">{t.mission}</h2>
          <p className="text-muted-foreground leading-relaxed">{t.missionText}</p>
        </section>
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-3">{t.team}</h2>
          <p className="text-muted-foreground leading-relaxed">{t.teamText}</p>
        </section>
        <section>
          <h2 className="text-2xl font-semibold mb-3">{t.values}</h2>
          <ul className="space-y-2">
            {t.valuesList.map((v, i) => (
              <li key={i} className="flex items-center gap-2 text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-primary" />
                {v}
              </li>
            ))}
          </ul>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default AboutPage;
