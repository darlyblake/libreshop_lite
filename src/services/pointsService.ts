import { supabase } from '../lib/supabase';
import { errorHandler } from '../utils/errorHandler';

/**
 * Taux de conversion: 1 point XP = 1 FCFA
 * Utilisé pour le paiement d'abonnements avec les points.
 */
export const XP_TO_FCFA = 1;

/** Convertit un montant en FCFA vers le nombre de XP nécessaires */
export const fcfaToXP = (fcfa: number): number => Math.ceil(fcfa / XP_TO_FCFA);

/** Convertit un nombre de XP en valeur FCFA */
export const xpToFCFA = (xp: number): number => Math.floor(xp * XP_TO_FCFA);

export interface PointTransaction {
  id: string;
  user_id: string;
  amount: number;
  action_type: string;
  reference_id?: string;
  created_at: string;
}

export interface PointSettings {
  action_type: string;
  points_reward: number;
  description: string;
}

export const pointsService = {
  /**
   * Récupère le solde de points et le code de parrainage de l'utilisateur
   */
  async getUserPointsInfo(userId: string) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('points, referral_code, referred_by')
        .eq('id', userId)
        .maybeSingle();
        
      if (error) throw error;
      return data || { points: 0, referral_code: null, referred_by: null };
    } catch (error) {
      console.error('Erreur getUserPointsInfo:', error);
      return { points: 0, referral_code: null, referred_by: null };
    }
  },

  /**
   * Récupère l'historique des transactions de points
   */
  async getPointsHistory(userId: string): Promise<PointTransaction[]> {
    try {
      const { data, error } = await supabase
        .from('point_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erreur getPointsHistory:', error);
      return [];
    }
  },

  /**
   * Récupère les cotas de points définis par l'admin
   */
  async getPointSettings(): Promise<Record<string, number>> {
    try {
      const { data, error } = await supabase
        .from('point_settings')
        .select('*');
        
      if (error) throw error;
      
      const settingsMap: Record<string, number> = {};
      data?.forEach(item => {
        settingsMap[item.action_type] = item.points_reward;
      });
      return settingsMap;
    } catch (error) {
      console.error('Erreur getPointSettings:', error);
      return {};
    }
  },

  /**
   * Met à jour les cotas de points définis par l'admin
   */
  async updatePointSettings(settings: Record<string, number>) {
    try {
      const updates = Object.keys(settings).map(key => ({
        action_type: key,
        points_reward: settings[key]
      }));

      const { error } = await supabase
        .from('point_settings')
        .upsert(updates, { onConflict: 'action_type' });
        
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Erreur updatePointSettings:', error);
      throw error;
    }
  },

  /**
   * Définit le code de parrainage de l'utilisateur
   */
  async setReferralCode(userId: string, code: string) {
    try {
      const { error } = await supabase
        .from('users')
        .update({ referral_code: code })
        .eq('id', userId);
        
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Erreur setReferralCode:', error);
      throw error;
    }
  },
  
  /**
   * Vérifie et applique un code de parrainage venant d'un autre utilisateur
   * (Doit être fait au moment de l'inscription ou création boutique)
   */
  async applyReferralCode(userId: string, codeToApply: string) {
    try {
      // 1. Chercher le parrain
      const { data: inviter, error: inviterError } = await supabase
        .from('users')
        .select('id')
        .eq('referral_code', codeToApply)
        .maybeSingle();

      if (inviterError || !inviter) {
        throw new Error("Code de parrainage invalide ou introuvable.");
      }

      // 2. Vérifier que l'utilisateur ne se parraine pas lui-même
      if (inviter.id === userId) {
        throw new Error("Vous ne pouvez pas utiliser votre propre code de parrainage.");
      }

      // 3. Mettre à jour l'utilisateur avec son parrain
      const { error: updateError } = await supabase
        .from('users')
        .update({ referred_by: inviter.id })
        .eq('id', userId);

      if (updateError) throw updateError;

      return inviter.id;
    } catch (error) {
      console.error('Erreur applyReferralCode:', error);
      throw error;
    }
  },

  /**
   * Ajoute des points à un utilisateur (réservé aux admins)
   * Utilise un RPC sécurisé côté serveur pour vérifier les permissions
   */
  async addPointsByAdmin(userId: string, amount: number, reason: string) {
    try {
      // Vérifier que le montant est valide
      if (amount <= 0) {
        throw new Error("Le montant doit être positif");
      }

      if (!reason || reason.trim().length === 0) {
        throw new Error("Une raison est obligatoire");
      }

      // Appeler le RPC sécurisé côté serveur
      const { data, error } = await supabase.rpc('admin_add_points', {
        p_target_user_id: userId,
        p_amount: amount,
        p_reason: reason.trim()
      });

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Erreur addPointsByAdmin:', error);
      throw error;
    }
  }
};
