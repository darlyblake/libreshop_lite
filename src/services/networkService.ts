import { Platform } from 'react-native';

type NetworkCallback = (isOnline: boolean) => void;

class NetworkService {
  private listeners: Set<NetworkCallback> = new Set();
  private onlineStatus: boolean = true;

  constructor() {
    this.init();
  }

  private init() {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      this.onlineStatus = navigator.onLine;

      window.addEventListener('online', () => {
        this.updateStatus(true);
      });

      window.addEventListener('offline', () => {
        this.updateStatus(false);
      });
    } else {
      // Fallback native initial status
      this.onlineStatus = true;
    }
  }

  private updateStatus(status: boolean) {
    this.onlineStatus = status;
    this.listeners.forEach(cb => cb(status));
  }

  public isOnline(): boolean {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    return this.onlineStatus;
  }

  public subscribe(callback: NetworkCallback): () => void {
    this.listeners.add(callback);
    // Notify immediately with current status
    callback(this.isOnline());

    return () => {
      this.listeners.delete(callback);
    };
  }
}

export const networkService = new NetworkService();
