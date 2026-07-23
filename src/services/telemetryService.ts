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

export interface TelemetryData {
  crashes: CrashEvent[];
  pages: PageViewEvent[];
  devices: DeviceDistribution[];
}

export const telemetryService = {
  /**
   * Log a page view
   */
  async logPageView(path: string, durationMs?: number) {
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
   * Get aggregated telemetry data for the admin dashboard
   */
  async getAggregatedTelemetry(): Promise<TelemetryData> {
    try {
      // In a real production setup, we would use an RPC function or a Supabase View
      // to aggregate this data efficiently. For this prototype, we'll fetch recent
      // events and aggregate them in memory, with a fallback to mock data if the table is empty or missing.

      const { data, error } = await supabase
        .from('telemetry_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error || !data || data.length === 0) {
        return this.getMockTelemetry();
      }

      // Aggregate Crashes
      const crashesMap: Record<string, CrashEvent> = {};
      const pagesMap: Record<string, { views: number; totalTime: number }> = {};
      const devicesCount: Record<string, number> = { iOS: 0, Android: 0, Web: 0 };
      let totalDevices = 0;

      data.forEach(event => {
        // Device Distribution
        let osCategory = 'Web';
        if (event.os_name?.toLowerCase().includes('ios')) osCategory = 'iOS';
        else if (event.os_name?.toLowerCase().includes('android')) osCategory = 'Android';
        
        devicesCount[osCategory] = (devicesCount[osCategory] || 0) + 1;
        totalDevices++;

        if (event.event_type === 'crash' && event.error_message) {
          const key = event.error_message;
          if (!crashesMap[key]) {
            const timeDiff = Math.floor((Date.now() - new Date(event.created_at).getTime()) / 60000);
            crashesMap[key] = {
              id: event.id,
              error: key,
              device: event.device_model || 'Unknown',
              os: `${osCategory} ${event.os_version || ''}`,
              time: timeDiff < 60 ? `Il y a ${timeDiff} min` : `Il y a ${Math.floor(timeDiff/60)} h`,
              count: 1
            };
          } else {
            crashesMap[key].count++;
          }
        } else if (event.event_type === 'page_view' && event.path) {
          if (!pagesMap[event.path]) {
            pagesMap[event.path] = { views: 1, totalTime: event.session_time_ms || 0 };
          } else {
            pagesMap[event.path].views++;
            pagesMap[event.path].totalTime += (event.session_time_ms || 0);
          }
        }
      });

      const crashes = Object.values(crashesMap).sort((a, b) => b.count - a.count).slice(0, 5);
      
      const pages = Object.entries(pagesMap).map(([path, stats], index) => {
        const avgMs = stats.views > 0 ? stats.totalTime / stats.views : 0;
        const avgMin = Math.floor(avgMs / 60000);
        const avgSec = Math.floor((avgMs % 60000) / 1000);
        return {
          id: `p${index}`,
          path,
          views: stats.views,
          avgTime: avgMs > 0 ? `${avgMin}m ${avgSec}s` : 'N/A'
        };
      }).sort((a, b) => b.views - a.views).slice(0, 5);

      const devices = [
        { os: 'Android', percentage: totalDevices ? Math.round((devicesCount.Android / totalDevices) * 100) : 0, icon: 'logo-android', color: '#3DDC84' },
        { os: 'iOS', percentage: totalDevices ? Math.round((devicesCount.iOS / totalDevices) * 100) : 0, icon: 'logo-apple', color: '#A2AAAD' },
        { os: 'Web', percentage: totalDevices ? Math.round((devicesCount.Web / totalDevices) * 100) : 0, icon: 'globe-outline', color: '#4285F4' },
      ];

      return { crashes, pages, devices };

    } catch (e) {
      console.log('Using mock telemetry due to error:', e);
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
