// app/numune-alma-formu.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput,
  ScrollView,
  Alert,
  Platform,
  Dimensions,
  StatusBar,
  ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import api from '../utils/enterpriseApi';

const { width, height } = Dimensions.get('window');
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

interface NumuneData {
  firma_adi: string;
  alinan_yer: string;
  numune_giris: string;
  numune_cikis: string;
  alma_noktasi: string;
  numune_turu: string;
  alma_notlari: string;
  alan_kisi: string;
  company_id: string;
  gps_koordinat?: {
    latitude: number;
    longitude: number;
  };
}

interface NumuneNoktalari {
  id: number;
  nokta_adi: string;
  nokta_kodu: string;
}

export default function NumuneAlmaFormu() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [numuneNoktalari, setNumuneNoktalari] = useState<NumuneNoktalari[]>([]);
  
  const [formData, setFormData] = useState<NumuneData>({
    firma_adi: '',
    alinan_yer: '',
    numune_giris: '',
    numune_cikis: '',
    alma_noktasi: '',
    numune_turu: 'Su',
    alma_notlari: '',
    alan_kisi: '',
    company_id: ''
  });

  // Teknisyen bilgilerini ve numune noktalarını yükle
  useEffect(() => {
    loadTekniksyenBilgileri();
    loadNumuneNoktalari();
  }, []);

  const loadTekniksyenBilgileri = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const user = JSON.parse(userData);
        setFormData(prev => ({
          ...prev,
          alan_kisi: `${user.ad || ''} ${user.soyad || ''}`.trim()
        }));
      }
    } catch (error) {
      console.error('Teknisyen bilgileri yüklenemedi:', error);
    }
  };

  const loadNumuneNoktalari = async () => {
    try {
      const response = await api.get('/api/numune-noktalari');
      setNumuneNoktalari(response.data);
    } catch (error) {
      console.error('Numune noktaları yüklenemedi:', error);
      Alert.alert('Hata', 'Numune noktaları yüklenemedi');
    }
  };

  const getCurrentLocation = async () => {
    try {
      setLocationLoading(true);
      
      // İzin kontrolü
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Konum bilgisi almak için izin vermeniz gerekiyor');
        return;
      }

      // Konum al
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setFormData(prev => ({
        ...prev,
        gps_koordinat: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        }
      }));

      Alert.alert('Başarılı', 'Konum bilgisi alındı');
      
    } catch (error) {
      console.error('Konum alınamadı:', error);
      Alert.alert('Hata', 'Konum bilgisi alınamadı');
    } finally {
      setLocationLoading(false);
    }
  };

  const validateForm = (): boolean => {
    if (!formData.firma_adi.trim()) {
      Alert.alert('Hata', 'Firma adı zorunludur');
      return false;
    }
    
    if (!formData.alinan_yer.trim()) {
      Alert.alert('Hata', 'Numune alınan yer zorunludur');
      return false;
    }
    
    if (!formData.numune_giris.trim()) {
      Alert.alert('Hata', 'Numune giriş değeri zorunludur');
      return false;
    }
    
    if (!formData.numune_cikis.trim()) {
      Alert.alert('Hata', 'Numune çıkış değeri zorunludur');
      return false;
    }
    
    if (!formData.alma_noktasi) {
      Alert.alert('Hata', 'Numune noktası seçimi zorunludur');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Company ID'yi kontrol et (seçilen firmaya göre)
      // Bu örnek için basit bir yaklaşım, gerçek uygulamada firma seçimi olabilir
      const userData = await AsyncStorage.getItem('userData');
      let company_id = '1'; // Default

      if (userData) {
        const user = JSON.parse(userData);
        company_id = user.company_id || '1';
      }

      const submitData = {
        ...formData,
        company_id: parseInt(company_id),
        numune_giris: parseFloat(formData.numune_giris),
        numune_cikis: parseFloat(formData.numune_cikis)
      };

      console.log('📝 Numune alma verisi gönderiliyor:', submitData);

      const response = await api.post('/api/numune-al', submitData);
      
      console.log('✅ Numune alma başarılı:', response.data);

      Alert.alert(
        'Başarılı!', 
        `Numune başarıyla alındı.\nQR Kod: ${response.data.data.qr_kod}`,
        [
          {
            text: 'Barkod Yazdır',
            onPress: () => {
              // Barkod ekranına yönlendir
              router.push({
                pathname: '/barkod-ekrani',
                params: { qr_kod: response.data.data.qr_kod }
              });
            }
          },
          {
            text: 'Tamam',
            onPress: () => router.back()
          }
        ]
      );

    } catch (error) {
      console.error('❌ Numune alma hatası:', error);
      const errorMessage = error.response?.data?.error || 'Numune alma işlemi başarısız';
      Alert.alert('Hata', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      firma_adi: '',
      alinan_yer: '',
      numune_giris: '',
      numune_cikis: '',
      alma_noktasi: '',
      numune_turu: 'Su',
      alma_notlari: '',
      alan_kisi: formData.alan_kisi,
      company_id: ''
    });
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#1E3A8A"
        translucent
      />
      
      <LinearGradient 
        colors={['#1E3A8A', '#2563EB']} 
        style={styles.headerGradient}
      >
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Numune Alma Formu</Text>
        <TouchableOpacity 
          style={styles.resetButton}
          onPress={resetForm}
        >
          <Ionicons name="refresh" size={24} color="white" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView 
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Firma Bilgileri */}
        <View style={styles.card}>
          <View style={styles.cardHeaderWithIcon}>
            <MaterialCommunityIcons name="domain" size={24} color="#1E3A8A" />
            <Text style={styles.cardTitle}>Firma Bilgileri</Text>
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Firma Adı *</Text>
            <TextInput
              style={styles.input}
              value={formData.firma_adi}
              onChangeText={(text) => setFormData({...formData, firma_adi: text})}
              placeholder="Firma adını girin"
              placeholderTextColor="#94A3B8"
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Numune Alınan Yer *</Text>
            <TextInput
              style={styles.input}
              value={formData.alinan_yer}
              onChangeText={(text) => setFormData({...formData, alinan_yer: text})}
              placeholder="Örn: Ana Giriş, Çıkış Borusu, Arıtma Ünitesi"
              placeholderTextColor="#94A3B8"
            />
          </View>
        </View>

        {/* Numune Detayları */}
        <View style={styles.card}>
          <View style={styles.cardHeaderWithIcon}>
            <MaterialCommunityIcons name="flask-outline" size={24} color="#1E3A8A" />
            <Text style={styles.cardTitle}>Numune Detayları</Text>
          </View>
          
          <View style={styles.rowInputs}>
            <View style={[styles.inputContainer, {flex: 1, marginRight: 10}]}>
              <Text style={styles.inputLabel}>Giriş Değeri (L) *</Text>
              <TextInput
                style={styles.input}
                value={formData.numune_giris}
                onChangeText={(text) => setFormData({...formData, numune_giris: text})}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor="#94A3B8"
              />
            </View>
            
            <View style={[styles.inputContainer, {flex: 1}]}>
              <Text style={styles.inputLabel}>Çıkış Değeri (L) *</Text>
              <TextInput
                style={styles.input}
                value={formData.numune_cikis}
                onChangeText={(text) => setFormData({...formData, numune_cikis: text})}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          {/* Numune Noktası Seçimi */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Numune Noktası *</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.noktaScrollView}
            >
              {numuneNoktalari.map((nokta) => (
                <TouchableOpacity
                  key={nokta.id}
                  style={[
                    styles.noktaButton,
                    formData.alma_noktasi === nokta.nokta_adi && styles.selectedNoktaButton
                  ]}
                  onPress={() => setFormData({...formData, alma_noktasi: nokta.nokta_adi})}
                >
                  <Text style={[
                    styles.noktaButtonText,
                    formData.alma_noktasi === nokta.nokta_adi && styles.selectedNoktaButtonText
                  ]}>
                    {nokta.nokta_adi}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Numune Türü */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Numune Türü</Text>
            <View style={styles.radioContainer}>
              {['Su', 'Atık Su', 'İçme Suyu'].map((tur) => (
                <TouchableOpacity
                  key={tur}
                  style={styles.radioOption}
                  onPress={() => setFormData({...formData, numune_turu: tur})}
                >
                  <View style={[
                    styles.radioCircle,
                    formData.numune_turu === tur && styles.selectedRadio
                  ]}>
                    {formData.numune_turu === tur && (
                      <View style={styles.radioInner} />
                    )}
                  </View>
                  <Text style={styles.radioText}>{tur}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Ek Bilgiler */}
        <View style={styles.card}>
          <View style={styles.cardHeaderWithIcon}>
            <MaterialCommunityIcons name="information-outline" size={24} color="#1E3A8A" />
            <Text style={styles.cardTitle}>Ek Bilgiler</Text>
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Alan Kişi</Text>
            <TextInput
              style={styles.input}
              value={formData.alan_kisi}
              onChangeText={(text) => setFormData({...formData, alan_kisi: text})}
              placeholder="Numune alan teknisyen adı"
              placeholderTextColor="#94A3B8"
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Notlar</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.alma_notlari}
              onChangeText={(text) => setFormData({...formData, alma_notlari: text})}
              placeholder="Numune alma ile ilgili notlar, gözlemler..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Konum Bilgisi */}
          <View style={styles.locationContainer}>
            <TouchableOpacity 
              style={styles.locationButton}
              onPress={getCurrentLocation}
              disabled={locationLoading}
            >
              {locationLoading ? (
                <ActivityIndicator color="#1E3A8A" />
              ) : (
                <Ionicons name="location-outline" size={20} color="#1E3A8A" />
              )}
              <Text style={styles.locationButtonText}>
                {formData.gps_koordinat ? 'Konum Güncelle' : 'Konum Al'}
              </Text>
            </TouchableOpacity>
            
            {formData.gps_koordinat && (
              <View style={styles.coordinatesContainer}>
                <Text style={styles.coordinatesText}>
                  📍 Lat: {formData.gps_koordinat.latitude.toFixed(6)}
                </Text>
                <Text style={styles.coordinatesText}>
                  📍 Lng: {formData.gps_koordinat.longitude.toFixed(6)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Kaydet Butonu */}
        <TouchableOpacity 
          style={[styles.submitButton, loading && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Ionicons name="checkmark-circle" size={24} color="white" />
          )}
          <Text style={styles.submitButtonText}>
            {loading ? 'Kaydediliyor...' : 'Numune Alma İşlemini Tamamla'}
          </Text>
        </TouchableOpacity>
        
        <View style={styles.bottomSpace} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  headerGradient: {
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
  resetButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeaderWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E3A8A',
    marginLeft: 8,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 15,
    color: '#334155',
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F8FAFC',
    color: '#334155',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  rowInputs: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  noktaScrollView: {
    marginTop: 4,
  },
  noktaButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  selectedNoktaButton: {
    backgroundColor: '#1E3A8A',
    borderColor: '#1E3A8A',
  },
  noktaButtonText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
  },
  selectedNoktaButtonText: {
    color: 'white',
  },
  radioContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedRadio: {
    borderColor: '#1E3A8A',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1E3A8A',
  },
  radioText: {
    fontSize: 14,
    color: '#334155',
  },
  locationContainer: {
    marginTop: 10,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E3A8A',
    backgroundColor: '#F8FAFC',
  },
  locationButtonText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#1E3A8A',
    fontWeight: '500',
  },
  coordinatesContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
  },
  coordinatesText: {
    fontSize: 12,
    color: '#0369A1',
    fontFamily: 'monospace',
  },
  submitButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 20,
  },
  disabledButton: {
    backgroundColor: '#94A3B8',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  bottomSpace: {
    height: 30,
  },
});