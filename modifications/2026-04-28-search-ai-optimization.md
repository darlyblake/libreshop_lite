# Modification du 28 Avril 2026 - Optimisation de l'IA de Recherche

## Fichiers modifiés
- `src/services/grocService.ts`

## Sections impactées
- Barre de recherche (ClientHomeScreen, ClientSearchScreen)
- Service de recherche intelligente (GrocService)

## Objectif
Optimiser la barre de recherche pour qu'elle soit réellement "intelligente" en utilisant soit l'IA de **Grok (xAI)**, soit **Google Gemini**, avec une détection automatique et un système de repli (fallback).

## Détails des changements
1.  **Support multi-fournisseurs** : Ajout de la logique de connexion à l'API xAI (Grok).
2.  **Détection automatique des clés** : Le service identifie maintenant le type de clé API (xAI vs Gemini) grâce aux préfixes (ex: `xai-`).
3.  **Correction de bug de priorité** : Résolution d'un problème où une clé Grok était envoyée par erreur à l'URL de Gemini, provoquant des échecs de recherche.
4.  **Système de repli (Fallback)** : Si Grok est indisponible ou manque de crédits, le système bascule automatiquement sur Gemini Flash pour garantir la continuité du service "intelligent".
5.  **Amélioration des prompts** : Optimisation du prompt système pour garantir des réponses JSON valides et des mots-clés de recherche pertinents.

## Résultat
La barre de recherche est maintenant plus robuste et capable de comprendre l'intention de l'utilisateur (ex: transformer "cadeau pour femme" en mots-clés comme "bijoux", "parfums", etc.) peu importe le fournisseur d'IA configuré.
