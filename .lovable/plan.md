
Let me explore the current AI integration before planning.

The current AI integration is centered around `AIChatWidget.tsx` (chat) and the `ai-chat` edge function (already streaming, with rich context). Other AI edge functions exist for specific tasks: ai-suggest, ai-categorize, ai-budget-suggest, ai-forecast, ai-debt-plan, ai-savings-simulate, ai-detect-recurring, ai-report-insights, ai-wealth-valuation.

The user wants a "complete overhaul of form + content" of the integrated AI — same treatment as Notifications, Savings, Transactions, Budgets.

## Refonte complète de l'IA Coach Financier

### A. Forme — design premium glassmorphism

1. **`AIChatWidget` refonte complète**
   - **FAB (bouton flottant)** : pulse glow gradient primary→accent, badge "✨" animé, mini-tooltip "Coach IA" au hover
   - **Drawer/Sheet premium** : largeur élargie (sm:max-w-lg), glass background avec blobs décoratifs, header dégradé avec avatar Coach animé
   - **Bulles de message redesign** :
     - User : bulle alignée droite, gradient primary subtle, coin arrondi asymétrique
     - Assistant : avatar Coach (✨/🎯) à gauche, bulle glass avec markdown stylé (titres, listes, gras, tableaux)
     - Animation typing dots pendant streaming
     - Timestamp léger sous chaque message
   - **Markdown rendering** via `react-markdown` + styles `prose-sm` cohérents avec la charte
   - **Empty state Coach** : illustration animée + 4 quick prompts cliquables (chips) :
     - "Fais le bilan de mes finances ce mois 📊"
     - "Comment optimiser mon épargne ? 💰"
     - "Stratégie pour rembourser mes dettes 🎯"
     - "Que prévoir pour les 3 prochains mois ? 🔮"
   - **Composer redesigné** : textarea auto-grow, bouton micro (placeholder futur), bouton envoyer en gradient + raccourcis (Cmd+Enter)
   - **Scroll auto** + bouton "↓ Nouveau message" si l'utilisateur a scrollé en haut

2. **Header avec actions** : 
   - Avatar animé (sparkle qui pulse)
   - Badge "Coach Financier" + tagline ("Votre conseiller dédié")
   - Boutons : effacer conversation, exporter en PDF/MD, fermer

3. **Suggestions contextuelles dynamiques** sous le composer :
   - 2-3 follow-up prompts générés selon la dernière réponse (côté client, regex simple : si réponse mentionne "épargne" → propose "Simule un objectif", si "dette" → "Plan de remboursement")

### B. Fond — Coach Financier intelligent

1. **Persistance de conversation**
   - Nouvelle table `ai_conversations` (id, user_id, title, created_at, updated_at, archived)
   - Nouvelle table `ai_messages` (id, conversation_id, role, content, tokens_used, created_at)
   - RLS strict (user_id = auth.uid())
   - L'utilisateur peut reprendre la conversation à travers les sessions

2. **Historique conversations** (dans le drawer)
   - Liste latérale (collapse) des conversations passées avec titre auto-généré (premier message tronqué + IA résume après 3 échanges)
   - Bouton "+ Nouvelle conversation" 
   - Swipe / menu pour archiver / supprimer

3. **Edge function `ai-chat` enrichie**
   - Ajouter persistance : à chaque appel, créer/mettre à jour la conversation et insérer messages user+assistant
   - Conserver le streaming SSE existant (parsing en parallèle pour stocker la réponse complète à la fin)
   - Améliorer le system prompt :
     - Persona Coach Financier explicite, ton chaleureux, proactif
     - Toujours conclure par 1-2 actions concrètes ("Voici ce que je vous suggère…")
     - Format markdown systématique (titres ##, listes, **gras**, tableaux pour comparaisons)
     - Ne jamais dépasser ~250 mots sauf si analyse explicite demandée
   - Génération automatique du titre de conversation après le 1er échange (appel séparé non-streamé, gemini-flash-lite)

4. **Quick actions intelligentes (tool-like)**
   - Au lieu d'utiliser le tool calling Gemini (complexité), détecter dans la réponse IA les blocs spéciaux markdown :
     - `[ACTION:create_budget|category|amount]` → bouton "Créer ce cadre" rendu sous la bulle
     - `[ACTION:create_savings_goal|name|target]` → bouton "Créer cet objectif"
     - `[ACTION:view_module|budgets|transactions|savings]` → bouton "Voir le module"
   - Le system prompt instruit l'IA d'utiliser ces tags quand pertinent
   - Les boutons exécutent l'action client-side (ouvrir le bon dialog avec données pré-remplies, ou navigation)

5. **Contexte renforcé**
   - Étendre le `context` envoyé : inclure le `health_score`, les top 5 catégories du mois, les anomalies détectées (variation >25%)
   - Tronquer intelligemment si > 30k tokens (garder summary + 20 dernières transactions)

6. **Toasts unifiés** → migrer tous vers `coachToast`
   - Erreurs API → `coachToast.fail`
   - Conversation effacée → `coachToast.warn`
   - Conversation exportée → `coachToast.saved`

7. **Quota & Premium**
   - Free : 10 messages/mois, compteur visible dans le header
   - Pro : 100 messages/mois
   - Premium : illimité
   - Trigger DB sur `ai_messages` pour incrémenter compteur mensuel
   - Banner upgrade quand quota atteint

### C. Fichiers touchés

**Créer**
- `src/components/dashboard/ai/AICoachAvatar.tsx` (avatar animé sparkle)
- `src/components/dashboard/ai/AIMessageBubble.tsx` (bulle avec markdown + actions inline)
- `src/components/dashboard/ai/AIQuickPrompts.tsx` (chips quick prompts + follow-ups)
- `src/components/dashboard/ai/AIConversationList.tsx` (historique latéral)
- `src/hooks/useAIConversations.tsx` (CRUD conversations + messages)
- `src/lib/aiActionParser.ts` (parser des blocs `[ACTION:...]`)

**Refondre**
- `src/components/dashboard/AIChatWidget.tsx` (refonte UI complète + intégration historique + persistance)
- `supabase/functions/ai-chat/index.ts` (persistance, system prompt enrichi, génération titre)

**Migration DB**
- Tables `ai_conversations` + `ai_messages` avec RLS
- Trigger `update_conversation_updated_at`
- Compteur mensuel via vue `ai_usage_monthly`

**i18n**
- `src/i18n/dashTranslations.ts` : `aiCoach*` keys (~20 nouvelles clés FR/EN)

**Dépendance**
- `react-markdown` + `remark-gfm` (si pas déjà présents — à vérifier)

### D. Hors-scope
- Pas de tool calling natif Gemini (on parse les actions via tags markdown — plus simple, plus stable)
- Pas de voix / micro (UI prête mais pas implémentée)
- Pas de génération d'image inline
- Les autres edge functions IA (`ai-budget-suggest`, `ai-forecast`, etc.) restent intactes

### E. Mémoire
- Mettre à jour `mem://features/ai-capabilities` avec section "Refonte v2 : conversations persistantes + Coach UI premium + actions inline + quotas"
