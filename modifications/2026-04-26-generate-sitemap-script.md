# Génération automatique du sitemap

Date : 2026-04-26
Auteur : automatisation (Copilot)

Action : ajout d'un script `scripts/generate-sitemap.js` et d'un exemple `scripts/urls.example.json`.

Utilisation :

```bash
# exécutez depuis la racine du projet
node scripts/generate-sitemap.js
# ou via npm
npm run generate-sitemap
```

Le script lit `scripts/urls.json` si présent (format JSON array) pour ajouter des URLs dynamiques (produits, boutiques). Sinon, il génère un sitemap basé sur une liste de routes statiques présentes dans le script.

Fichiers ajoutés :
- `scripts/generate-sitemap.js`
- `scripts/urls.example.json` (exemple)

Fichier mis à jour :
- `public/sitemap.xml` (écrit / remplacé automatiquement)

Prochaine étape : fournir un `scripts/urls.json` réel listant toutes les pages produits/boutiques, ou brancher ce script sur votre base de données pour une génération automatique.
