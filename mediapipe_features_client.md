# 🛒 Fonctionnalités Client (Acheteur) - Google MediaPipe

Ce document décrit en détail les fonctionnalités d'intelligence artificielle sur-appareil (On-Device) et de réalité augmentée que nous pouvons implémenter pour enrichir l'expérience d'achat des clients de LibreShop.

---

## 🕶️ 1. Essayage Virtuel de Visage (Face Try-On)

### 👓 Lunettes & Accessoires (Chapeaux, Bijoux)
* **Technologie** : `Face Landmarker` (suivi tridimensionnel de 468 points de repère faciaux).
* **Expérience Utilisateur** :
  1. Le client clique sur un bouton **"Essayer en direct"** sur la fiche d'une paire de lunettes ou d'un chapeau.
  2. La caméra frontale s'active et détecte instantanément le visage.
  3. L'application superpose le modèle 3D ou l'image de l'article sur ses yeux/sa tête avec un ajustement dynamique de la taille, de l'orientation et de la perspective selon les mouvements de sa tête.
* **Bénéfice** : Réduction majeure de l'hésitation avant achat et augmentation du taux de conversion.

### 💄 Simulateur de Cosmétiques & Maquillage
* **Technologie** : `Face Landmarker` (masque de subdivision faciale ultra-précis).
* **Expérience Utilisateur** :
  1. Permet d'essayer des teintes de rouge à lèvres, de fard à paupières ou de fond de teint.
  2. Les teintes sont colorées en surimpression de manière translucide et réaliste avec prise en compte de la luminosité ambiante.
* **Bénéfice** : Idéal pour les boutiques de beauté et cosmétiques de LibreShop.

---

## 💍 2. Essayage Virtuel de Mains & Poignets (Hand Try-On)

### ⌚ Montres & Bracelets
* **Technologie** : `Hand Landmarker` (détection et suivi de 21 repères de la main en 3D).
* **Expérience Utilisateur** :
  1. L'acheteur pointe la caméra arrière vers son poignet.
  2. L'IA identifie la structure de la main et du poignet.
  3. Le cadran et le bracelet de la montre s'enroulent virtuellement autour de son poignet en temps réel.
* **Bénéfice** : Permet de se rendre compte de la taille réelle de la montre par rapport à son propre poignet.

### 💍 Bagues de Luxe
* **Technologie** : `Hand Landmarker` (segmentation individuelle des phalanges).
* **Expérience Utilisateur** :
  1. Positionnement précis d'une bague sur le doigt sélectionné par le client.
  2. Suivi fluide même si le client fait pivoter sa main.

---

## 👟 3. Essayage de Chaussures & Calcul de Pointure (Foot Try-On)

### 👟 Essayage de Chaussures en Réalité Augmentée
* **Technologie** : `Objectron` (détection d'objets 3D) et modèles personnalisés de repères de pieds.
* **Expérience Utilisateur** :
  1. L'acheteur pointe l'appareil photo vers ses pieds.
  2. Les chaussures virtuelles 3D recouvrent ses propres chaussures ou pieds nus avec un rendu réaliste des textures.
* **Bénéfice** : Indispensable pour la catégorie "Chaussures" de LibreShop.

### 📐 Calculateur de Pointure Intelligent
* **Technologie** : `Pose Landmarker` associé à un objet référent (ex: carte de fidélité ou feuille A4).
* **Expérience Utilisateur** :
  1. L'utilisateur pose son pied à côté d'une feuille A4 ou d'une carte plastique au sol et prend une photo rapide.
  2. L'IA compare la taille en pixels du pied par rapport à l'objet de taille physique normalisée connue.
  3. L'application calcule la longueur du pied en millimètres et suggère la pointure idéale (ex: "Votre pied mesure 25,5 cm, nous vous suggérons du 40").
* **Bénéfice** : Élimine les retours de chaussures pour mauvaise taille.

---

## 📐 4. Scanner Corporel de Vêtements (Body Try-On)

### 👚 Suggérer la Bonne Taille (Vêtements)
* **Technologie** : `Pose Landmarker` (suivi complet de 33 points d'articulations corporelles).
* **Expérience Utilisateur** :
  1. L'utilisateur se tient debout à 2 mètres de son appareil photo.
  2. L'IA cartographie sa silhouette en temps réel.
  3. L'application mesure la largeur des épaules, le tour de poitrine et la longueur des bras, puis sélectionne instantanément la taille idéale pour la veste ou le pantalon sélectionné.
* **Bénéfice** : Simplifie l'achat de vêtements en ligne.

---

## 🖲️ 5. Navigation Mains-Libres par Reconnaissance de Gestes

### 🖐️ Navigation sans Toucher l'Écran
* **Technologie** : `Gesture Recognizer` (reconnaissance de signes de main prédéfinis).
* **Expérience Utilisateur** :
  1. Très utile si l'acheteur essaye des vêtements à distance du téléphone ou a les mains occupées.
  2. **Geste vers la gauche/droite** : Fait défiler les photos du produit.
  3. **Pouce levé** : Ajoute l'article à sa liste de favoris.
  4. **Signe de la main ouverte** : Ouvre le panier.
* **Bénéfice** : Une expérience futuriste unique et extrêmement pratique.
