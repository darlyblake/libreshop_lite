# 🔧 Configuration Vercel - Variables d'environnement

Le site est blanc parce que **Vercel n'a pas vos variables d'environnement Supabase**.

---

## ✅ **Comment corriger en 2 minutes**

### 1️⃣ Allez sur Vercel Settings

1. Ouvrez [https://vercel.com/dashboard](https://vercel.com/dashboard)
2. Cliquez sur votre projet **libreshop-lite**
3. Allez à l'onglet **Settings** → **Environment Variables**

---

### 2️⃣ Ajoutez ces variables

Copiez-collez depuis votre fichier `.env` local :

| Variable | Valeur |
|----------|--------|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://gdjqzhbfibrsdiwvfhvp.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME` | `dbfurbs2p` |
| `EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | `libreShop` |
| `EXPO_PUBLIC_WEB_BASE_URL` | `https://libreshop-lite.vercel.app` |

**Pour chaque variable** :
- Remplissez le nom et la valeur
- Sélectionnez **Production**
- Cliquez **Add**

---

### 3️⃣ Redéployez

1. Allez à l'onglet **Deployments**
2. Cliquez sur le dernier déploiement (celui en haut)
3. Cliquez le bouton **Redeploy** (en haut à droite)

---

## ✨ **Résultat**

Attendez ~30 secondes et actualisez votre navigateur.

Le site devrait maintenant charger correctement ! 🎉

---

## 🔍 **Si vous avez encore un écran blanc**

Ouvrez la **Console du navigateur** (F12 → Console) et partagez l'erreur exacte.

On peut avoir :
- `Supabase URL undefined` → variable non définie
- `Cannot read property of undefined` → autre problème
- `Module not found` → problème de build

---

## 📝 **Note importante**

⚠️ **Ne commitez jamais votre `.env` avec les vraies clés !**

Il est déjà dans `.gitignore` ✅

Les clés Supabase dans Vercel sont sécurisées (chiffrées, inaccessibles publiquement).
