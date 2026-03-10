# 🔐 Configuration Google OAuth avec Supabase

## 📋 Sommaire
1. Configuration Supabase
2. Configuration de l'App
3. Flux d'authentification
4. Troubleshooting

---

## 1️⃣ Configuration Supabase

### Étape 1: Configurer Google OAuth dans Supabase Dashboard

1. Allez à **Supabase Dashboard** → votre projet
2. Naviguez vers **Authentication** → **Providers**
3. Trouvez **Google** et cliquez sur **Enable**
4. Vous verrez un formulaire avec:
   - **Client ID**
   - **Client Secret**

### Étape 2: Créer les credentials Google

1. Allez à [Google Cloud Console](https://console.cloud.google.com)
2. Créez un nouveau projet ou sélectionnez un existant
3. Allez à **APIs & Services** → **Credentials**
4. Cliquez **Create Credentials** → **OAuth 2.0 Client ID**
5. Sélectionnez **Android** (pour test sur device)
   - Entrez votre **Package Name**: `com.libreshop.app`
   - Générez et téléchargez le **SHA-1 certificate fingerprint** via Expo:
   ```bash
   eas credentials show --platform android
   # Ou localement:
   keytool -list -v -keystore ~/.android/debug.keystore
   ```
6. Cliquez **Create** et copiez le **Client ID**

### Étape 3: Configurer les Authorized Redirect URIs

Dans Supabase Google Provider settings, vous verrez les URIs requises. Ajoutez-les à Google Cloud Console:
- `https://[YOUR-PROJECT].supabase.co/auth/v1/callback`

### Étape 4: Ajouter le Client ID à Supabase

1. Copiez le **Google Client ID** depuis Google Cloud Console
2. Collez-le dans **Supabase Dashboard** → **Authentication** → **Providers** → **Google**
3. Cliquez **Save**

---

## 2️⃣ Configuration de l'App

### Deep Linking Configuration (Déjà fait ✅)

Le fichier `app.json` inclut:
```json
{
  "scheme": "libreshop",
  "android": {
    "intentFilters": [
      { "scheme": "libreshop" },
      { "scheme": "https", "host": "*.libreshop.app" }
    ]
  }
}
```

### Fonction d'Auth Google (Déjà implémentée ✅)

Dans `src/lib/supabase.ts`:
```typescript
async signInWithGoogle(redirectUrl: string) {
  const client = useSupabase();
  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: false,
    },
  });
  if (error) throw error;
  return data;
}
```

---

## 3️⃣ Flux d'authentification

### Quand l'utilisateur clique "Continuer avec Google":

1. **SellerAuthScreen** appelle `handleGoogleSignIn()`
2. Supabase ouvre **Google Login** dans le navigateur
3. L'utilisateur se connecte avec son compte Google
4. Google redirige vers `libreshop://auth/callback?...`
5. **App.tsx** détecte le deep link
6. **SellerAuthScreen** reçoit le callback
7. La session Supabase est créée automatiquement
8. L'app crée le profil utilisateur si nécessaire
9. L'utilisateur est redirigé vers **SellerTabs** ou **SellerAddStore**

---

## 4️⃣ Troubleshooting

### Problème: "Google sign-in not enabled"
- ✅ Vérifiez que Google est **enabled** dans Supabase
- ✅ Vérifiez le Google Client ID est configuré
- ✅ Vérifiez les Redirect URIs

### Problème: Deep link ne fonctionne pas
```bash
# Test le deep link:
adb shell am start -W -a android.intent.action.VIEW -d "libreshop://auth/callback?code=xyz" com.libreshop.app

# Ou sur iOS:
xcrun simctl openurl booted "libreshop://auth/callback?code=xyz"
```

### Problème: "Invalid redirect URI"
- ✅ Vérifiez l'URI dans Google Cloud Console
- ✅ Vérifiez l'URI dans Supabase auth settings
- ✅ Vérifiez le format: `https://[PROJECT-ID].supabase.co/auth/v1/callback`

### Problème: User metadata doesn't have role
- Après OAuth, le `user_metadata` peut être vide
- ✅ Ajouter le rôle dans Supabase Dashboard → Users → Edit user_metadata:
```json
{
  "role": "seller"
}
```
- Ou mettre à jour via trigger PostgreSQL

### Problème: Redirect loop
- OAuth n'est pas complètement intégré
- ✅ Vérifiez que App.tsx gère les deep links
- ✅ Vérifiez que app.json a le correct `scheme`

---

## ✅ Test Workflow

1. **Build & Run**:
   ```bash
   npm run android
   # ou
   npm run ios
   ```

2. **Aller à SellerAuthScreen**
3. **Cliquer "Continuer avec Google"**
4. **Se connecter avec Google** (ou créer un compte test)
5. **Vérifier la redirection** vers SellerTabs/SellerAddStore

---

## 🔒 Sécurité

- ✅ OAuth flow est côté serveur (Supabase)
- ✅ Client secret jamais exposé au client
- ✅ Session créée automatiquement après OAuth
- ✅ User role peut être défini dans user_metadata

---

## 📚 Références

- [Supabase Google Auth](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Expo Deep Linking](https://docs.expo.dev/guides/linking/)
- [React Native OAuth Patterns](https://reactnative.dev/docs/linking)
