// app/lab-test-giris.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  StatusBar,
  Platform,
  Dimensions 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import api from '../utils/enterpriseApi';

const { width, height } = Dimensions.get('window');
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

interface TestParameter {
  id: number;
  test_adi: string;
  test_kodu: string;
  birim: string;
  referans_min?: number;
  referans_max?: number;
  referans_aciklama?: string;
}

interface TestSonuc {
  sonuc: string;
  sonuc_metin?: string;
  birim: string;
  limit_deger?: string;
  limit_min?: number;
  limit_max?: number;
  metot?: string;
  durum: 'uygun' | 'uygun_degil' | 'sinir_deger';
}

interface NumuneTestleri {
  [nokta_adi: string]: {
    [test_adi: string]: TestSonuc;
  };
}

export default function LabTestGiris() {
  const router = useRouter();
  const { qr_kod } = useLocalSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [numune, setNumune] = useState<any>(null);
  const [testParametreleri, setTestParametreleri] = useState<TestParameter[]>([]);
  const [numuneNoktalari, setNumuneNoktalari] = useState<any[]>([]);
  const [testSonuclari, setTestSonuclari] = useState<NumuneTestleri>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Paralel olarak tüm verileri çek
      const [numuneResponse, parametrelerResponse, noktalarResponse] = await Promise.all([
        api.get(`/api/numune-sorgula/${qr_kod}`),
        api.get('/api/test-parametreleri'),
        api.get('/api/numune-noktalari')
      ]);

      setNumune(numuneResponse.data);
      setTestParametreleri(parametrelerResponse.data);
      setNumuneNoktalari(noktalarResponse.data);

      // Test sonuçları için boş template oluştur
      const template: NumuneTestleri = {};
      noktalarResponse.data.forEach((nokta: any) => {
        template[nokta.nokta_adi] = {};
        parametrelerResponse.data.forEach((param: TestParameter) => {
          template[nokta.nokta_adi][param.test_adi] = {
            sonuc: '',
            birim: param.birim || '',
            durum: 'uygun'
          };
        });
      });
      
      setTestSonuclari(template);
      
    } catch (error) {
      console.error('❌ Veri yükleme hatası:', error);
      Alert.alert('Hata', 'Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const updateTestSonuc = (nokta: string, test: string, field: keyof TestSonuc, value: any) => {
    setTestSonuclari(prev => ({
      ...prev,
      [nokta]: {
        ...prev[nokta],
        [test]: {
          ...prev[nokta][test],
          [field]: value
        }
      }
    }));
  };

  const validateTestSonuc = (sonuc: string, param: TestParameter): 'uygun' | 'uygun_degil' | 'sinir_deger' => {
    if (!sonuc || !param.referans_min || !param.referans_max) return 'uygun';
    
    const numericSonuc = parseFloat(sonuc);
    if (isNaN(numericSonuc)) return 'uygun';
    
    if (numericSonuc < param.referans_min || numericSonuc > param.referans_max) {
      return 'uygun_degil';
    } else if (
      Math.abs(numericSonuc - param.referans_min) < 0.1 || 
      Math.abs(numericSonuc - param.referans_max) < 0.1
    ) {
      return 'sinir_deger';
    }
    
    return 'uygun';
  };

  const handleSonucChange = (nokta: string, test: string, value: string, param: TestParameter) => {
    const durum = validateTestSonuc(value, param);
    
    updateTestSonuc(nokta, test, 'sonuc', value);
    updateTestSonuc(nokta, test, 'durum', durum);
  };

  const kaydetTestSonuclari = async () => {
    try {
      setSaving(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Boş sonuçları kontrol et
      let bosTestVar = false;
      Object.keys(testSonuclari).forEach(nokta => {
        Object.keys(testSonuclari[nokta]).forEach(test => {
          if (!testSonuclari[nokta][test].sonuc.trim()) {
            bosTestVar = true;
          }
        });
      });

      if (bosTestVar) {
        Alert.alert(
          'Eksik Test Sonuçları',
          'Lütfen tüm test sonuçlarını girin',
          [{ text: 'Tamam' }]
        );
        setSaving(false);
        return;
      }

      // Test sonuçlarını API'ye gönder
      const response = await api.post('/api/test-sonuclari', {
        qr_kod: qr_kod,
        test_sonuclari: testSonuclari
      });

      if (response.data) {
        Alert.alert(
          'Başarılı!',
          'Test sonuçları kaydedildi. Şimdi rapor oluşturulabilir.',
          [
            {
              text: 'Rapor Oluştur',
              onPress: () => router.push({
                pathname: '/lab-rapor-olustur',
                params: { qr_kod: qr_kod }
              })
            },
            {
              text: 'Ana Sayfa',
              onPress: () => router.back()
            }
          ]
        );
      }

    } catch (error) {
      console.error('❌ Test sonuçları kayıt hatası:', error);
      Alert.alert(
        'Hata',
        error.response?.data?.error || 'Test sonuçları kaydedilemedi'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#1E3A8A" />
        <Text style={styles.loadingText}>Veriler yükleniyor...</Text>
      </View>
    );
  }

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
        <Text style={styles.headerTitle}>Test Sonuçları</Text>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Numune Bilgi Kartı */}
        <View style={styles.numuneCard}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="flask" size={24} color="#1E3A8A" />
            <Text style={styles.cardTitle}>Numune Bilgileri</Text>
          </View>
          <View style={styles.numuneRow}>
            <Text style={styles.numuneLabel}>QR Kod:</Text>
            <Text style={styles.numuneValue}>{numune?.qr_kod}</Text>
          </View>
          <View style={styles.numuneRow}>
            <Text style={styles.numuneLabel}>Firma:</Text>
            <Text style={styles.numuneValue}>{numune?.firma_adi}</Text>
          </View>
          <View style={styles.numuneRow}>
            <Text style={styles.numuneLabel}>Alınan Yer:</Text>
            <Text style={styles.numuneValue}>{numune?.alinan_yer}</Text>
          </View>
        </View>

        {/* Test Sonuçları */}
        {numuneNoktalari.map((nokta, noktaIndex) => (
          <View key={noktaIndex} style={styles.testSection}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="test-tube" size={20} color="#1E3A8A" />
              <Text style={styles.sectionTitle}>{nokta.nokta_adi}</Text>
            </View>

            {testParametreleri.map((param, paramIndex) => {
              const testData = testSonuclari[nokta.nokta_adi]?.[param.test_adi];
              const durumColor = testData?.durum === 'uygun' ? '#10B981' : 
                               testData?.durum === 'sinir_deger' ? '#F59E0B' : '#EF4444';

              return (
                <View key={paramIndex} style={styles.testItem}>
                  <View style={styles.testHeader}>
                    <Text style={styles.testName}>{param.test_adi}</Text>
                    <View style={[styles.durumBadge, { backgroundColor: durumColor }]}>
                      <Text style={styles.durumText}>
                        {testData?.durum === 'uygun' ? 'Uygun' : 
                         testData?.durum === 'sinir_deger' ? 'Sınır' : 'Uygun Değil'}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.testInputRow}>
                    <TextInput
                      style={styles.testInput}
                      placeholder="Sonuç girin"
                      value={testData?.sonuc || ''}
                      onChangeText={(value) => handleSonucChange(nokta.nokta_adi, param.test_adi, value, param)}
                      keyboardType="numeric"
                    />
                    <Text style={styles.testUnit}>{param.birim}</Text>
                  </View>
                  
                  {param.referans_aciklama && (
                    <Text style={styles.referansText}>
                      Referans: {param.referans_aciklama}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        ))}

        {/* Kaydet Butonu */}
        <TouchableOpacity 
          style={[styles.saveButton, saving && styles.disabledButton]}
          onPress={kaydetTestSonuclari}
          disabled={saving}
        >
          <MaterialCommunityIcons name="content-save" size={24} color="white" />
          <Text style={styles.saveButtonText}>
            {saving ? 'Kaydediliyor...' : 'Test Sonuçlarını Kaydet'}
          </Text>
          {saving && <ActivityIndicator color="white" style={{ marginLeft: 10 }} />}
        </TouchableOpacity>
      </ScrollView>
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
    padding: 16,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#64748B',
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E3A8A',
    marginLeft: 8,
  },
  numuneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
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
  testSection: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E3A8A',
    marginLeft: 8,
  },
  testItem: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  testHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  testName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
  },
  durumBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  durumText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  testInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  testInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: 'white',
    marginRight: 10,
  },
  testUnit: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
    minWidth: 50,
    textAlign: 'center',
  },
  referansText: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  saveButton: {
    backgroundColor: '#10B981',
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 18,
    marginTop: 20,
    marginBottom: 30,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  disabledButton: {
    backgroundColor: '#94A3B8',
  },
});