import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  StyleSheet as RNStyleSheet,
  Platform,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView } from 'expo-camera';
import { useTheme } from '../hooks/useTheme';

interface BarcodeScannerModalProps {
  visible: boolean;
  onScan: (data: string) => void;
  onClose: () => void;
  barcodeTypes?: string[];
  hintText?: string;
}

// ── Composant Web : caméra + BarcodeDetector API ─────────────────────────────
const WebBarcodeScanner: React.FC<{
  visible: boolean;
  onScan: (data: string) => void;
  onClose: () => void;
  hintText: string;
  COLORS: any;
}> = ({ visible, onScan, onClose, hintText, COLORS }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const scanLock = useRef(false);
  const [manualInput, setManualInput] = useState('');
  const [cameraMode, setCameraMode] = useState<'loading' | 'active' | 'unsupported'>('loading');
  const inputRef = useRef<TextInput>(null);

  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!visible) {
      stopCamera();
      setManualInput('');
      scanLock.current = false;
      setCameraMode('loading');
      return;
    }

    // Vérifier support BarcodeDetector
    const hasBarcodeDetector = typeof (window as any).BarcodeDetector !== 'undefined';

    if (!hasBarcodeDetector) {
      setCameraMode('unsupported');
      setTimeout(() => inputRef.current?.focus(), 300);
      return;
    }

    // Démarrer la caméra
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setCameraMode('active');

          const detector = new (window as any).BarcodeDetector({
            formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'itf', 'codabar', 'aztec', 'pdf417', 'data_matrix'],
          });

          const scan = async () => {
            if (scanLock.current || !videoRef.current || videoRef.current.readyState < 2) {
              animFrameRef.current = requestAnimationFrame(scan);
              return;
            }
            try {
              const results = await detector.detect(videoRef.current);
              if (results && results.length > 0) {
                const code = results[0].rawValue;
                if (code && !scanLock.current) {
                  scanLock.current = true;
                  console.log('[BarcodeScannerModal Web] Code détecté:', code);
                  stopCamera();
                  setTimeout(() => onScan(code), 100);
                  return;
                }
              }
            } catch (_) {}
            animFrameRef.current = requestAnimationFrame(scan);
          };

          animFrameRef.current = requestAnimationFrame(scan);
        }
      } catch (err) {
        console.warn('[BarcodeScannerModal] Caméra inaccessible:', err);
        setCameraMode('unsupported');
        setTimeout(() => inputRef.current?.focus(), 300);
      }
    };

    startCamera();
    return () => stopCamera();
  }, [visible, onScan, stopCamera]);

  const handleManualSubmit = () => {
    const value = manualInput.trim();
    if (!value || scanLock.current) return;
    scanLock.current = true;
    stopCamera();
    setTimeout(() => onScan(value), 100);
  };

  const handleClose = () => {
    stopCamera();
    scanLock.current = false;
    setManualInput('');
    onClose();
  };

  if (!visible) return null;

  return (
    <div style={webDivStyles.overlay}>
      <div style={webDivStyles.container}>
        {/* Header */}
        <div style={webDivStyles.header}>
          <span style={webDivStyles.title}>📷 Scanner un code</span>
          <button onClick={handleClose} style={webDivStyles.closeBtn}>✕</button>
        </div>

        {/* Zone caméra */}
        {cameraMode !== 'unsupported' && (
          <div style={webDivStyles.videoWrapper}>
            <video
              ref={videoRef}
              style={webDivStyles.video}
              muted
              playsInline
              autoPlay
            />
            {/* Viseur */}
            <div style={webDivStyles.viewfinder} />
            <div style={webDivStyles.cameraHintBox}>
              <span style={webDivStyles.cameraHintText}>
                {cameraMode === 'loading' ? '⏳ Démarrage caméra...' : hintText}
              </span>
            </div>
          </div>
        )}

        {/* Séparateur */}
        <div style={webDivStyles.separator}>
          <div style={webDivStyles.separatorLine} />
          <span style={webDivStyles.separatorText}>
            {cameraMode === 'unsupported' ? 'Saisie manuelle' : 'ou saisir manuellement'}
          </span>
          <div style={webDivStyles.separatorLine} />
        </div>

        {cameraMode === 'unsupported' && (
          <p style={webDivStyles.unsupportedText}>
            ⚠️ Votre navigateur ne supporte pas le scan automatique.{'\n'}
            Utilisez votre douchette USB ou saisissez le code.
          </p>
        )}

        {/* Input manuel */}
        <input
          ref={inputRef as any}
          style={webDivStyles.input}
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleManualSubmit(); }}
          placeholder="Code-barres / EAN / QR..."
          autoFocus={cameraMode === 'unsupported'}
        />

        <button
          onClick={handleManualSubmit}
          style={{ ...webDivStyles.confirmBtn, backgroundColor: COLORS.accent || '#6366F1' }}
        >
          ✔ Confirmer
        </button>

        <button onClick={handleClose} style={webDivStyles.cancelBtn}>
          Annuler
        </button>
      </div>
    </div>
  );
};

