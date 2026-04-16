# Structure de l'authentification et gestion des rôles

Ce document décrit comment l'authentification est implémentée dans le
projet et de quelle manière les différents rôles d'utilisateur sont
structurés et utilisés.

## 1. Service d'authentification (`src/lib/supabase.ts`)

```ts
export type UserRole = 'client' | 'seller' | 'admin';

export const authService = {
  async signUp(email, password, fullName, role: UserRole = 'client') {
    const client = useSupabase();
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } },
    });
    ...
  },

  async signIn(email, password) {
    const client = useSupabase();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    ...
  },

  async getCurrentUser() { ... }
};
```

- `signUp` envoie un rôle (`client`, `seller` ou `admin`) dans les metadata
  Supabase lors de la création de l'utilisateur.
- `signIn` récupère simplement l'utilisateur connecté, sans rôle explicite
  (le rôle se trouve dans `user.user_metadata.role`).
- Le rôle est conservé côté client après connexion pour piloter la
  navigation et l'affichage.

## 2. Stockage local (`src/lib/storage.ts`)

La bibliothèque `AsyncStorage` est utilisée pour retenir la session et le
rôle de l'utilisateur :

```ts
export const sessionStorage = {
  async saveSession(userId: string, email: string) { ... }
  async getSession() { ... }
  async clearSession() { ... }
  async saveUserRole(role: string) { ... }
  async getUserRole(): Promise<string | null> { ... }
};
```

Après chaque inscription/connexion, il faut appeler
`saveUserRole()` afin que l'app sache quel stack afficher au prochain
redémarrage.

## 3. Écrans d'authentification

Actuellement l'écran principal est `SellerAuthScreen.tsx` ; sa logique de
bouton se limite à effectuer la validation et appeler la navigation
`navigation.replace('SellerAddStore')` : l'appel effectif à `authService` n'est
pas encore implémenté. L'idée générale est :

1. Lors de l'inscription : `authService.signUp(formData..., 'seller')` ou
   `...,'client'` selon le type d'utilisateur.
2. Lors de la connexion : `authService.signIn(...)`.
3. Stocker le rôle renvoyé par Supabase avec `storage.saveUserRole(role)`.
4. Rediriger l'utilisateur vers le stack adapté (vendeur, client, admin).

## 4. Rôles et permissions

| Rôle   | Accès principal                                   |
|--------|--------------------------------------------------|
| client | Navigation côté client (catalogue, commandes)    |
| seller | Tableau de bord vendeur, gestion de boutique     |
| admin  | Interface d'administration, gestion des plans    |

Le contrôle des rôles côté client est essentiellement visuel/navigation.
Les politiques de sécurité (policies) doivent être définies dans
Supabase pour empêcher les utilisateurs non autorisés d'accéder ou
de modifier des données protégées.

## 5. Points d'amélioration

- Compléter l'écran d'authentification pour appeler réellement
  `authService` et gérer les erreurs.
- Vérifier `user.user_metadata.role` après `getCurrentUser()` et
  synchroniser avec `sessionStorage`.
- Mettre en place des policies Supabase basées sur `auth.role`.
- Ajouter des flux spécifiques aux administrations et aux clients
  (écrans séparés, menu conditionnel, etc.).

---

Ce fichier offre une vue d'ensemble rapide de la structure de
l'authentification et peut être tenu à jour en fonction des évolutions
futures.