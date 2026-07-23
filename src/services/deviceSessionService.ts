/**
 * deviceSessionService.ts
 * Manages tracking of connected devices in the user_sessions table.
 * Each physical device gets a unique device_key stored in AsyncStorage.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const DEVICE_KEY_STORAGE = '@libreshop_device_key';

// ── Device detection helpers ──────────────────────────────────────────────────

function detectBrowser(ua: string): string {
  if (/Edg\//.test(ua)) return 'Microsoft Edge';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return 'Chrome';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return 'Safari';
  if (/Chromium\//.test(ua)) return 'Chromium';
  return 'Navigateur';
}

function detectOS(ua: string): string {
  if (/iPhone|iPod/.test(ua)) return 'iOS';
  if (/iPad/.test(ua)) return 'iPadOS';
  if (/Android/.test(ua)) return 'Android';
  if (/Windows NT/.test(ua)) return 'Windows';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/Linux/.test(ua)) return 'Linux';
  return 'OS inconnu';
}

function detectIcon(ua: string, platform: string): string {
  if (platform === 'ios') return 'phone-portrait-outline';
  if (platform === 'android') return 'phone-portrait-outline';
  if (/iPhone|iPod/.test(ua)) return 'phone-portrait-outline';
  if (/iPad/.test(ua)) return 'tablet-portrait-outline';
  if (/Android/.test(ua) && /Mobile/.test(ua)) return 'phone-portrait-outline';
  if (/Android/.test(ua)) return 'tablet-portrait-outline';
  return 'desktop-outline';
}

/** Generate (or retrieve) a stable unique key for this device */
async function getOrCreateDeviceKey(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(DEVICE_KEY_STORAGE);
    if (existing) return existing;
    // Generate a simple UUID-like key
    const key = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
    await AsyncStorage.setItem(DEVICE_KEY_STORAGE, key);
    return key;
  } catch {
    return `fallback-${Date.now()}`;
  }
}

/** Build device metadata from current environment */
function buildDeviceInfo(): { browser: string; os: string; device_name: string; device_icon: string } {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
    const ua = navigator.userAgent;
    const browser = detectBrowser(ua);
    const os = detectOS(ua);
    return {
      browser,
      os,
      device_name: `${browser} — ${os}`,
      device_icon: detectIcon(ua, 'web'),
    };
  }
  const os = Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : Platform.OS;
  return {
    browser: `App LibreShop`,
    os,
    device_name: `App LibreShop — ${os}`,
    device_icon: Platform.OS === 'ios' ? 'phone-portrait-outline' : 'phone-portrait-outline',
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface DeviceSession {
  id: string;
  user_id: string;
  device_key: string;
  device_name: string;
  browser: string;
  os: string;
  device_icon: string;
  created_at: string;
  last_seen: string;
}

export const deviceSessionService = {
  /**
   * Register (or refresh) the current device session after login.
   * Uses UPSERT so it's safe to call on every login.
   */
  async registerSession(userId: string): Promise<void> {
    try {
      const deviceKey = await getOrCreateDeviceKey();
      const info = buildDeviceInfo();

      await supabase!
        .from('user_sessions')
        .upsert(
          {
            user_id: userId,
            device_key: deviceKey,
            device_name: info.device_name,
            browser: info.browser,
            os: info.os,
            device_icon: info.device_icon,
            last_seen: new Date().toISOString(),
          },
          { onConflict: 'user_id,device_key' }
        );
    } catch (e) {
      console.warn('[deviceSessionService] registerSession error:', e);
    }
  },

  /** Get all sessions for a user (all connected devices) */
  async getSessions(userId: string): Promise<DeviceSession[]> {
    try {
      const { data, error } = await supabase!
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('last_seen', { ascending: false });

      if (error) throw error;
      return (data ?? []) as DeviceSession[];
    } catch (e) {
      console.warn('[deviceSessionService] getSessions error:', e);
      return [];
    }
  },

  /** Get the device_key for the current device */
  async getCurrentDeviceKey(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(DEVICE_KEY_STORAGE);
    } catch {
      return null;
    }
  },

  /** Revoke a specific device session by its ID */
  async revokeSession(sessionId: string): Promise<void> {
    await supabase!.from('user_sessions').delete().eq('id', sessionId);
  },

  /** Revoke ALL sessions for a user (sign out all devices) */
  async revokeAllSessions(userId: string): Promise<void> {
    await supabase!.from('user_sessions').delete().eq('user_id', userId);
  },

  /** Remove the current device session (called on local sign out) */
  async revokeCurrentSession(userId: string): Promise<void> {
    try {
      const deviceKey = await AsyncStorage.getItem(DEVICE_KEY_STORAGE);
      if (!deviceKey) return;
      await supabase!
        .from('user_sessions')
        .delete()
        .eq('user_id', userId)
        .eq('device_key', deviceKey);
    } catch (e) {
      console.warn('[deviceSessionService] revokeCurrentSession error:', e);
    }
  },
};
