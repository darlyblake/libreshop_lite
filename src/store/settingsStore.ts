import { create } from 'zustand';
import { settingsService } from '../services/settingsService';
import { ADMIN_CONFIG } from '../config/admin';

interface SettingsState {
  adminConfig: {
    whatsappNumber: string;
    whatsappDisplay: string;
    email: string;
    phone: string;
  };
  isLoading: boolean;
  loadSettings: () => Promise<void>;
  updateAdminConfig: (config: Partial<SettingsState['adminConfig']>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  adminConfig: {
    whatsappNumber: ADMIN_CONFIG.WHATSAPP_NUMBER,
    whatsappDisplay: ADMIN_CONFIG.WHATSAPP_NUMBER_DISPLAY,
    email: ADMIN_CONFIG.EMAIL,
    phone: ADMIN_CONFIG.PHONE,
  },
  isLoading: false,

  loadSettings: async () => {
    set({ isLoading: true });
    try {
      const settings = await settingsService.getSettings();
      
      set((state) => ({
        adminConfig: {
          whatsappNumber: settings.whatsappNumber || state.adminConfig.whatsappNumber,
          whatsappDisplay: settings.whatsappDisplay || state.adminConfig.whatsappDisplay,
          email: settings.adminEmail || state.adminConfig.email,
          phone: settings.adminPhone || state.adminConfig.phone,
        },
        isLoading: false,
      }));
    } catch (error) {
      console.error('Error loading settings from store:', error);
      set({ isLoading: false });
    }
  },

  updateAdminConfig: async (config) => {
    try {
      // Update local state first (optimistic)
      set((state) => ({
        adminConfig: { ...state.adminConfig, ...config },
      }));

      // Persist to database
      const promises = Object.entries(config).map(([key, value]) => {
        // Map store keys to database keys if different
        let dbKey = key;
        if (key === 'email') dbKey = 'adminEmail';
        if (key === 'phone') dbKey = 'adminPhone';
        
        return settingsService.updateSetting(dbKey, value);
      });

      await Promise.all(promises);
    } catch (error) {
      console.error('Error updating admin config:', error);
      // Optional: reload from server on error
      await get().loadSettings();
      throw error;
    }
  },
}));
