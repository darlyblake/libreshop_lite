import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  USER_SESSION: '@libreshop_user_session',
  USER_ROLE: '@libreshop_user_role',
  ONBOARDING_COMPLETED: '@libreshop_onboarding_completed',
  THEME_MODE: '@libreshop_theme_mode',
  STORE_CREATION_DRAFT_PREFIX: '@libreshop_store_creation_draft:',
};

// Session Storage
export const sessionStorage = {
  async saveSession(userId: string, email: string): Promise<void> {
    try {
      const session = { userId, email, timestamp: Date.now() };
      await AsyncStorage.setItem(STORAGE_KEYS.USER_SESSION, JSON.stringify(session));
    } catch (error) {
      console.error('Error saving session:', error);
    }
  },

  async getSession(): Promise<{ userId: string; email: string; timestamp: number } | null> {
    try {
      const sessionJson = await AsyncStorage.getItem(STORAGE_KEYS.USER_SESSION);
      if (sessionJson) {
        return JSON.parse(sessionJson);
      }
      return null;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  },

  async clearSession(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.USER_SESSION);
      await AsyncStorage.removeItem(STORAGE_KEYS.USER_ROLE);
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  },

  async saveUserRole(role: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_ROLE, role);
    } catch (error) {
      console.error('Error saving user role:', error);
    }
  },

  async getUserRole(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.USER_ROLE);
    } catch (error) {
      console.error('Error getting user role:', error);
      return null;
    }
  },
};

// Onboarding Storage
export const onboardingStorage = {
  async setOnboardingCompleted(completed: boolean = true): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, JSON.stringify(completed));
    } catch (error) {
      console.error('Error saving onboarding status:', error);
    }
  },

  async isOnboardingCompleted(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETED);
      return value ? JSON.parse(value) : false;
    } catch (error) {
      console.error('Error getting onboarding status:', error);
      return false;
    }
  },
};

// Store creation draft (resume seller onboarding)
export interface StoreCreationDraft {
  currentStep: number;
  formData: any;
  logoUri: string | null;
  bannerUri: string | null;
  selectedSubcategory: string;
  updatedAt: number;
}

export const storeCreationDraftStorage = {
  key(userId: string) {
    return `${STORAGE_KEYS.STORE_CREATION_DRAFT_PREFIX}${userId}`;
  },

  async save(userId: string, draft: Omit<StoreCreationDraft, 'updatedAt'>): Promise<void> {
    try {
      const value: StoreCreationDraft = { ...draft, updatedAt: Date.now() };
      await AsyncStorage.setItem(this.key(userId), JSON.stringify(value));
    } catch (error) {
      console.error('Error saving store creation draft:', error);
    }
  },

  async get(userId: string): Promise<StoreCreationDraft | null> {
    try {
      const raw = await AsyncStorage.getItem(this.key(userId));
      return raw ? (JSON.parse(raw) as StoreCreationDraft) : null;
    } catch (error) {
      console.error('Error getting store creation draft:', error);
      return null;
    }
  },

  async clear(userId: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.key(userId));
    } catch (error) {
      console.error('Error clearing store creation draft:', error);
    }
  },
};

// Theme Storage
export const themeStorage = {
  async setThemeMode(mode: 'light' | 'dark' | 'system'): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.THEME_MODE, mode);
    } catch (error) {
      console.error('Error saving theme mode:', error);
    }
  },

  async getThemeMode(): Promise<'light' | 'dark' | 'system'> {
    try {
      const mode = await AsyncStorage.getItem(STORAGE_KEYS.THEME_MODE);
      return (mode as 'light' | 'dark' | 'system') || 'dark';
    } catch (error) {
      console.error('Error getting theme mode:', error);
      return 'dark';
    }
  },
};

// Generic Storage Helpers
export const genericStorage = {
  async setItem(key: string, value: any): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error saving ${key}:`, error);
    }
  },

  async getItem<T>(key: string): Promise<T | null> {
    try {
      const value = await AsyncStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`Error getting ${key}:`, error);
      return null;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing ${key}:`, error);
    }
  },

  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  },
};

