# Audit SEO — libreshop.shop

Date : 2026-04-26
Site analysé : libreshop.shop

IMPORTANT : tentative d'accès automatique échouée depuis cet environnement (connexion réseau bloquée). Ce document contient :
- un audit méthodologique et des vérifications automatisées à lancer localement
- une checklist actionnable
- des exemples de balises et de schéma à appliquer

---

## Résumé exécutif

Je n'ai pas pu récupérer le site directement depuis l'agent (erreur réseau). Ce rapport fournit une analyse structurelle et une checklist complète que vous (ou moi si vous autorisez un accès réseau) pouvez remplir rapidement en exécutant les commandes listées ci‑dessous. Objectif : atteindre un référencement optimal sur Google (visibilité organique, rich snippets, indexation rapide).

## Comment reproduire les vérifications (commande rapides)

- Vérifier la page d'accueil et la balise `<title>` :

```bash
curl -s -L https://libreshop.shop | sed -n '1,200p'
```

- Vérifier `robots.txt` :

```bash
curl -s https://libreshop.shop/robots.txt
```

- Vérifier `sitemap.xml` :

```bash
curl -s https://libreshop.shop/sitemap.xml | sed -n '1,200p'
```

- Récupérer les balises meta importantes (title, meta description, canonical, hreflang) :

```bash
curl -sL https://libreshop.shop | pup 'title text{}; meta[name="description"] attr{content}; link[rel="canonical"] attr{href}'
```

- Lancer Lighthouse (audit performance / SEO / accessibility) :

```bash
npx -y lighthouse https://libreshop.shop --output=json --output-path=./lighthouse-report.json --chrome-flags="--headless"
```

- Tester la version mobile et la vitesse : utiliser PageSpeed Insights ou `lighthouse` via CLI.

## Checklist On‑page (contrôles à faire et résultats attendus)

- Title : présent, unique, 50–60 caractères, contient mot-clé principal.
- Meta description : présente, 120–155 caractères, incitative et unique.
- H1 : une seule balise H1 par page, pertinente et contenant le mot-clé.
- Balises Hn : structure logique (H1 → H2 → H3).
- Canonical : présent et pointant vers l'URL préférée.
- Open Graph / Twitter card : présents pour partage social.
- Images : attribut `alt` descriptif + compression WebP/AVIF.
- Contenu : minimum 300 mots pour pages principales, répond à l'intention utilisateur.
- URL : lisible, courte, et contient le mot-clé si possible.

Remplir les champs ci‑dessous lors des vérifications :

- Title (homepage) :
- Meta description (homepage) :
- H1 (homepage) :
- Canonical (homepage) :
- Robots.txt accessible : oui/non
- Sitemap.xml accessible : oui/non

## Checklist Technique

- SSL : certificat valide et redirection HTTP → HTTPS.
- Mobile‑first : responsive, viewport meta correct.
- Temps de réponse : TTFB < 600ms idéalement.
- Compression et cache : gzip/brotli, headers `Cache-Control` configurés.
- Sitemap.xml : généré automatiquement et listant toutes les pages importantes.
- robots.txt : ne bloque pas les ressources essentielles (CSS/JS) et référence le sitemap.
- Redirections : 301 pour pages supprimées, éviter chaines de redirections.
- Structured data : JSON‑LD pour produits, breadcrumb, organisation.

## Exemple de JSON‑LD pour une fiche produit (schema.org/Product)

```json
{
  "@context": "https://schema.org/",
  "@type": "Product",
  "name": "Nom du produit",
  "image": ["https://libreshop.shop/images/produit-1.webp"],
  "description": "Description courte du produit",
  "sku": "SKU123",
  "mpn": "MPN123",
  "brand": {"@type": "Brand","name": "LibreShop"},
  "offers": {
    "@type": "Offer",
    "url": "https://libreshop.shop/produit/slug",
    "priceCurrency": "EUR",
    "price": "49.90",
    "availability": "https://schema.org/InStock"
  }
}
```

## Priorités d'intervention (1=haute)

- (1) Corriger les balises Title / Meta description manquantes ou dupliquées.
- (1) Générer / vérifier `sitemap.xml` et déclarer dans `robots.txt`.
- (1) Mettre en place Google Search Console & soumettre sitemap.
- (1) Structured data produits pour rich snippets (étoiles, prix).
- (2) Améliorer performance (optimiser images, cache, CDN si possible).
- (2) Audit mobile / responsive.
- (3) Stratégie contenu : pages piliers + articles proches de l'intention utilisateur.
- (3) Netlinking : obtenir backlinks thématiques de qualité.

## Recommandations concrètes

- Ajouter/optimiser `title` et `meta description` sur chaque page principale.
- Vérifier qu'il n'y ait pas de balises `noindex` accidentelles.
- Implémenter JSON‑LD produit + breadcrumbs.
- Configurer `og:title`, `og:description`, `og:image` et `twitter:card`.
- Générer sitemap.xml dynamique (ex : via script back-end ou builder) et l'envoyer à GSC.
- Mettre en place cache HTTP et politiques d'expiration pour assets statiques.

## Modèle de fichier `robots.txt` recommandé

```
User-agent: *
Disallow:

Sitemap: https://libreshop.shop/sitemap.xml
```

## Plan d'actions immédiates (exécution)

1. Lancer les commandes `curl` et `lighthouse` listées plus haut et coller les résultats.
2. Appliquer les corrections prioritaires (Titles, sitemap, robots, JSON‑LD).
3. Soumettre sitemap à Google Search Console et surveiller l'indexation.
4. Mettre en place monitoring (Search Console, Google Analytics, alertes vitesse).

## Points de contrôle / Template de rapport (à compléter)

- Date de vérif : 
- Vérificateur : 
- Title ok : oui/non — commentaire
- Meta description ok : oui/non — commentaire
- H1 ok : oui/non — commentaire
- Robots accessible : oui/non — contenu
- Sitemap accessible : oui/non — contenu
- Lighthouse score (Perf/SEO/Acc/Best Practices) :

## Fichiers ajoutés / modifiés

- `modifications/SEO_audit_libreshop.shop.md` (vous êtes en train de le lire)

---

Si vous voulez, je peux :

- exécuter les checks automatiquement si vous m'autorisez l'accès réseau depuis cet environnement
- ou vous fournir un script bash/Node qui exécute toutes les vérifications et génère un rapport JSON/MD à déposer dans `modifications/`.

Que préférez‑vous ?
