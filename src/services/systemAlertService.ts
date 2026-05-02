import { useSupabase } from '../lib/supabase';

export interface SystemAlert {
  key: string;
  message: string;
  is_active: boolean;
  severity: 'info' | 'warning' | 'danger';
  last_occurred: string;
}

export const systemAlertService = {
  async getActiveAlerts(): Promise<SystemAlert[]> {
    const client = useSupabase();
    const { data, error } = await client
      .from('system_alerts')
      .select('*')
      .eq('is_active', true)
      .order('last_occurred', { ascending: false });
    
    if (error) {
      console.warn('[SystemAlertService] Failed to fetch alerts:', error);
      return [];
    }
    return data || [];
  },

  async reportAiFailure(): Promise<void> {
    const client = useSupabase();
    try {
      await client
        .from('system_alerts')
        .upsert({
          key: 'ai_tokens_exhausted',
          message: 'Les tokens IA (Grok/Gemini) sont épuisés. La recherche fonctionne en mode dégradé.',
          is_active: true,
          severity: 'danger',
          last_occurred: new Date().toISOString()
        });
    } catch (e) {
      console.warn('[SystemAlertService] Failed to report AI failure:', e);
    }
  },

  async resolveAlert(key: string): Promise<void> {
    const client = useSupabase();
    try {
      await client
        .from('system_alerts')
        .update({ is_active: false })
        .eq('key', key);
    } catch (e) {
      console.warn(`[SystemAlertService] Failed to resolve alert ${key}:`, e);
    }
  }
};
