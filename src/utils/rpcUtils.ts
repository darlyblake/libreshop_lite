/**
 * Utilitaires pour les RPC Supabase avec fallback et retry logic
 * Permet de gérer les erreurs réseau et les RPCs manquants de manière robuste
 */

import { useSupabase } from '../lib/supabase';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface RpcExecutionOptions {
  maxRetries?: number;
  backoffMs?: number;
  shouldRetry?: (error: any) => boolean;
  rpcName?: string; // Pour logs
}

export const rpcUtils = {
  /**
   * Exécute une RPC avec retry logic et fallback
   * @param rpcName Nom de la RPC
   * @param params Paramètres de la RPC
   * @param fallback Fonction de fallback si la RPC échoue ou n'existe pas
   * @param options Options de retry et comportement
   */
  async executeWithFallback<T>(
    rpcName: string,
    params: any,
    fallback: () => Promise<T>,
    options: RpcExecutionOptions = {}
  ): Promise<T> {
    const {
      maxRetries = 2,
      backoffMs = 500,
      shouldRetry = (e: any) => !this.isMissingRpcError(e),
      rpcName: logName = rpcName,
    } = options;

    const client = useSupabase();

    // Essayer la RPC avec retry
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const { data, error } = await client.rpc(rpcName, params);
        
        if (error) {
          // Si c'est une RPC manquante, aller directement au fallback
          if (this.isMissingRpcError(error)) {
            console.warn(`[rpcUtils] RPC "${rpcName}" not found, using fallback`);
            return fallback();
          }
          throw error;
        }

        return data;
      } catch (error: any) {
        const isLastAttempt = attempt === maxRetries;
        
        if (isLastAttempt || !shouldRetry(error)) {
          console.warn(
            `[rpcUtils] RPC "${rpcName}" failed after ${attempt + 1} attempts, using fallback`,
            error?.message || error
          );
          return fallback();
        }

        // Exponential backoff
        const delayMs = backoffMs * Math.pow(2, attempt);
        console.warn(
          `[rpcUtils] RPC "${rpcName}" attempt ${attempt + 1} failed, retrying in ${delayMs}ms`,
          error?.message || error
        );
        await sleep(delayMs);
      }
    }

    // Fallback final
    return fallback();
  },

  /**
   * Détecte si une erreur RPC indique que la fonction n'existe pas
   */
  isMissingRpcError(error: any): boolean {
    const message = String(error?.message || '').toLowerCase();
    const code = error?.code;

    return (
      code === 'PGRST202' || // PostgresError: function not found
      message.includes('could not find the function') ||
      message.includes('does not exist') ||
      message.includes('undefined function')
    );
  },

  /**
   * Détecte si une erreur est due à un conflit (constraint violation)
   */
  isConstraintError(error: any): boolean {
    const message = String(error?.message || '').toLowerCase();
    const code = error?.code;

    return (
      code === '23514' || // check_violation
      code === '23505' || // unique_violation
      code === '23503' || // foreign_key_violation
      message.includes('violates') ||
      message.includes('constraint')
    );
  },

  /**
   * Détecte si une erreur est due à un problème réseau/timeout
   */
  isNetworkError(error: any): boolean {
    const message = String(error?.message || '').toLowerCase();

    return (
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('connection refused') ||
      message.includes('econnrefused')
    );
  },

  /**
   * Détecte si une erreur est liée aux RLS (Row Level Security)
   */
  isRlsError(error: any): boolean {
    const message = String(error?.message || '').toLowerCase();
    const code = error?.code;

    return (
      code === '42501' || // insufficient_privilege
      message.includes('rls') ||
      message.includes('row level security') ||
      message.includes('new row violates row-level security')
    );
  },

  /**
   * Crée une fonction wrappée pour standardiser les erreurs RPC
   */
  wrapRpc<T>(
    rpcName: string,
    params: any,
    fallback?: () => Promise<T>,
    options?: RpcExecutionOptions
  ) {
    if (!fallback) {
      throw new Error('Fallback function required for wrapRpc');
    }
    return this.executeWithFallback(rpcName, params, fallback, {
      ...options,
      rpcName,
    });
  },

  /**
   * Batch multiple RPC calls with retry
   */
  async executeBatch<T>(
    calls: Array<{
      rpcName: string;
      params: any;
      fallback: () => Promise<T>;
      options?: RpcExecutionOptions;
    }>
  ): Promise<T[]> {
    return Promise.all(
      calls.map(call =>
        this.executeWithFallback(
          call.rpcName,
          call.params,
          call.fallback,
          call.options
        )
      )
    );
  },
};

// Helper pour retry logic générique (utile pour fetch aussi)
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RpcExecutionOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    backoffMs = 1000,
    shouldRetry = () => true,
  } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isLastAttempt = attempt === maxRetries;

      if (isLastAttempt || !shouldRetry(error)) {
        throw error;
      }

      const delayMs = backoffMs * Math.pow(2, attempt);
      console.warn(
        `[withRetry] Attempt ${attempt + 1} failed, retrying in ${delayMs}ms`,
        error?.message || error
      );
      await sleep(delayMs);
    }
  }

  throw new Error('Max retries exceeded');
}

/**
 * Helper pour normaliser les cursors de pagination
 * Utilise btoa/atob pour la compatibilité web (Buffer n'existe pas en navigateur)
 */
export function encodeCursor(timestamp: string, id: string): string {
  const data = `${timestamp}|${id}`;
  // Utiliser btoa pour encoder en base64 (compatible navigateur)
  return typeof btoa !== 'undefined' ? btoa(data) : Buffer.from(data).toString('base64');
}

export function decodeCursor(cursor: string): { timestamp: string; id: string } {
  // Utiliser atob pour décoder depuis base64 (compatible navigateur)
  const decoded = typeof atob !== 'undefined' ? atob(cursor) : Buffer.from(cursor, 'base64').toString('utf-8');
  const [timestamp, id] = decoded.split('|');
  return { timestamp, id };
}