const webDivStyles: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 },
  container: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', gap: 12 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#111' },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#555', padding: '4px 8px', borderRadius: 8, lineHeight: 1 },
  videoWrapper: { position: 'relative', width: '100%', borderRadius: 12, overflow: 'hidden', background: '#000', aspectRatio: '4/3' },
  video: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  viewfinder: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -60%)', width: 220, height: 140, border: '2.5px solid rgba(255,255,255,0.85)', borderRadius: 12, boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)' },
  cameraHintBox: { position: 'absolute', bottom: 12, left: 0, right: 0, display: 'flex', justifyContent: 'center' },
  cameraHintText: { backgroundColor: 'rgba(0,0,0,0.65)', color: '#fff', padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600 },
  separator: { display: 'flex', alignItems: 'center', gap: 8 },
  separatorLine: { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  separatorText: { fontSize: 12, color: '#999', whiteSpace: 'nowrap' },
  unsupportedText: { fontSize: 13, color: '#D97706', margin: 0, lineHeight: '1.5' },
  input: { border: '1.5px solid #ddd', borderRadius: 10, padding: '12px 14px', fontSize: 16, color: '#111', backgroundColor: '#f9f9f9', width: '100%', boxSizing: 'border-box', outline: 'none' },
  confirmBtn: { color: '#fff', fontWeight: '700', fontSize: 15, border: 'none', borderRadius: 10, padding: '13px', cursor: 'pointer', width: '100%' },
  cancelBtn: { background: 'none', border: 'none', color: '#888', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '6px', width: '100%' },
};

// ── Composant principal ──────────────────────────────────────────────────────
export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  visible,
  onScan,
  onClose,
  barcodeTypes = [
    'aztec', 'ean13', 'ean8', 'qr', 'pdf417',
    'upc_e', 'datamatrix', 'code39', 'code93',
    'itf14', 'codabar', 'code128', 'upc_a',
  ],
  hintText = 'Pointez vers le code-barres',
}) => {
  const themeContext = useTheme();
  const COLORS = themeContext.getColor;

  const [cameraReady, setCameraReady] = useState(false);
  const scanLock = useRef(false);

  useEffect(() => {
    if (visible && Platform.OS !== 'web') {
      scanLock.current = false;
      const timer = setTimeout(() => setCameraReady(true), 400);
      return () => {
        clearTimeout(timer);
        setCameraReady(false);
      };
    } else {
      setCameraReady(false);
      scanLock.current = false;
    }
  }, [visible]);

  const handleBarcodeScanned = (result: any) => {
    if (scanLock.current) return;
    scanLock.current = true;

    let scannedData = '';
    if (result && typeof result.data === 'string') {
      scannedData = result.data;
    } else if (result?.nativeEvent && typeof result.nativeEvent.data === 'string') {
      scannedData = result.nativeEvent.data;
    } else if (typeof result === 'string') {
      scannedData = result;
    }

    if (!scannedData) {
      scanLock.current = false;
      return;
    }

    console.log('[BarcodeScannerModal Natif] Code scanné:', scannedData);
    setTimeout(() => onScan(scannedData), 100);
  };

  const handleClose = () => {
    scanLock.current = false;
    setCameraReady(false);
    onClose();
  };

  // ── Web : composant React DOM direct (pas de Modal RN pour éviter conflits) ─
  if (Platform.OS === 'web') {
    return (
      <WebBarcodeScanner
        visible={visible}
        onScan={onScan}
        onClose={onClose}
        hintText={hintText}
        COLORS={COLORS}
      />
    );
  }

  // ── Native : CameraView expo ───────────────────────────────────────────────
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.cameraContainer}>
        {cameraReady && (
          <CameraView
            style={RNStyleSheet.absoluteFillObject}
            facing="back"
            autofocus="on"
            onBarcodeScanned={scanLock.current ? undefined : handleBarcodeScanned}
            barcodeScannerSettings={{ barcodeTypes: barcodeTypes as any }}
          />
        )}
        <View style={styles.cameraOverlay}>
          <View style={styles.cameraHeader}>
            <TouchableOpacity style={styles.closeCameraButton} onPress={handleClose}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.cameraTargetContainer}>
            <View style={styles.cameraTarget} />
          </View>
          <View style={styles.cameraFooter}>
            <Text style={styles.cameraHint}>
              {cameraReady ? hintText : 'Initialisation...'}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  cameraOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  cameraHeader: { paddingTop: 50, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'flex-end' },
  closeCameraButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  cameraTargetContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cameraTarget: { width: 250, height: 160, borderWidth: 2, borderColor: 'rgba(255,255,255,0.8)', borderRadius: 12, borderStyle: 'dashed' },
  cameraFooter: { paddingBottom: 50, alignItems: 'center' },
  cameraHint: { color: '#fff', fontSize: 16, fontWeight: '600', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
});
