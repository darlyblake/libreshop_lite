import { NativeModules, Platform } from 'react-native';

type ResultCallback = (text: string, isFinal?: boolean) => void;

const VoskNative = (NativeModules && (NativeModules as any).VoskBridge) || null;

let recognition: any = null;
let webCallback: ResultCallback | null = null;

export function isAvailable(): boolean {
  if (Platform.OS === 'web') {
    return !!(window && (window as any).SpeechRecognition) || !!(window && (window as any).webkitSpeechRecognition);
  }
  return !!VoskNative;
}

export async function init(modelPath?: string): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  if (!VoskNative) return Promise.reject(new Error('Vosk native bridge not installed'));
  return VoskNative.init(modelPath || '');
}

export function startListening(cb: ResultCallback, options?: { partialResults?: boolean }) {
  if (Platform.OS === 'web') {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) throw new Error('Web Speech API not available');
    webCallback = cb;
    recognition = new SpeechRecognition();
    recognition.lang = (navigator.language || 'en-US');
    recognition.interimResults = !!options?.partialResults;
    recognition.continuous = false;
    recognition.onresult = (ev: any) => {
      for (let i = ev.resultIndex; i < ev.results.length; ++i) {
        const r = ev.results[i];
        const txt = r[0].transcript;
        cb(txt, r.isFinal);
      }
    };
    recognition.onerror = (e: any) => {
      console.warn('SpeechRecognition error', e);
    };
    recognition.start();
    return;
  }

  if (!VoskNative) throw new Error('Vosk native bridge not installed');
  return VoskNative.start((err: any, text: string, isFinal: boolean) => {
    if (err) {
      console.warn('Vosk error', err);
      return;
    }
    cb(text, !!isFinal);
  });
}

export function stopListening() {
  if (Platform.OS === 'web') {
    if (recognition) {
      try { recognition.stop(); } catch (e) {}
      recognition = null;
      webCallback = null;
    }
    return;
  }
  if (VoskNative && VoskNative.stop) {
    VoskNative.stop();
  }
}

export default {
  isAvailable,
  init,
  startListening,
  stopListening,
};
