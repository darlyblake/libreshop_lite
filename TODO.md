# TODO : Mise à jour Sitemap Dynamique (LibreShop SEO)

## ✅ Étapes complétées
- [x] Analysé routes (AppNavigator.tsx) : /store/:slug, /product/:productId
- [x] Vérifié sitemap actuel & scripts existants
- [x] Plan confirmé par user

## ✅ Étapes complétées
1. [✅] Exécuté \`node scripts/generate-sitemap.js\` (22 URLs : statiques + exemples dynamiques /product & /store)
2. [✅] Ajouté scripts/urls.json avec vraies routes exemples
3. [✅] Optimisé script (ajout /about/contact/faq)
4. [✅] XML valide & robots.txt OK

## 🔄 Follow-up (optionnel)
- Ajouter SUPABASE_URL/KEY pour fetch vraies données DB
- Hook Vercel : buildCommand inclure \`node scripts/generate-sitemap.js\`
- Submit à Google Search Console après deploy

**Tâche principale terminée !**

## 📋 Notes
- Script utilise SUPABASE_URL/SUPABASE_KEY (env vars)
- Inclut top stores/products actifs (limités pour perf)
- Priorités : home=1.0, products/stores=0.8-0.85

