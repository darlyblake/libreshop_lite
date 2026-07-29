import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, StyleSheet as RNStyleSheet } from 'react-native';
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
  barcodeTypes = ["qr", "ean13", "ean8", "code128", "code39", "upc_a", "upc_e"],
  hintText = 'Placez le code-barres dans le cadre'
}) => {
  const themeContext = useTheme();
  const COLORS = themeContext.getColor;
  
  const [cameraReady, setCameraReady] = useState(false);
  const scanLock = useRef(false);

  useEffect(() => {
    if (visible) {
      scanLock.current = false;
      const timer = setTimeout(() => {
        setCameraReady(true);
      }, 400); // Délai pour garantir l'initialisation de l'autofocus matériel
      return () => {
        clearTimeout(timer);
        setCameraReady(false);
      };
    } else {
      setCameraReady(false);
      scanLock.current = false;
    }
  }, [visible]);

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanLock.current) return;
    scanLock.current = true; // Lock immédiatement pour éviter le multi-trigger
    
    // Ferme la caméra et retourne la donnée
    setTimeout(() => {
      onScan(data);
    }, 100);
  };

  const handleClose = () => {
    scanLock.current = false;
    setCameraReady(false);
    onClose();
  };

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
            barcodeScannerSettings={{
              barcodeTypes,
            }}
          />
        )}
        <View style={styles.cameraOverlay}>
          <View style={styles.cameraHeader}>
            <TouchableOpacity
              style={styles.closeCameraButton}
              onPress={handleClose}
            >
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
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  cameraHeader: {
    paddingTop: 50,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  closeCameraButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraTargetContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraTarget: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 16,
    borderStyle: 'dashed',
  },
  cameraFooter: {
    paddingBottom: 50,
    alignItems: 'center',
  },
  cameraHint: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
});
