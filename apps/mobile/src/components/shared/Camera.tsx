import { useState, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, Image
} from 'react-native'
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../utils/theme'

interface CameraComponentProps {
  onCapture: (asset: any) => void
  onClose: () => void
  mode?: 'document' | 'bill' | 'general'
}

export default function CameraComponent({ onCapture, onClose, mode = 'document' }: CameraComponentProps) {
  const [permission, requestPermission] = useCameraPermissions()
  const [type, setType] = useState<CameraType>('back')
  const [capturedImage, setCapturedImage] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const cameraRef = useRef<any>(null)

  const getOverlayText = () => {
    switch (mode) {
      case 'document': return 'Position document within frame'
      case 'bill': return 'Align the total amount'
      default: return 'Take a clear photo'
    }
  }

  const handleCapture = async () => {
    if (!cameraRef.current) return
    setIsProcessing(true)
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 })
      setCapturedImage(photo)
    } catch (error) {
      Alert.alert('Error', 'Could not capture photo')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRetake = () => {
    setCapturedImage(null)
  }

  const handleUsePhoto = () => {
    if (capturedImage) {
      onCapture(capturedImage)
    }
  }

  const toggleCameraType = () => {
    setType(current => (current === 'back' ? 'front' : 'back'))
  }

  if (!permission) {
    return <View style={styles.container} />
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>We need camera access to scan documents</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (capturedImage) {
    return (
      <View style={styles.previewContainer}>
        <Image source={{ uri: capturedImage.uri }} style={styles.previewImage} />
        <View style={styles.previewActions}>
          <TouchableOpacity style={styles.previewButton} onPress={handleRetake}>
            <Ionicons name="refresh" size={24} color="#fff" />
            <Text style={styles.previewButtonText}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.previewButton, styles.useButton]} onPress={handleUsePhoto}>
            <Ionicons name="checkmark" size={24} color="#fff" />
            <Text style={styles.previewButtonText}>Use Photo</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing={type} ref={cameraRef}>
        <View style={styles.overlay}>
          <View style={styles.overlayTop}>
            <TouchableOpacity style={styles.closeButtonCircle} onPress={onClose}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.flipButton} onPress={toggleCameraType}>
              <Ionicons name="camera-reverse" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.overlayCenter}>
            <View style={styles.frameCornerTopLeft} />
            <View style={styles.frameCornerTopRight} />
            <View style={styles.frameCornerBottomLeft} />
            <View style={styles.frameCornerBottomRight} />
          </View>
          <View style={styles.overlayBottom}>
            <Text style={styles.overlayText}>{getOverlayText()}</Text>
            <TouchableOpacity
              style={styles.captureButton}
              onPress={handleCapture}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.captureButtonInner} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'transparent' },
  overlayTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 50
  },
  closeButtonCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  flipButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  overlayCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  frameCornerTopLeft: {
    position: 'absolute',
    top: '30%',
    left: '15%',
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#fff'
  },
  frameCornerTopRight: {
    position: 'absolute',
    top: '30%',
    right: '15%',
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#fff'
  },
  frameCornerBottomLeft: {
    position: 'absolute',
    bottom: '30%',
    left: '15%',
    width: 40,
    height: 40,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#fff'
  },
  frameCornerBottomRight: {
    position: 'absolute',
    bottom: '30%',
    right: '15%',
    width: 40,
    height: 40,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#fff'
  },
  overlayBottom: {
    alignItems: 'center',
    paddingBottom: 40
  },
  overlayText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff'
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff'
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff'
  },
  permissionText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 24,
    color: COLORS.text
  },
  permissionButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginBottom: 12
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  closeButton: { padding: 12 },
  closeButtonText: { color: COLORS.muted, fontSize: 16 },
  previewContainer: { flex: 1, backgroundColor: '#000' },
  previewImage: { flex: 1, resizeMode: 'contain' },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    backgroundColor: '#000'
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 30
  },
  useButton: { backgroundColor: COLORS.primary },
  previewButtonText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600'
  }
})