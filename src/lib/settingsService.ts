import { supabase } from './supabase';

export interface AppSetting {
  key: string;
  value: any;
  updated_at?: string;
}

export const settingsService = {
  async getSettings(): Promise<Record<string, any>> {
    if (!supabase) return {};
    
    const { data, error } = await supabase
      .from('settings')
      .select('key, value');
    
    if (error) {
      // Settings table may not exist yet — silently return empty
      return {};
    }
    
    const settings: Record<string, any> = {};
    data.forEach((item: { key: string; value: any }) => {
      settings[item.key] = item.value;
    });
    
    return settings;
  },

  async getSetting(key: string, defaultValue: any): Promise<any> {
    if (!supabase) return defaultValue;
    
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    
    if (error) {
      // Settings table may not exist yet — silently use default
      return defaultValue;
    }
    
    return data ? data.value : defaultValue;
  },

  async updateSetting(key: string, value: any): Promise<void> {
    if (!supabase) return;
    
    const { error } = await supabase
      .from('settings')
      .upsert({ key, value, updated_at: new Date().toISOString() })
      .eq('key', key);
    
    if (error) {
      throw error;
    }
  }
};
