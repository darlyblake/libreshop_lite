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

---

## 📖 Guide Pratique & Astuces pour les Vendeurs

Pour tirer le meilleur parti des technologies d'intelligence artificielle de LibreShop, suivez ces conseils simples :

### 1. 💡 Réussir son détourage "Studio Fond Blanc" du premier coup
* **Contraste suffisant** : Prenez la photo sur un fond contrasté par rapport au produit (évitez de photographier une chaussure blanche sur une nappe blanche).
* **Éclairage uniforme** : Préférez une lumière naturelle ou une pièce bien éclairée pour éviter que l'IA ne confonde les ombres fortes avec le contour du produit.
* **Surface plane** : Posez le produit sur une table ou suspendez-le. Évitez d'avoir trop d'éléments perturbateurs autour.

### 2. 📏 Utiliser le Cadrage Automatique à 85%
* **Aucun effort requis** : Prenez simplement la photo ! L'IA va recadrer et centrer automatiquement l'objet au millimètre près en y appliquant une marge uniforme.
* **Résultat garanti** : Vos produits s'alignent parfaitement dans la grille générale de la boutique, créant un sentiment de confiance immédiat pour l'acheteur.

### 3. 🧊 Réussir sa capture pour l'Aperçu 3D
* **Mouvement fluide** : Filmez en tournant lentement à 360° autour du produit posé sur une table stable.
* **Distance fixe** : Gardez l'appareil à la même distance (environ 50 cm) pendant toute la rotation.
* **Vérification** : Cliquez sur le bouton **"Aperçu 3D"** sous la miniature pour afficher la boîte englobante virtuelle et valider la structure spatiale calculée par l'IA.

### 4. 👁️ Comprendre le Rapport de Qualité IA
* **Lumière OK / Sombre** : Si le badge affiche `Sombre` en violet, l'IA vous conseille de vous déplacer vers une zone plus éclairée ou d'activer le flash.
* **Netteté OK / Floue** : Si le badge affiche `Floue` en rouge, cela signifie que la mise au point n'était pas stabilisée. Reprenez la photo pour garantir des détails impeccables pour le client.
* **Taille OK / Trop Petit** : Si l'IA estime que le produit est trop petit, rapprochez l'appareil photo du produit pour capturer tous ses détails.

