import React, { useState, useEffect, useRef } from 'react';
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

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  visible,
  onScan,
  onClose,
  barcodeTypes = [
    'aztec', 'ean13', 'ean8', 'qr', 'pdf417',
    'upc_e', 'datamatrix', 'code39', 'code93',
    'itf14', 'codabar', 'code128', 'upc_a',
  ],
  hintText = 'Placez le code-barres dans le cadre',
}) => {
  const themeContext = useTheme();
  const COLORS = themeContext.getColor;

  const [cameraReady, setCameraReady] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const scanLock = useRef(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      scanLock.current = false;
      setManualInput('');

      if (Platform.OS !== 'web') {
        const timer = setTimeout(() => setCameraReady(true), 400);
        return () => {
          clearTimeout(timer);
          setCameraReady(false);
        };
      } else {
        const timer = setTimeout(() => inputRef.current?.focus(), 300);
        return () => clearTimeout(timer);
      }
    } else {
      setCameraReady(false);
      scanLock.current = false;
      setManualInput('');
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
      console.warn('[BarcodeScannerModal] Impossible d\'extraire les données', result);
      scanLock.current = false;
      return;
    }

    console.log('[BarcodeScannerModal] Code scanné (natif):', scannedData);
    setTimeout(() => onScan(scannedData), 100);
  };

  const handleWebSubmit = () => {
    const value = manualInput.trim();
    if (!value || scanLock.current) return;
    scanLock.current = true;
    console.log('[BarcodeScannerModal] Code soumis (web):', value);
    setTimeout(() => onScan(value), 100);
  };

  const handleClose = () => {
    scanLock.current = false;
    setCameraReady(false);
    setManualInput('');
    onClose();
  };

  // ── VERSION WEB : saisie manuelle ou douchette USB ────────────────────────
  if (Platform.OS === 'web') {
    return (
      <Modal
        visible={visible}
        animationType="fade"
        transparent={true}
        onRequestClose={handleClose}
      >
        <View style={webStyles.overlay}>
          <View style={webStyles.container}>
            <View style={webStyles.header}>
              <Text style={webStyles.title}>📷 Scanner un code</Text>
              <TouchableOpacity onPress={handleClose} style={webStyles.closeBtn}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <Text style={webStyles.subtitle}>
              Utilisez votre douchette / scanner USB (appuyez sur Entrée après scan),{'\n'}
              ou saisissez le code manuellement.
            </Text>

            <TextInput
              ref={inputRef}
              style={webStyles.input}
              value={manualInput}
              onChangeText={setManualInput}
              placeholder="Code-barres / EAN / QR..."
              placeholderTextColor="#999"
              onSubmitEditing={handleWebSubmit}
              returnKeyType="done"
              autoFocus={true}
              selectTextOnFocus={true}
              blurOnSubmit={false}
            />

            <TouchableOpacity
              style={[webStyles.confirmBtn, { backgroundColor: COLORS.accent }]}
              onPress={handleWebSubmit}
            >
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={webStyles.confirmText}>Confirmer</Text>
            </TouchableOpacity>

            <TouchableOpacity style={webStyles.cancelBtn} onPress={handleClose}>
              <Text style={[webStyles.cancelText, { color: COLORS.textMuted }]}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // ── VERSION NATIVE : caméra avec scan automatique ─────────────────────────
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
  cameraTarget: { width: 250, height: 250, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', borderRadius: 16, borderStyle: 'dashed' },
  cameraFooter: { paddingBottom: 50, alignItems: 'center' },
  cameraHint: { color: '#fff', fontSize: 16, fontWeight: '600', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
});

const webStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  container: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '700', color: '#111' },
  closeBtn: { padding: 4 },
  subtitle: { fontSize: 13, color: '#666', marginBottom: 20, lineHeight: 20 },
  input: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#111', backgroundColor: '#f9f9f9', marginBottom: 16 },
  confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 10, marginBottom: 10 },
  confirmText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelBtn: { alignItems: 'center', paddingVertical: 8 },
  cancelText: { fontSize: 14, fontWeight: '600' },
});
