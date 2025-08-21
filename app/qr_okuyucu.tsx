// app/qr_okuyucu.tsx - Numune sistemi için güncellendi
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator,
  StatusBar,
  Platform,
  Dimensions,
  Modal
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import api from '../utils/enterpriseApi';

const { width, height } = Dimensions.get('window');
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

interface NumuneData {
  id: number;
  qr_kod: string;
  firma_adi: string;
  alinan_yer: string;
  numune_giris: number;
  numune_cikis: number;
  numune_alis_tarihi: string;
  lab_giris_tarihi?: string;
  alan_kisi: string;
  durum: string;
  rapor_no?: string;
  rapor_durum?: string;
  company_name?: string;
}

export default function QrOkuyucu() {
  const router = useRouter();
  const { show_details } = useLocalSearchParams();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [numune, setNumune] = useState<NumuneData | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  useEffect(() => {
    // Eğer show_details parametresi varsa, direkt o QR kodu sorgula
    if (show_details && typeof show_details === 'string') {
      searchNumune(show_details);
      setScanning(false);
    }
  }, [show_details]);

  useEffect(() => {
    // Kamera izni kontrolü
    if (!permission?.granted) {
      requestPermission();
    }
  }, []);

  const searchNumune = async (qr_kod: string) => {
    try {
      setProcessing(true);
      console.log('🔍 Numune sorgulanıyor:', qr_kod);
      
      const response = await api.get(`/api/numune-sorgula/${qr_kod}`);
      
      if (response.data) {
        setNumune(response.data);
        setDetailModalVisible(true);
        console.log('✅ Numune bulundu:', response.data);
      } else {
        Alert.alert('Bulunamadı', 'Bu QR koda ait numune bulunamadı');
      }
    } catch (error) {
      console.error('❌ Numune sorgulama hatası:', error);
      Alert.alert(
        'Hata',
        error.response?.data?.error || 'Numune bilgileri alınamadı'
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (processing) return;
    
    setScanning(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    await searchNumune(data);
  };

  const getDurumColor = (durum: string, rapor_durum?: string) => {
    if (rapor_durum === 'onaylandi') {
      return '#10B981'; // Yeşil - Rapor onaylandı
    } else if (rapor_durum === 'onay_bekliyor') {
      return '#F59E0B'; // Sarı - Rapor onay bekliyor
    } else if (rapor_durum === 'reddedildi') {
      return '#EF4444'; // Kırmızı - Rapor reddedildi
    } else if (durum === 'testler_tamamlandi' || durum === 'rapor_hazirlandi') {
      return '#3B82F6'; // Mavi - Testler tamamlandı
    } else if (durum === 'lab_girisi') {
      return '#8B5CF6'; // Mor - Lab'da
    } else if (durum === 'numune_alindi') {
      return '#F97316'; // Turuncu - Numune alındı
    }
    return '#6B7280'; // Gri - Bilinmeyen durum
  };

  const getDurumText = (durum: string, rapor_durum?: string) => {
    if (rapor_durum === 'onaylandi') {
      return 'Rapor Onaylandı';
    } else if (rapor_durum === 'onay_bekliyor') {
      return 'Rapor Onay Bekliyor';
    } else if (rapor_durum === 'reddedildi') {
      return 'Rapor Reddedildi';
    } else if (durum === 'rapor_hazirlandi') {
      return 'Rapor Hazırlandı';
    } else if (durum === 'testler_tamamlandi') {
      return 'Testler Tamamlandı';
    } else if (durum === 'lab_girisi') {
      return 'Lab\'da İşlemde';
    } else if (durum === 'numune_alindi') {
      return 'Numune Alındı';
    }
    return 'Bilinmeyen Durum';
  };

  const toggleScanning = () => {
    if (!permission?.granted) {
      Alert.alert('Kamera İzni', 'QR kod taramak için kamera izni gerekli');
      requestPermission();
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setScanning(!scanning);
    setNumune(null);
    setDetailModalVisible(false);
  };

  const handleViewReport = () => {
    if (numune?.rapor_durum === 'onaylandi' && numune?.rapor_no) {
      setDetailModalVisible(false);
      router.push({
        pathname: '/rapor-detay',
        params: { 
          qr_kod: numune.qr_kod,
          rapor_no: numune.rapor_no 
        }
      });
    } else {
      Alert.alert('Bilgi', 'Bu numune için henüz onaylanmış rapor bulunmuyor');
    }
  };

  const handleGoToHistory = () => {
    setDetailModalVisible(false);
    router.push('/numune-gecmis');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1E3A8A" translucent />
      
      <LinearGradient colors={['#1E3A8A', '#2563EB']} style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Numune Sorgula</Text>
        <TouchableOpacity 
          style={styles.historyButton}
          onPress={handleGoToHistory}
        >
          <Ionicons name="time-outline" size={24} color="white" />
        </TouchableOpacity>
      </LinearGradient>

      {!scanning ? (
        <View style={styles.content}>
          <View style={styles.instructionCard}>
            <MaterialCommunityIcons name="qr-code-scan" size={80} color="#1E3A8A" />
            <Text style={styles.instructionTitle}>Numune QR Kodunu Tarayın</Text>
            <Text style={styles.instructionText}>
              Numune etiketindeki QR kodu tarayarak durumunu sorgulayın
            </Text>
          </View>

          {numune && (
            <View style={styles.lastScannedCard}>
              <Text style={styles.lastScannedTitle}>Son Taranan Numune</Text>
              <View style={styles.numuneInfo}>
                <View style={styles.numuneHeader}>
                  <Text style={styles.qrCode}>{numune.qr_kod}</Text>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: getDurumColor(numune.durum, numune.rapor_durum) }
                  ]}>
                    <Text style={styles.statusText}>
                      {getDurumText(numune.durum, numune.rapor_durum)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.firmaName}>
                  {numune.firma_adi || numune.company_name}
                </Text>
                <Text style={styles.numuneDate}>
                  {new Date(numune.numune_alis_tarihi).toLocaleDateString('tr-TR')}
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity 
            style={styles.scanButton}
            onPress={toggleScanning}
            disabled={processing}
          >
            <Ionicons name="qr-code-outline" size={24} color="white" />
            <Text style={styles.scanButtonText}>
              {processing ? 'İşleniyor...' : 'QR Kod Tara'}
            </Text>
            {processing && <ActivityIndicator color="white" style={{ marginLeft: 10 }} />}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            onBarcodeScanned={handleBarcodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ["qr", "pdf417"],
            }}
          />
          
          <View style={styles.overlay}>
            <View style={styles.scanFrame} />
            <Text style={styles.scanInstruction}>
              QR kodu çerçeve içine yerleştirin
            </Text>
          </View>

          <TouchableOpacity 
            style={styles.closeCameraButton}
            onPress={toggleScanning}
          >
            <Ionicons name="close" size={24} color="white" />
            <Text style={styles.closeCameraText}>Kapat</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Numune Detay Modal */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {numune && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Numune Detayı</Text>
                  <TouchableOpacity 
                    style={styles.closeModalButton}
                    onPress={() => setDetailModalVisible(false)}
                  >
                    <Ionicons name="close" size={24} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalBody}>
                  {/* QR Kod ve Durum */}
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>QR Kod:</Text>
                    <Text style={styles.modalValue}>{numune.qr_kod}</Text>
                  </View>

                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Durum:</Text>
                    <View style={[
                      styles.modalStatusBadge,
                      { backgroundColor: getDurumColor(numune.durum, numune.rapor_durum) }
                    ]}>
                      <Text style={styles.modalStatusText}>
                        {getDurumText(numune.durum, numune.rapor_durum)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Firma:</Text>
                    <Text style={styles.modalValue}>
                      {numune.firma_adi || numune.company_name}
                    </Text>
                  </View>

                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Alınan Yer:</Text>
                    <Text style={styles.modalValue}>{numune.alinan_yer}</Text>
                  </View>

                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Alınma Tarihi:</Text>
                    <Text style={styles.modalValue}>
                      {new Date(numune.numune_alis_tarihi).toLocaleDateString('tr-TR')}
                    </Text>
                  </View>

                  {numune.lab_giris_tarihi && (
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>Lab Giriş:</Text>
                      <Text style={styles.modalValue}>
                        {new Date(numune.lab_giris_tarihi).toLocaleDateString('tr-TR')}
                      </Text>
                    </View>
                  )}

                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Alan Kişi:</Text>
                    <Text style={styles.modalValue}>{numune.alan_kisi}</Text>
                  </View>

                  {/* Numune Değerleri */}
                  <View style={styles.valuesContainer}>
                    <View style={styles.valueItem}>
                      <Text style={styles.valueNumber}>{numune.numune_giris}</Text>
                      <Text style={styles.valueLabel}>Giriş (L)</Text>
                    </View>
                    <View style={styles.valueItem}>
                      <Text style={styles.valueNumber}>{numune.numune_cikis}</Text>
                      <Text style={styles.valueLabel}>Çıkış (L)</Text>
                    </View>
                  </View>

                  {numune.rapor_no && (
                    <View style={styles.reportSection}>
                      <Text style={styles.reportTitle}>Rapor Bilgisi</Text>
                      <Text style={styles.reportNumber}>Rapor No: {numune.rapor_no}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.modalFooter}>
                  {numune.rapor_durum === 'onaylandi' && (
                    <TouchableOpacity 
                      style={styles.reportButton}
                      onPress={handleViewReport}
                    >
                      <Ionicons name="document-text" size={20} color="white" />
                      <Text style={styles.reportButtonText}>Raporu Görüntüle</Text>
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity 
                    style={styles.historyActionButton}
                    onPress={handleGoToHistory}
                  >
                    <Ionicons name="time" size={20} color="#1E3A8A" />
                    <Text style={styles.historyActionButtonText}>Tüm Numuneler</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  header: {
    paddingTop: STATUSBAR_HEIGHT + 15,
    paddingBottom: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  instructionCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  instructionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1E3A8A',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  instructionText: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
  },
  lastScannedCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  lastScannedTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E3A8A',
    marginBottom: 12,
  },
  numuneInfo: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
  },
  numuneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  qrCode: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E3A8A',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  firmaName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
  },
  numuneDate: {
    fontSize: 14,
    color: '#64748B',
  },
  scanButton: {
    backgroundColor: '#1E3A8A',
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 18,
    marginTop: 'auto',
  },
  scanButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: 'white',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  scanInstruction: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  closeCameraButton: {
    position: 'absolute',
    top: STATUSBAR_HEIGHT + 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeCameraText: {
    color: 'white',
    marginLeft: 5,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    width: width * 0.9,
    maxHeight: height * 0.8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E3A8A',
  },
  closeModalButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  modalLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
    flex: 1,
  },
  modalValue: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
    flex: 2,
    textAlign: 'right',
  },
  modalStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  modalStatusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  valuesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  valueItem: {
    alignItems: 'center',
  },
  valueNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E3A8A',
  },
  valueLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  reportSection: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0369A1',
    marginBottom: 4,
  },
  reportNumber: {
    fontSize: 14,
    color: '#0369A1',
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 12,
  },
  reportButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  reportButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  historyActionButton: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1E3A8A',
  },
  historyActionButtonText: {
    color: '#1E3A8A',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
});