export type BlogPost = {
  slug: string;
  tag: string;
  date: string;       // ISO YYYY-MM-DD
  readingMinutes: number;
  fr: { title: string; summary: string; body: string[] };
  en: { title: string; summary: string; body: string[] };
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'astuces-budget-mensuel',
    tag: 'Budget',
    date: '2026-03-01',
    readingMinutes: 6,
    fr: {
      title: '5 astuces concrètes pour mieux gérer son budget mensuel',
      summary: "Cinq stratégies simples — testées par notre communauté ouest-africaine — pour reprendre le contrôle de vos dépenses dès ce mois-ci.",
      body: [
        "Gérer un budget en Afrique de l'Ouest, c'est composer avec des revenus parfois irréguliers, une multitude de comptes (banque, Wave, Orange Money, MTN MoMo, espèces) et des sollicitations familiales fréquentes. Voici cinq habitudes qui changent vraiment la donne.",
        "1. La règle 50/30/20 adaptée au contexte local. Allouez 50 % de vos revenus aux besoins (loyer, transport, alimentation, écolage), 30 % aux envies (sorties, abonnements, voyages) et 20 % à l'épargne et aux dettes. Dans Budget Planner Pro, créez trois budgets nommés Besoins, Envies, Épargne et liez-leur les catégories correspondantes.",
        "2. Centralisez tous vos comptes. Ajoutez SGCI, Ecobank, Wave, Orange Money, MTN MoMo et espèces dans la même vue. Vous verrez en un coup d'œil votre patrimoine total — souvent une révélation pour celles et ceux qui répartissent leur argent entre 4 ou 5 wallets.",
        "3. Notez chaque dépense le jour même. Les transactions oubliées sont la première cause de découvert. Activez les notifications quotidiennes à 20 h pour ne plus rien laisser passer.",
        "4. Anticipez les charges trimestrielles et annuelles. Assurance, écolage, pèlerinage : annualisez-les dans l'app pour qu'elles apparaissent dans vos budgets mensuels au prorata. Plus de mauvaises surprises en septembre.",
        "5. Faites un point hebdomadaire de 10 minutes. Le dimanche soir, ouvrez le tableau de bord, regardez votre solde net, les budgets en dépassement et ajustez la semaine suivante. C'est cette discipline — pas la rigueur extrême — qui crée la liberté financière.",
      ],
    },
    en: {
      title: '5 Practical Tips to Master Your Monthly Budget',
      summary: 'Five simple strategies, tested by our West African community, to take back control of your spending starting this month.',
      body: [
        "Managing a budget in West Africa means dealing with irregular income, many accounts (bank, Wave, Orange Money, MTN MoMo, cash) and frequent family obligations. Here are five habits that genuinely move the needle.",
        "1. The 50/30/20 rule, localized. Allocate 50% of income to needs (rent, transport, food, school fees), 30% to wants, and 20% to savings and debt. In Budget Planner Pro, create three budgets named Needs, Wants and Savings and link the matching categories.",
        "2. Centralize all your accounts. Add SGCI, Ecobank, Wave, Orange Money, MTN MoMo and cash to one view. You'll see your total net worth at a glance — often a revelation when money is split across 4–5 wallets.",
        "3. Log every expense the same day. Forgotten transactions are the #1 cause of overdrafts. Enable the daily 8 PM reminder so nothing slips through.",
        "4. Anticipate quarterly and yearly bills. Insurance, school fees, pilgrimage — annualize them in the app so they appear pro-rated in your monthly budgets. No more September shocks.",
        "5. Do a 10-minute weekly review. On Sunday evening, open the dashboard, check your net flow, over-budget categories and adjust next week. That discipline — not extreme rigor — is what builds financial freedom.",
      ],
    },
  },
  {
    slug: 'epargne-objectifs',
    tag: 'Épargne',
    date: '2026-02-15',
    readingMinutes: 5,
    fr: {
      title: 'Épargne : comment atteindre ses objectifs deux fois plus vite',
      summary: "La méthode SMART appliquée à l'épargne, plus 3 leviers concrets pour accélérer vos projets sans réduire votre qualité de vie.",
      body: [
        "Beaucoup d'épargnants disent « je n'arrive pas à mettre de côté ». En réalité, l'épargne ne dépend pas du revenu mais de la méthode. Voici comment doubler votre vitesse d'épargne.",
        "Définissez des objectifs SMART. Plutôt que « épargner pour un voyage », visez « 600 000 FCFA pour un voyage à Dakar avant décembre 2026 ». Dans l'app, créez l'objectif avec montant cible et date — vous verrez immédiatement combien mettre de côté chaque mois.",
        "Automatisez le virement le jour de paie. L'argent qui reste sur le compte courant disparaît. Programmez un transfert vers votre compte épargne dès réception du salaire (Wave et MTN MoMo permettent les virements programmés).",
        "Utilisez la règle des 24 heures pour les achats > 50 000 FCFA. Avant tout achat impulsif, ajoutez-le à la wishlist de l'app et attendez 24 h. 7 fois sur 10, vous n'en aurez plus envie le lendemain.",
        "Boostez avec un revenu complémentaire. Side-hustle, location courte durée, formation rémunérée : 50 000 FCFA supplémentaires par mois entièrement versés à l'épargne, c'est 600 000 FCFA par an.",
        "Suivez votre courbe d'épargne dans le module Patrimoine. Voir la courbe monter chaque semaine est ce qui fait tenir sur la durée.",
      ],
    },
    en: {
      title: 'Savings: How to Reach Your Goals Twice as Fast',
      summary: 'The SMART method applied to savings, plus 3 concrete levers to accelerate your projects without lowering your quality of life.',
      body: [
        "Many savers say \"I can't put money aside.\" In reality, saving doesn't depend on income — it depends on method. Here's how to double your savings speed.",
        "Set SMART goals. Instead of \"save for a trip,\" aim for \"600,000 XOF for a Dakar trip by December 2026.\" In the app, create the goal with target amount and date — you'll instantly see how much to save monthly.",
        "Automate the transfer on payday. Money left in checking disappears. Schedule a transfer to your savings account the moment your salary lands (Wave and MTN MoMo support scheduled transfers).",
        "Use the 24-hour rule for purchases > 50,000 XOF. Before any impulse buy, add it to the app's wishlist and wait 24 hours. 7 times out of 10, you won't want it the next day.",
        "Boost with a side income. Freelancing, short-term rental, paid training: an extra 50,000 XOF/month fully transferred to savings = 600,000 XOF per year.",
        "Track your savings curve in the Wealth module. Watching the curve rise each week is what sustains motivation over time.",
      ],
    },
  },
  {
    slug: 'budget-familial-erreurs',
    tag: 'Famille',
    date: '2026-02-01',
    readingMinutes: 5,
    fr: {
      title: 'Budget familial : les 4 erreurs qui ruinent les couples',
      summary: "Gérer un budget à deux n'est jamais neutre. Les 4 pièges à éviter pour transformer l'argent en sujet d'alliance plutôt que de conflit.",
      body: [
        "L'argent est la deuxième cause de séparation au monde. Pourtant, avec une méthode claire, le budget familial peut devenir un terrain d'union. Voici les 4 erreurs les plus fréquentes.",
        "Erreur 1 : tout fusionner ou tout séparer. Aucun extrême ne fonctionne durablement. La meilleure approche est le modèle 3 comptes : un compte commun pour les charges fixes (loyer, écolage, courses), deux comptes individuels pour l'argent libre. Budget Planner Pro vous permet de partager un groupe familial avec rôles distincts.",
        "Erreur 2 : l'opacité. Cacher un découvert ou une dette amplifie toujours le problème. Faites un point mensuel en couple, dashboard partagé ouvert. La transparence évite 90 % des conflits.",
        "Erreur 3 : ne pas planifier les charges non-mensuelles. Écolage trimestriel, fêtes de fin d'année, anniversaires : ces dépenses cycliques doivent être lissées dans le budget mensuel via l'annualisation.",
        "Erreur 4 : ne jamais célébrer. Atteindre un objectif d'épargne familial mérite une petite récompense (sortie, restaurant). Le cerveau a besoin de renforcement positif pour maintenir la discipline.",
      ],
    },
    en: {
      title: 'Family Budget: 4 Mistakes That Ruin Couples',
      summary: "Managing a budget as a couple is never neutral. Four pitfalls to avoid so money becomes a source of unity, not conflict.",
      body: [
        "Money is the world's second-leading cause of separation. Yet with a clear method, the family budget can become common ground. Here are the four most common mistakes.",
        "Mistake 1: fully merging or fully separating accounts. Neither extreme works long-term. The best approach is the 3-account model: one joint account for fixed expenses (rent, school, groceries), two personal accounts for free spending. Budget Planner Pro lets you share a family group with distinct roles.",
        "Mistake 2: opacity. Hiding an overdraft or debt always makes it worse. Hold a monthly couple review with the shared dashboard open. Transparency prevents 90% of conflicts.",
        "Mistake 3: ignoring non-monthly expenses. Quarterly school fees, year-end holidays, birthdays: these cyclical expenses must be smoothed into the monthly budget via annualization.",
        "Mistake 4: never celebrating. Hitting a family savings goal deserves a small reward (a night out, a restaurant). The brain needs positive reinforcement to sustain discipline.",
      ],
    },
  },
  {
    slug: 'fonds-urgence',
    tag: 'Sécurité',
    date: '2026-01-15',
    readingMinutes: 6,
    fr: {
      title: "Fonds d'urgence : combien et où le placer en 2026",
      summary: "Le matelas de sécurité qui change tout. Comment le calibrer (3, 6 ou 12 mois ?) et où le placer pour qu'il garde sa valeur.",
      body: [
        "Un fonds d'urgence est la première brique d'une santé financière solide. Sans lui, une panne moteur, une hospitalisation ou une perte d'emploi peut faire basculer toute une famille dans la dette.",
        "Combien ? La règle classique est 3 à 6 mois de charges fixes. En Afrique de l'Ouest, où les filets sociaux sont plus minces et les revenus parfois irréguliers, visez plutôt 6 à 12 mois. Calculez vos charges fixes mensuelles dans Budget Planner Pro, multipliez par 6, c'est votre cible minimale.",
        "Où le placer ? Surtout pas sur un compte courant — vous le dépenserez. Trois options recommandées : un compte épargne séparé en banque (rémunéré 3 % à 4 %), un compte épargne mobile (Orange Money Tontine, Wave Savings), ou un DAT à 3 mois renouvelable.",
        "À éviter absolument : crypto, actions, immobilier. Le fonds d'urgence doit être disponible en 48 h maximum sans perte de capital.",
        "Reconstituez-le après chaque utilisation. Si vous y avez puisé pour réparer la voiture, votre prochain objectif d'épargne devient le réapprovisionnement, pas un nouveau projet.",
      ],
    },
    en: {
      title: 'Emergency Fund: How Much and Where to Park It in 2026',
      summary: 'The safety cushion that changes everything. How to size it (3, 6 or 12 months?) and where to place it so it keeps its value.',
      body: [
        "An emergency fund is the first brick of solid financial health. Without one, a car breakdown, a hospitalization or a job loss can push a whole family into debt.",
        "How much? The classic rule is 3 to 6 months of fixed expenses. In West Africa, where social safety nets are thinner and incomes more irregular, aim for 6 to 12 months. Calculate your monthly fixed expenses in Budget Planner Pro, multiply by 6 — that's your minimum target.",
        "Where to keep it? Definitely not in checking — you'll spend it. Three recommended options: a separate bank savings account (3–4% yield), a mobile savings account (Orange Money Tontine, Wave Savings), or a renewable 3-month term deposit.",
        "Absolutely avoid: crypto, stocks, real estate. An emergency fund must be available within 48 hours without capital loss.",
        "Rebuild it after every use. If you tapped it to fix the car, your next savings goal becomes refilling — not a new project.",
      ],
    },
  },
  {
    slug: 'mobile-money-finances',
    tag: 'Mobile Money',
    date: '2026-01-01',
    readingMinutes: 5,
    fr: {
      title: 'Mobile Money : 7 règles pour ne plus perdre le contrôle',
      summary: "Wave, Orange Money, MTN MoMo : ces portefeuilles révolutionnent les paiements mais peuvent aussi rendre votre budget opaque. Reprenez la main.",
      body: [
        "Le Mobile Money a transformé l'Afrique : 200 millions de comptes actifs, des milliards de FCFA en circulation chaque jour. Mais cette fluidité a un coût psychologique — l'argent devient invisible, les micro-dépenses s'accumulent.",
        "1. Réconciliez vos wallets chaque dimanche. Notez le solde réel de Wave, Orange et MoMo dans l'app. Si l'écart avec le théorique dépasse 5 %, vous avez oublié une transaction.",
        "2. Évitez d'avoir plus de 100 000 FCFA en permanence sur Mobile Money. Au-delà, virez le surplus vers un compte épargne.",
        "3. Catégorisez systématiquement. « Wave – Achat marché 5 000 » ne dit rien. Utilisez les catégories Alimentation, Transport, Famille pour visualiser où va l'argent.",
        "4. Méfiez-vous des frais. Chaque retrait Wave/Orange/MoMo coûte entre 1 % et 2 %. Sur 6 retraits de 50 000 FCFA, ce sont 3 000 à 6 000 FCFA partis en frais — l'équivalent d'un repas.",
        "5. Activez les notifications SMS. Toute opération doit déclencher une alerte. Sans cela, vous ne détectez pas les fraudes.",
        "6. Ne stockez jamais votre code PIN sur le téléphone. Ni dans les notes, ni en photo, ni dans un email.",
        "7. Centralisez dans Budget Planner Pro. Voir Wave + Orange + MoMo + banque dans une vue unique révèle votre vrai patrimoine — souvent surprenant.",
      ],
    },
    en: {
      title: 'Mobile Money: 7 Rules to Stay in Control',
      summary: "Wave, Orange Money, MTN MoMo: these wallets revolutionized payments but can also make your budget opaque. Take back control.",
      body: [
        "Mobile Money transformed Africa: 200M active accounts, billions of XOF flowing daily. But that fluidity has a psychological cost — money becomes invisible and micro-spend piles up.",
        "1. Reconcile your wallets every Sunday. Log the real balance of Wave, Orange and MoMo in the app. If the gap with the theoretical balance exceeds 5%, you've missed a transaction.",
        "2. Avoid keeping more than 100,000 XOF permanently in Mobile Money. Above that, move the surplus to a savings account.",
        "3. Always categorize. \"Wave – Market purchase 5,000\" says nothing. Use Groceries, Transport, Family categories to see where the money actually goes.",
        "4. Beware of fees. Each Wave/Orange/MoMo withdrawal costs 1–2%. Six withdrawals of 50,000 XOF = 3,000–6,000 XOF in fees — a meal's worth.",
        "5. Enable SMS alerts. Every operation should trigger a notification. Without that, you can't detect fraud.",
        "6. Never store your PIN on your phone. Not in notes, not in a photo, not in an email.",
        "7. Centralize in Budget Planner Pro. Seeing Wave + Orange + MoMo + bank in one view reveals your true net worth — often surprising.",
      ],
    },
  },
  {
    slug: 'remboursement-dettes',
    tag: 'Dettes',
    date: '2025-12-15',
    readingMinutes: 6,
    fr: {
      title: 'Méthode avalanche ou boule de neige : laquelle choisir pour rembourser ses dettes',
      summary: "Deux stratégies prouvées pour sortir de l'endettement. Comparaison chiffrée et exemple concret en FCFA.",
      body: [
        "Sortir de plusieurs dettes simultanément paraît insurmontable. Pourtant, deux méthodes éprouvées — l'avalanche et la boule de neige — ont aidé des millions de personnes à se libérer. Laquelle vous convient ?",
        "Méthode boule de neige (Dave Ramsey). Vous remboursez d'abord la plus petite dette, en payant le minimum sur les autres. Une fois liquidée, vous reportez cette mensualité sur la suivante. Avantage : motivation rapide, vous voyez une dette disparaître en 1–2 mois. Inconvénient : vous payez un peu plus d'intérêts au total.",
        "Méthode avalanche. Vous remboursez d'abord la dette au taux d'intérêt le plus élevé. Avantage : minimise le coût total des intérêts (souvent 10 à 30 % d'économies). Inconvénient : la première dette peut prendre longtemps à disparaître, ce qui démotive.",
        "Exemple chiffré. Vous devez : 200 000 FCFA à 18 % (carte), 500 000 FCFA à 12 % (banque), 80 000 FCFA à 0 % (famille). Capacité de remboursement : 100 000 FCFA/mois.",
        "Boule de neige : famille → carte → banque. Vous êtes libéré en ~9 mois et payez ~45 000 FCFA d'intérêts.",
        "Avalanche : carte → banque → famille. Vous êtes libéré en ~9 mois et payez ~38 000 FCFA d'intérêts. Économie : 7 000 FCFA.",
        "Notre recommandation : avalanche si vous êtes discipliné, boule de neige si vous avez besoin de victoires rapides. Dans Budget Planner Pro, le module Dettes simule les deux scénarios en un clic.",
      ],
    },
    en: {
      title: 'Avalanche vs Snowball: Which Debt Payoff Method to Choose',
      summary: "Two proven strategies to escape debt. A side-by-side comparison with a real XOF example.",
      body: [
        "Paying off several debts at once feels insurmountable. Yet two proven methods — avalanche and snowball — have helped millions break free. Which one fits you?",
        "Snowball method (Dave Ramsey). Pay off the smallest debt first while paying minimums on the rest. Once cleared, roll that payment into the next. Pros: fast motivation, one debt disappears in 1–2 months. Cons: slightly higher total interest.",
        "Avalanche method. Pay off the highest-interest debt first. Pros: minimizes total interest cost (often 10–30% savings). Cons: the first debt may take long to disappear, which can demotivate.",
        "Worked example. You owe: 200,000 XOF at 18% (card), 500,000 XOF at 12% (bank), 80,000 XOF at 0% (family). Repayment capacity: 100,000 XOF/month.",
        "Snowball: family → card → bank. Debt-free in ~9 months, paying ~45,000 XOF in interest.",
        "Avalanche: card → bank → family. Debt-free in ~9 months, paying ~38,000 XOF in interest. Savings: 7,000 XOF.",
        "Our take: avalanche if you're disciplined, snowball if you need quick wins. In Budget Planner Pro, the Debt module simulates both scenarios in one click.",
      ],
    },
  },
];

export const getPost = (slug: string): BlogPost | undefined =>
  BLOG_POSTS.find((p) => p.slug === slug);