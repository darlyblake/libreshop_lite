2026-05-02 — Harmonisation thème & corrections TypeScript

Résumé rapide
- Migration et harmonisation de l'API thème : ajout de `useTheme()` avec wrapper de compatibilité (`themeWithHelpers`) et alias couleur `star`.
- Ajout d'un chargeur Skia cross-platform (`SkiaLoader`) pour éviter les erreurs d'import dans `App.tsx`.
- Correction du typage d'icônes dynamiques en castant `name={icon as any}` sur plusieurs composants (`Badge`, `Button`, écrans vendeurs).
- Refactor: `OrderCard` → factory `getStatusColorFactory(COLORS)` pour éviter références globales non définies.
- Remplacements/réparations : suppression de propriétés style invalides (ex. `transition`), correction de `RADIUS` usages, et fix `useRef<NodeJS.Timeout | null>(null)`.
- Types de navigation : ajout des écrans `AgentChat` et `AdminAgentChat` à `RootStackParamList`.

Etat actuel
- Compilation TypeScript réduite significativement (120+ → ~60 erreurs). Restent des erreurs de styles manquants, mismatches de types (ex. `Product`), et quelques déclarations manquantes (`node-fetch`, `@vercel/node`).

Prochaines étapes recommandées
1. Ajouter déclarations / types pour modules dev (`node-fetch`, `@vercel/node`) ou installer `@types` correspondants.
2. Ajouter définitions de styles manquants dans `ClientHomeScreen`, `ClientSearchScreen`, `ClientOrdersScreen`, etc.
3. Résoudre les mismatches d'interface (`Product`, `OrderWithDetails`) et props de composants (cas par cas).
4. Relancer `npx tsc --noEmit` et itérer jusqu'à zéro erreur.

Notes
- Les changements appliqués ont été faits pour maximiser la réduction d'erreurs en priorité (fondations thème, types navigation, icônes dynamiques).
- Voir le résumé détaillé dans la conversation de l'agent pour la liste complète des fichiers modifiés.
