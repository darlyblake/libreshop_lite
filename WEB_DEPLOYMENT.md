# 🚀 React Native Web - Configuration

LibreShop est maintenant configuré pour fonctionner sur **web**, **iOS** et **Android** avec le **même code**.

---

## 📱 **Déploiement Web sur Vercel**

### 1️⃣ **Build Web Local**

```bash
npm run build:web
```

Cela génère le dossier `dist/` avec tous les fichiers web statiques.

---

### 2️⃣ **Déployer sur Vercel**

La configuration est déjà prête dans `vercel.json` :

```bash
git add .
git commit -m "Add React Native Web configuration"
git push origin main
```

Vercel va automatiquement :
1. ✅ Installer les dépendances (`npm install`)
2. ✅ Construire le web (`expo export:web`)
3. ✅ Servir depuis le dossier `dist/`

---

## 📋 **Fichiers configurés**

| Fichier | But |
|---------|-----|
| `vercel.json` | Configuration Vercel (build command, output dir) |
| `web/index.js` | Point d'entrée web |
| `web/index.css` | Styles CSS web |
| `app.json` | Configuration Expo (web build settings) |
| `package.json` | Script `build:web` ajouté |

---

## 🔗 **URLs**

- **Web** : `https://libreshop.vercel.app` (sera actif après push)
- **Supabase** : Même base de données que mobile
- **API** : Même endpoints que mobile

---

## ⚙️ **Variables d'environnement**

Les variables `.env` sont automatiquement chargées :

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your-preset
EXPO_PUBLIC_WEB_BASE_URL=https://libreshop.vercel.app
```

---

## 🎯 **Points importants**

✅ Même interface React Native sur web et mobile  
✅ Zéro code dupliqué pour les interfaces  
✅ Supabase backend partagé  
✅ Envs automatiquement injectées  
✅ Déploiement automatique sur Vercel  

---

## 📝 **Prochaines étapes**

1. Push le code vers `main`
2. Vercel construit automatiquement
3. Le site web est live à `https://libreshop.vercel.app`
4. Continuez à développer - tous les déploiements sont auto

Voilà ! 🎉
