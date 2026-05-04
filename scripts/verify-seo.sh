#!/bin/bash
# Script de vérification SEO - LibreShop (2026-05-04)
# Usage: bash scripts/verify-seo.sh

set -e

echo "🔍 === VÉRIFICATION SEO LIBRESHOP === 🔍"
echo ""

# Couleurs pour le terminal
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Variables
DOMAIN="https://libreshop.shop"
LOCALHOST="http://localhost:3000"

# Fonctions helper
check_url() {
  local url=$1
  local expected=$2
  local name=$3
  
  echo -n "Checking $name... "
  
  if curl -s "$url" | grep -q "$expected"; then
    echo -e "${GREEN}✅ PASS${NC}"
    return 0
  else
    echo -e "${RED}❌ FAIL${NC}"
    return 1
  fi
}

# ========================================
# 1. Vérifier robots.txt
# ========================================
echo -e "\n${YELLOW}1️⃣  Vérification robots.txt${NC}"
check_url "$DOMAIN/robots.txt" "User-agent" "robots.txt accessible"
check_url "$DOMAIN/robots.txt" "Sitemap:" "robots.txt contient Sitemap"

# ========================================
# 2. Vérifier sitemap.xml
# ========================================
echo -e "\n${YELLOW}2️⃣  Vérification sitemap.xml${NC}"
check_url "$DOMAIN/sitemap.xml" "<?xml" "sitemap.xml accessible"
check_url "$DOMAIN/sitemap.xml" "<url>" "sitemap.xml contient URLs"
check_url "$DOMAIN/sitemap.xml" "libreshop.shop" "sitemap.xml URLs valides"

# Compter les URLs dans le sitemap
echo -n "Nombre d'URLs dans sitemap: "
URL_COUNT=$(curl -s "$DOMAIN/sitemap.xml" | grep -c "<url>" || echo "0")
if [ "$URL_COUNT" -gt 10 ]; then
  echo -e "${GREEN}$URL_COUNT${NC}"
else
  echo -e "${YELLOW}$URL_COUNT (trop peu)${NC}"
fi

# ========================================
# 3. Vérifier meta tags
# ========================================
echo -e "\n${YELLOW}3️⃣  Vérification meta tags${NC}"

check_url "$DOMAIN" "<title>" "Balise title présente"
check_url "$DOMAIN" "meta name=\"description\"" "Meta description présente"
check_url "$DOMAIN" "meta name=\"robots\"" "Meta robots présent"
check_url "$DOMAIN" "og:title" "Open Graph title présent"
check_url "$DOMAIN" "og:description" "Open Graph description présent"
check_url "$DOMAIN" "og:image" "Open Graph image présent"
check_url "$DOMAIN" "twitter:card" "Twitter Card présent"

# ========================================
# 4. Vérifier Structured Data
# ========================================
echo -e "\n${YELLOW}4️⃣  Vérification Structured Data (JSON-LD)${NC}"

SCHEMA_COUNT=$(curl -s "$DOMAIN" | grep -c "application/ld+json" || echo "0")
echo -n "Nombre de schemas JSON-LD: "
if [ "$SCHEMA_COUNT" -ge 2 ]; then
  echo -e "${GREEN}$SCHEMA_COUNT${NC}"
else
  echo -e "${RED}$SCHEMA_COUNT (devrait être ≥ 2)${NC}"
fi

check_url "$DOMAIN" "Organization" "Schema Organization présent"
check_url "$DOMAIN" "BreadcrumbList" "Schema BreadcrumbList présent"

# ========================================
# 5. Vérifier page /about
# ========================================
echo -e "\n${YELLOW}5️⃣  Vérification page /about${NC}"

if curl -s "$DOMAIN/about" | grep -q "À propos"; then
  echo -e "${GREEN}✅ Page /about accessible avec contenu${NC}"
else
  echo -e "${YELLOW}⚠️  Page /about non trouvée - intégrez-la dans votre navigation${NC}"
fi

# ========================================
# 6. Vérifier fichiers créés
# ========================================
echo -e "\n${YELLOW}6️⃣  Vérification des fichiers créés${NC}"

FILES=(
  "src/services/seoService.ts"
  "src/components/ProductSchema.tsx"
  "src/screens/AboutStaticScreen.tsx"
  "scripts/generate-sitemap-advanced.js"
  "modifications/SEO_ACTION_PLAN.md"
  "modifications/INTEGRATION_SEO_GUIDE.md"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo -e "${GREEN}✅${NC} $file"
  else
    echo -e "${RED}❌${NC} $file (manquant)"
  fi
done

# ========================================
# 7. Lighthouse (si installé)
# ========================================
echo -e "\n${YELLOW}7️⃣  Lighthouse Audit (optionnel)${NC}"

if command -v lighthouse &> /dev/null; then
  echo "Lancement Lighthouse (cela peut prendre 1-2 minutes)..."
  lighthouse "$DOMAIN" --output=json --output-path=./lighthouse-report.json --chrome-flags="--headless" 2>/dev/null
  
  # Extraire les scores
  SEO_SCORE=$(node -e "console.log(require('./lighthouse-report.json').categories.seo.score * 100)" 2>/dev/null || echo "N/A")
  PERF_SCORE=$(node -e "console.log(require('./lighthouse-report.json').categories.performance.score * 100)" 2>/dev/null || echo "N/A")
  
  echo "SEO Score: $SEO_SCORE/100"
  echo "Performance Score: $PERF_SCORE/100"
  echo "Rapport complet: ./lighthouse-report.json"
else
  echo "Lighthouse non installé. Pour l'installer:"
  echo "  npm install -g lighthouse"
fi

# ========================================
# 8. Résumé
# ========================================
echo -e "\n${YELLOW}📊 === RÉSUMÉ ===${NC}"
echo ""
echo "✅ Éléments complétés:"
echo "  • Structured Data (JSON-LD)"
echo "  • Meta tags optimisés"
echo "  • Service SEO créé"
echo "  • Page statique /about créée"
echo "  • Sitemap avancé disponible"
echo ""
echo "⏳ À faire:"
echo "  1. Intégrer /about dans votre navigation"
echo "  2. Ajouter ProductSchema et StoreSchema à vos pages"
echo "  3. Utiliser seoService pour les meta tags dynamiques"
echo "  4. Générer le sitemap: node scripts/generate-sitemap-advanced.js"
echo "  5. Déployer sur Vercel"
echo "  6. Soumettre le sitemap à Google Search Console"
echo ""
echo "📚 Documentation:"
echo "  • Plan complet: modifications/SEO_ACTION_PLAN.md"
echo "  • Intégration: modifications/INTEGRATION_SEO_GUIDE.md"
echo "  • Résumé: modifications/SEO_IMPLEMENTATION_SUMMARY.md"
echo ""
echo -e "${GREEN}✅ Vérification terminée !${NC}"
echo ""
