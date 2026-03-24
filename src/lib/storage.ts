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
      errorHandler.handleDatabaseError(error, 'Error saving session:');
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
      errorHandler.handleDatabaseError(error, 'Error getting session:');
      return null;
    }
  },

  async clearSession(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.USER_SESSION);
      await AsyncStorage.removeItem(STORAGE_KEYS.USER_ROLE);
    } catch (error) {
      errorHandler.handleDatabaseError(error, 'Error clearing session:');
    }
  },

  async saveUserRole(role: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_ROLE, role);
    } catch (error) {
      errorHandler.handleDatabaseError(error, 'Error saving user role:');
    }
  },

  async getUserRole(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.USER_ROLE);
    } catch (error) {
      errorHandler.handleDatabaseError(error, 'Error getting user role:');
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
      errorHandler.handleDatabaseError(error, 'Error saving onboarding status:');
    }
  },

  async isOnboardingCompleted(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETED);
      return value ? JSON.parse(value) : false;
    } catch (error) {
      errorHandler.handleDatabaseError(error, 'Error getting onboarding status:');
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
      errorHandler.handleDatabaseError(error, 'Error saving store creation draft:');
    }
  },

  async get(userId: string): Promise<StoreCreationDraft | null> {
    try {
      const raw = await AsyncStorage.getItem(this.key(userId));
      return raw ? (JSON.parse(raw) as StoreCreationDraft) : null;
    } catch (error) {
      errorHandler.handleDatabaseError(error, 'Error getting store creation draft:');
      return null;
    }
  },

  async clear(userId: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.key(userId));
    } catch (error) {
      errorHandler.handleDatabaseError(error, 'Error clearing store creation draft:');
    }
  },
};

// Theme Storage
export const themeStorage = {
  async setThemeMode(mode: 'light' | 'dark' | 'system'): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.THEME_MODE, mode);
    } catch (error) {
      errorHandler.handleDatabaseError(error, 'Error saving theme mode:');
    }
  },

  async getThemeMode(): Promise<'light' | 'dark' | 'system'> {
    try {
      const mode = await AsyncStorage.getItem(STORAGE_KEYS.THEME_MODE);
      return (mode as 'light' | 'dark' | 'system') || 'dark';
    } catch (error) {
      errorHandler.handleDatabaseError(error, 'Error getting theme mode:');
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
      errorHandler.handle(`Error saving ${key}:`, error, 'UnknownContext');
    }
  },

  async getItem<T>(key: string): Promise<T | null> {
    try {
      const value = await AsyncStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      errorHandler.handle(`Error getting ${key}:`, error, 'UnknownContext');
      return null;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      errorHandler.handle(`Error removing ${key}:`, error, 'UnknownContext');
    }
  },

  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      errorHandler.handleDatabaseError(error, 'Error clearing storage:');
    }
  },
};

