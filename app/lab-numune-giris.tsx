// app/lab-numune-giris.tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator,
  StatusBar,
  Platform,
  Dimensions 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import api from '../utils/enterpriseApi';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  alan_kisi: string;
  durum: string;
}

export default function LabNumuneGiris() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [numune, setNumune] = useState<NumuneData | null>(null);
  const [isHandling, setIsHandling] = useState(false);

  const isProcessingRef = useRef(false);

  useEffect(() => {
    // Kamera izni kontrolü
    if (!permission?.granted) {
      requestPermission();
    }
  }, []);

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    // ✅ Ref ile senkron kontrol
    if (isProcessingRef.current || processing || isHandling || scannedData === data || !scanning) {
      console.log('🚫 QR tarama engellendi:', { 
        isProcessingRef: isProcessingRef.current, 
        processing, 
        isHandling, 
        scannedData, 
        scanning 
      });
      return;
    }
    
    // ✅ Hemen ref'i true yap
    isProcessingRef.current = true;
    
    console.log('✅ QR tarama kabul edildi:', data);
    
    // ✅ State güncellemeleri
    setIsHandling(true);
    setProcessing(true);
    setScanning(false);
    setScannedData(data);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      console.log('🔍 QR Kod tarandı:', data);
      
      const numuneResponse = await api.get(`/api/numune-sorgula/${data}`);
      
      if (numuneResponse.data) {
        const numuneData = numuneResponse.data;
        
        console.log('📊 Numune verisi:', {
          qr_kod: numuneData.qr_kod,
          firma_adi: numuneData.firma_adi,
          alinan_yer: numuneData.alinan_yer,
          durum: numuneData.durum,
          company_id: numuneData.company_id
        });
        
        // ✅ DÜZELTME: Zaten lab'da olan numune kontrolü
        if (numuneData.durum === 'lab_girisi') {
          Alert.alert(
            'Bilgi', 
            `Bu numune zaten lab'da mevcut.\n\nFirma: ${numuneData.firma_adi}\nYer: ${numuneData.alinan_yer}\nGiriş: ${numuneData.numune_giris}L\nÇıkış: ${numuneData.numune_cikis}L`,
            [{ 
              text: 'Tamam', 
              onPress: () => {
                isProcessingRef.current = false;
                setProcessing(false);
                setIsHandling(false);
                setScannedData(null);
                setScanning(true);
              }
            }]
          );
          return;
        }
        
        // ✅ DÜZELTME: Uygun olmayan durum kontrolü
        if (numuneData.durum !== 'numune_alindi' && numuneData.durum !== 'manuel_eklenen') {
          Alert.alert(
            'Numune Durumu', 
            `Bu numune lab'a giriş için uygun değil.\n\nMevcut durum: ${numuneData.durum}\nFirma: ${numuneData.firma_adi}\nYer: ${numuneData.alinan_yer}\n\nSadece "numune_alindi" veya "manuel_eklenen" durumundaki numuneler lab'a giriş yapabilir.`,
            [{ 
              text: 'Tamam',
              onPress: () => {
                isProcessingRef.current = false;
                setProcessing(false);
                setIsHandling(false);
                setScannedData(null);
                setScanning(true);
              }
            }]
          );
          return;
        }
        
        setNumune(numuneData);
        
        // ✅ DÜZELTME: Daha detaylı onay mesajı
        Alert.alert(
          'Numune Bulundu!',
          `Firma: ${numuneData.firma_adi}\nYer: ${numuneData.alinan_yer}\nGiriş: ${numuneData.numune_giris || 'Belirtilmemiş'}L\nÇıkış: ${numuneData.numune_cikis || 'Belirtilmemiş'}L\nAlan Kişi: ${numuneData.alan_kisi || 'Belirtilmemiş'}\n\nBu numune lab'a giriş yapılsın mı?`,
          [
            {
              text: 'İptal',
              style: 'cancel',
              onPress: () => {
                isProcessingRef.current = false;
                setProcessing(false);
                setIsHandling(false);
                setScannedData(null);
                setScanning(true);
              }
            },
            {
              text: 'Lab\'a Gir',
              style: 'default',
              onPress: () => labGirisiYap(data)
            }
          ]
        );
      }
     } catch (error) {
      console.error('❌ QR kod işleme hatası:', error);
      
      // ✅ DÜZELTME: Hata türüne göre farklı mesajlar
      let errorTitle = 'Hata';
      let errorMessage = 'Numune bilgileri alınamadı';
      
      if (error.response?.status === 404) {
        errorTitle = 'Numune Bulunamadı';
        errorMessage = 'Bu QR kod sistemde bulunamadı.\n\nLütfen önce barkod ekranından numune alım işlemini tamamlayın.';
      } else if (error.response?.status === 403) {
        errorTitle = 'Yetki Hatası';
        errorMessage = 'Bu işlem için yetkiniz bulunmamaktadır.';
      } else if (error.response?.status === 500) {
        errorTitle = 'Sunucu Hatası';
        errorMessage = 'Sunucu hatası oluştu. Lütfen daha sonra tekrar deneyin.';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // ✅ DÜZELTME: Network hatası kontrolü
      if (error.code === 'NETWORK_ERROR' || !error.response) {
        errorTitle = 'Bağlantı Hatası';
        errorMessage = 'İnternet bağlantınızı kontrol edin ve tekrar deneyin.';
      }
      
      Alert.alert(
        errorTitle,
        errorMessage,
        [{ 
          text: 'Tamam',
          onPress: () => {
            isProcessingRef.current = false;
            setProcessing(false);
            setIsHandling(false);
            setScannedData(null);
            setScanning(true);
          }
        }]
      );
     }
  };

  const labGirisiYap = async (qr_kod: string) => {
    try {
      console.log('🔬 Lab girişi başlatılıyor:', qr_kod);
      
      const response = await api.post('/api/lab-giris', {
        qr_kod: qr_kod
      });
      
      if (response.data) {
        Alert.alert(
          'Başarılı!',
          'Numune lab\'a başarıyla teslim edildi. Test sürecine başlanabilir.',
          [
            {
              text: 'Rapor Oluştur',
              onPress: () => {
                setProcessing(false);
                setIsHandling(false); // ✅ Bu satırı ekle
                setScannedData(null);
                router.push({
                  pathname: '/lab-rapor-olustur',
                  params: { qr_kod: qr_kod }
                });
              }
            },
            {
              text: 'Ana Sayfa',
              onPress: () => {
                setProcessing(false);
                setIsHandling(false); // ✅ Bu satırı ekle
                setScannedData(null);
                router.back();
              }
            }
          ]
        );
        
        if (numune) {
          setNumune({
            ...numune,
            durum: 'lab_girisi'
          });
        }
      }
    } catch (error) {
      console.error('❌ Lab giriş hatası:', error);
      Alert.alert(
        'Hata',
        error.response?.data?.error || 'Lab girişi yapılamadı',
        [{ 
          text: 'Tamam',
          onPress: () => {
            setProcessing(false);
            setIsHandling(false); // ✅ Bu satırı ekle
            setScannedData(null);
            setScanning(true);
          }
        }]
      );
    }
  };

  const toggleScanning = () => {
    if (!permission?.granted) {
      Alert.alert('Kamera İzni', 'QR kod taramak için kamera izni gerekli');
      requestPermission();
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setScanning(!scanning);
    setScannedData(null);
    setIsHandling(false); // ✅ Bu satırı ekle
    setNumune(null);
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
        <Text style={styles.headerTitle}>Lab Numune Girişi</Text>
      </LinearGradient>

      {!scanning ? (
        <View style={styles.content}>
          <View style={styles.instructionCard}>
            <MaterialCommunityIcons name="flask-outline" size={80} color="#1E3A8A" />
            <Text style={styles.instructionTitle}>Numune QR Kodunu Tarayın</Text>
            <Text style={styles.instructionText}>
              Sahadan alınan numune etiketindeki QR kodu tarayarak lab girişi yapın
            </Text>
          </View>

          {numune && (
            <View style={styles.numuneCard}>
              <Text style={styles.numuneTitle}>Son Taranan Numune</Text>
              <View style={styles.numuneRow}>
                <Text style={styles.numuneLabel}>QR Kod:</Text>
                <Text style={styles.numuneValue}>{numune.qr_kod}</Text>
              </View>
              <View style={styles.numuneRow}>
                <Text style={styles.numuneLabel}>Firma:</Text>
                <Text style={styles.numuneValue}>{numune.firma_adi}</Text>
              </View>
              <View style={styles.numuneRow}>
                <Text style={styles.numuneLabel}>Durum:</Text>
                <Text style={[styles.numuneValue, { 
                  color: numune.durum === 'lab_girisi' ? '#10B981' : '#F59E0B' 
                }]}>
                  {numune.durum === 'lab_girisi' ? 'Lab\'da' : 'Giriş Bekliyor'}
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
        {scanning && !processing && !isHandling ? (
          <CameraView
            style={styles.camera}
            onBarcodeScanned={handleBarcodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ["qr", "pdf417"],
            }}
          />
        ) : (
          <View style={styles.camera} />
        )}
        
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
  },
  backButton: {
    marginRight: 15,
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
  numuneCard: {
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
  numuneTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E3A8A',
    marginBottom: 15,
  },
  numuneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  numuneLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  numuneValue: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
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
});