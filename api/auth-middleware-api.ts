/**
 * Middleware d'authentification pour les API endpoints
 * Vérifie que l'utilisateur est authentifié avant d'accéder aux endpoints protégés
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Vérifie si l'utilisateur est authentifié via le header Authorization
 * @param req - La requête HTTP
 * @returns L'utilisateur authentifié ou null
 */
export async function getAuthenticatedUser(req: any) {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Vérifier le token avec Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Error authenticating user:', error);
    return null;
  }
}

/**
 * Middleware qui exige une authentification
 * @param req - La requête HTTP
 * @param res - La réponse HTTP
 * @returns true si authentifié, sinon envoie une erreur 401
 */
export async function requireAuth(req: any, res: any): Promise<boolean> {
  const user = await getAuthenticatedUser(req);
  
  if (!user) {
    res.status(401).json({ error: 'Veuillez vous connecter' });
    return false;
  }

  return true;
}

/**
 * Middleware qui exige un rôle admin
 * @param req - La requête HTTP
 * @param res - La réponse HTTP
 * @returns true si admin, sinon envoie une erreur 403
 */
export async function requireAdmin(req: any, res: any): Promise<boolean> {
  const isAuthenticated = await requireAuth(req, res);
  
  if (!isAuthenticated) {
    return false;
  }

  const user = await getAuthenticatedUser(req);
  const role = user?.user_metadata?.role || user?.app_metadata?.role;

  if (role !== 'admin') {
    res.status(403).json({ error: 'Accès non autorisé' });
    return false;
  }

  return true;
}

/**
 * Vérifie si l'utilisateur a un rôle spécifique
 * @param req - La requête HTTP
 * @param allowedRoles - Les rôles autorisés
 * @returns true si l'utilisateur a un des rôles autorisés
 */
export async function hasRole(req: any, allowedRoles: string[]): Promise<boolean> {
  const user = await getAuthenticatedUser(req);
  
  if (!user) {
    return false;
  }

  const role = user?.user_metadata?.role || user?.app_metadata?.role;
  return allowedRoles.includes(role);
}

/**
 * Middleware qui exige un rôle spécifique
 * @param allowedRoles - Les rôles autorisés
 * @returns Middleware function
 */
export function requireRole(...allowedRoles: string[]) {
  return async (req: any, res: any, next: () => void) => {
    const user = await getAuthenticatedUser(req);
    
    if (!user) {
      res.status(401).json({ error: 'Veuillez vous connecter' });
      return;
    }

    const role = user?.user_metadata?.role || user?.app_metadata?.role;

    if (!allowedRoles.includes(role)) {
      res.status(403).json({ error: 'Accès non autorisé' });
      return;
    }

    next();
  };
}
