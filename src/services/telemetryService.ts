import { supabase } from '../lib/supabase';
import { Platform } from 'react-native';
import * as Device from 'expo-device';

export interface CrashEvent {
  id: string;
  error: string;
  device: string;
  os: string;
  time: string;
  count: number;
}

export interface PageViewEvent {
  id: string;
  path: string;
  views: number;
  avgTime: string;
}

export interface DeviceDistribution {
  os: string;
  percentage: number;
  icon: string;
  color: string;
}

export interface TelemetrySummary {
  totalEvents: number;
  crashes: number;
  errors: number;
  pageViews: number;
  performanceIssues: number;
  eventsByType: { type: string; count: number }[];
  eventsByDay: { date: string; count: number }[];
}

export interface TelemetryData {
  crashes: CrashEvent[];
  pages: PageViewEvent[];
  devices: DeviceDistribution[];
}

export const telemetryService = {
  /**
   * Log a page view — échantillonnage à 20% pour éviter de saturer la table.
   * Seuls les crashes/erreurs sont toujours enregistrés.
   */
  async logPageView(path: string, durationMs?: number) {
    // Sampling : enregistre seulement 1 page view sur 5
    if (Math.random() > 0.2) return;
    if (!supabase) return;
    try {
      await supabase.from('telemetry_events').insert({
        event_type: 'page_view',
        path,
        session_time_ms: durationMs || 0,
        device_model: Device.modelName || 'Unknown',
        os_name: Platform.OS,
        os_version: Device.osVersion || 'Unknown',
      });
    } catch (error) {
      // Silent fail for telemetry
    }
  },

  /**
   * Log a crash or handled error
   */
  async logCrash(error: Error) {
    if (!supabase) return;
    try {
      await supabase.from('telemetry_events').insert({
        event_type: 'crash',
        error_message: error.message || error.toString(),
        device_model: Device.modelName || 'Unknown',
        os_name: Platform.OS,
        os_version: Device.osVersion || 'Unknown',
      });
    } catch (e) {
      // Silent fail
    }
  },

  /**
   * Appelle la RPC PostgreSQL get_telemetry_summary() et mappe le résultat
   * au format TelemetryData attendu par le dashboard.
   */
  async getAggregatedTelemetry(
    since?: Date,
    until: Date = new Date()
  ): Promise<TelemetryData> {
    try {
      if (!supabase) return this.getMockTelemetry();

      const sinceDate = since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const { data, error } = await supabase.rpc('get_telemetry_summary', {
        p_since: sinceDate.toISOString(),
        p_until: until.toISOString(),
      });

      if (error || !data) {
        console.warn('[Telemetry] RPC error, using mock data:', error);
        return this.getMockTelemetry();
      }

      const summary = data as TelemetrySummary;

      // --- Crashes : construire un CrashEvent générique depuis le compteur ---
      const crashes: CrashEvent[] = summary.crashes > 0 ? [{
        id: 'rpc-crash',
        error: `${summary.crashes} crash(es) enregistré(s)`,
        device: 'Voir Supabase',
        os: 'Mixte',
        time: 'Sur la période',
        count: summary.crashes,
      }] : [];

      // --- Pages : construire depuis eventsByDay (top pages non disponible sans table brute) ---
      const pages: PageViewEvent[] = summary.eventsByDay
        .slice(0, 5)
        .map((d, i) => ({
          id: `p${i}`,
          path: d.date,
          views: d.count,
          avgTime: 'N/A',
        }));

      // --- Devices : non fourni par la RPC, on affiche une distribution neutre ---
      const devices: DeviceDistribution[] = [
        { os: 'Android', percentage: 0, icon: 'logo-android', color: '#3DDC84' },
        { os: 'iOS', percentage: 0, icon: 'logo-apple', color: '#A2AAAD' },
        { os: 'Web', percentage: 0, icon: 'globe-outline', color: '#4285F4' },
      ];

      return { crashes, pages, devices };

    } catch (e) {
      console.warn('[Telemetry] Unexpected error, using mock data:', e);
      return this.getMockTelemetry();
    }
  },


  getMockTelemetry(): TelemetryData {
    return {
      crashes: [
        { id: 'c1', error: 'TypeError: null is not an object (evaluating \'store.id\')', device: 'iPhone 13', os: 'iOS 16', time: 'Il y a 15 min', count: 42 },
        { id: 'c2', error: 'Network request failed (timeout)', device: 'Galaxy S22', os: 'Android 13', time: 'Il y a 1 h', count: 28 },
        { id: 'c3', error: 'Uncaught Error: A listener indicated an asynchronous response', device: 'Chrome', os: 'Web', time: 'Il y a 2 h', count: 15 },
        { id: 'c4', error: 'Render Error: requireNativeComponent: "RNSScreen" was not found', device: 'Pixel 7', os: 'Android 14', time: 'Il y a 5 h', count: 8 },
      ],
      pages: [
        { id: 'p1', path: '/ClientHomeScreen', views: 85200, avgTime: '2m 15s' },
        { id: 'p2', path: '/ProductDetail', views: 54100, avgTime: '3m 45s' },
        { id: 'p3', path: '/ClientSearchScreen', views: 32500, avgTime: '1m 20s' },
        { id: 'p4', path: '/CartScreen', views: 18500, avgTime: '4m 10s' },
        { id: 'p5', path: '/SellerDashboardScreen', views: 8200, avgTime: '5m 30s' },
      ],
      devices: [
        { os: 'Android', percentage: 55, icon: 'logo-android', color: '#3DDC84' },
        { os: 'iOS', percentage: 35, icon: 'logo-apple', color: '#A2AAAD' },
        { os: 'Web', percentage: 10, icon: 'globe-outline', color: '#4285F4' },
      ]
    };
  }
};
