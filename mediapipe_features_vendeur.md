# 🏪 Fonctionnalités Vendeur (Marchand) - Google MediaPipe

Ce document décrit en détail les outils intelligents d'intelligence artificielle locale sur-appareil (On-Device) que nous pouvons implémenter pour aider les marchands à créer des fiches produits de qualité professionnelle en quelques secondes.

---

## ✂️ 1. Détourage Photo d'Objets Ultra-Rapide & Local

### 🖼️ Suppression d'Arrière-plan en Temps Réel
* **Technologie** : `Image Segmenter` (avec modèle de segmentation d'objets ou Selfie Segmenter).
* **Expérience Vendeur** :
  1. Lors de l'ajout de photos à l'étape 4 de la création de produit, le vendeur clique sur un bouton **"Studio Fond Blanc"**.
  2. L'IA analyse l'image localement en moins de 150 millisecondes et sépare le produit de son environnement (table, sol, ombre portée, main du vendeur).
  3. L'arrière-plan d'origine est supprimé et remplacé par un blanc studio parfait, un fond gris neutre ou un dégradé élégant.
* **Bénéfice** : 
  * **Coût Zéro** : Contrairement aux services cloud (comme Remove.bg) qui coûtent des frais mensuels ou à chaque image, MediaPipe fonctionne de manière 100% gratuite et illimitée en local.
  * **Rapidité** : Pas besoin d'attendre que l'image soit envoyée sur internet, le détourage est instantané.

---

## 📐 2. Recadrage, Alignement et Cadrage Automatique

### 📦 Cadrage Intelligent des Fiches Produits
* **Technologie** : `Object Detector` (modèle de détection d'objets généraux).
* **Expérience Vendeur** :
  1. Dès que la photo est détourée ou prise, l'application détecte les limites physiques réelles de l'objet (largeur, hauteur).
  2. L'application ajuste la photo pour centrer le produit au millimètre près et applique des marges harmonieuses (ex: le produit occupe exactement 85% de la surface de l'image).
* **Bénéfice** : Uniformise toutes les images du catalogue de LibreShop. Les boutiques ont un rendu visuel digne d'Amazon ou de Shopify.

---

## 📦 3. Scanner et Reconstitution de Produits en 3D

### 🧊 Aperçu en Boîte Englobante 3D (3D BBox)
* **Technologie** : `Objectron` (détection d'objets 3D pour des catégories courantes comme boîtes, chaussures, tasses, chaises).
* **Expérience Vendeur** :
  1. Pour offrir l'essayage virtuel ou la visualisation 3D aux clients, le vendeur filme le produit en tournant lentement autour.
  2. MediaPipe détecte l'orientation de l'objet dans l'espace 3D et capture ses dimensions géométriques (boîte englobante tridimensionnelle).
  3. L'application crée un mini-modèle volumétrique interactif du produit pour les acheteurs.
* **Bénéfice** : Démocratise la création de modèles 3D pour les petits vendeurs sans matériel coûteux.

---

## 👁️ 4. Contrôle Qualité et Détecteur de Photos Floues

### 📉 Assistant de Prise de Vue Photo
* **Technologie** : Traitement d'image en temps réel via pipelines personnalisés de vision MediaPipe.
* **Expérience Vendeur** :
  1. Lors de la prise de vue de l'article, l'appareil photo analyse le flux vidéo en continu.
  2. L'IA avertit le vendeur en temps réel avant qu'il ne clique sur le bouton de capture :
     * *"⚠️ Attention, l'image est trop sombre."*
     * *"⚠️ Attention, l'appareil bouge (photo floue)."*
     * *"⚠️ Rapprochez-vous, le produit est trop petit dans le cadre."*
* **Bénéfice** : Garantit que les vendeurs soumettent uniquement des visuels haute définition vendeurs.
