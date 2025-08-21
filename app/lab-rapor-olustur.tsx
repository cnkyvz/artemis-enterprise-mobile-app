// app/lab-rapor-olustur.tsx
import React, { useState, useEffect, useRef } from 'react';
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
 Dimensions,
 KeyboardAvoidingView,
 TouchableWithoutFeedback  
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import api from '../utils/enterpriseApi';

const { width, height } = Dimensions.get('window');
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;
const scrollViewRef = useRef<ScrollView>(null);

interface NumuneData {
 id: number;
 qr_kod: string;
 firma_adi: string;
 alinan_yer: string;
 numune_alis_tarihi: string;
 lab_giris_tarihi: string;
 alan_kisi: string;
 company_name?: string;
}

interface TestRow {
 id: string;
 numune_no: string;
 numune_yeri: string;
 testler: string;
 birim: string;
 bulgu: string;
 limit_deger: string;
 metot: string;
 showDropdown?: boolean;
 showBirimDropdown?: boolean;
 showMetotDropdown?: boolean;
}

interface TestParameter {
  birim: string | string[];
  metot: string[];
}

interface TestParametersType {
  [key: string]: TestParameter;
}

// Test parametreleri - Excel tablosundan
const TEST_PARAMETERS: TestParametersType = {
  'pH': { birim: '-', metot: ['Daldırma'] },
  'Bulanıklık': { birim: 'NTU', metot: ['Turbidimetre'] },
  'Renk': { birim: 'Pt-Co', metot: ['Spektrofotometre'] },
  'İletkenlik': { birim: ['μS/cm', 'ppm'], metot: ['Daldırma'] },
  'Klorür (Cl-)': { birim: 'mg/L', metot: ['Titrasyon'] },
  'Askıda Katı Madde (AKM)': { birim: 'mg/L', metot: ['Standart'] },
  'Sertlik': { birim: '°f', metot: ['Titrasyon'] },
  'Krom (Cr+6)': { birim: 'mg/L', metot: ['LCK313'] },
  'Toplam Krom (Cr)': { birim: 'mg/L', metot: ['LCK313'] },
  'Sülfat (SO4-2)': { birim: 'mg/L', metot: ['LCK353'] },
  'Toplam Siyanür (CN-)': { birim: 'mg/L', metot: ['LCK315', 'TR-CN'] },
  'Fosfat Fosforu (PO4-P)': { birim: 'mg/L', metot: ['LCK350', 'TR-TP'] },
  'Toplam Fosfor (P)': { birim: 'mg/L', metot: ['TR-TP'] },
  'Toplam Azot (N)': { birim: 'mg/L', metot: ['TR-TN'] },
  'Amonyum Azotu (NH4-N)': { birim: 'mg/L', metot: ['985005', 'LCK303'] },
  'Nitrit (NO2-)': { birim: 'mg/L', metot: ['LCK341', 'TR-NO2'] },
  'Nitrat (NO3-)': { birim: 'mg/L', metot: ['LCK339'] },
  'Kimyasal Oksijen İhtiyacı (KOİ)': { birim: 'mg/L', metot: ['K-7375', 'K-7365'] },
  'KOİ': { birim: 'mg/L', metot: ['K-7375', 'K-7365'] },
  'Bakır (Cu)': { birim: 'mg/L', metot: ['LCK329', 'TR-Cu'] },
  'Nikel (Ni)': { birim: 'mg/L', metot: ['LCK337'] },
  'Çinko (Zn)': { birim: 'mg/L', metot: ['LCK360'] },
  'Demir (Fe)': { birim: 'mg/L', metot: ['LCK320'] },
  'Sülfit (SO3-2)': { birim: 'mg/L', metot: ['985089'] },
  'Sülfür (S-2)': { birim: 'mg/L', metot: ['985073'] },
  'Yağ-Gres': { birim: 'mg/L', metot: ['Standart'] }
};

export default function LabRaporOlustur() {
 const router = useRouter();
 const params = useLocalSearchParams();
 
 // Birden fazla şekilde QR kod parametresini al
 const qr_kod = params.qr_kod || params.qrKod || params.qr_code || params.id;
 
 console.log('📝 Tüm route parametreleri:', params);
 console.log('📝 Bulunan QR kod:', qr_kod);
 
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [numune, setNumune] = useState<NumuneData | null>(null);
 
 // Rapor temel bilgileri
 const [raporNo, setRaporNo] = useState('');
 const [raporTarihi, setRaporTarihi] = useState('');
 const [firmaAdi, setFirmaAdi] = useState('');
 const [firmaAdres, setFirmaAdres] = useState('');
 const [numuneCinsi, setNumuneCinsi] = useState('Atık su');
 const [uygulananIslemler, setUygulananIslemler] = useState('');
 const [numuneGelisTarihi, setNumuneGelisTarihi] = useState('');
 const [analizBaslamaTarihi, setAnalizBaslamaTarihi] = useState('');
 const [analizBitisTarihi, setAnalizBitisTarihi] = useState('');

// Test dropdown için state'ler
const [testOptions] = useState(Object.keys(TEST_PARAMETERS));
const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
const [filteredTestOptions, setFilteredTestOptions] = useState<string[]>([]);

const [activeMetotDropdown, setActiveMetotDropdown] = useState<string | null>(null);
const [filteredMetotOptions, setFilteredMetotOptions] = useState<string[]>([]);
const [metotOptions] = useState(['K-7375', 'Daldırma', 'TR-TN', 'TR-TP']);
// Birim dropdown için state'ler
const [activeBirimDropdown, setActiveBirimDropdown] = useState<string | null>(null);
const [birimOptions, setBirimOptions] = useState<string[]>([]);
 
 // Test satırları - dinamik
 const [testRows, setTestRows] = useState<TestRow[]>([]);

// app/lab-rapor-olustur.tsx - loadData fonksiyonunu güncelle

const loadData = async () => {
  try {
    setLoading(true);
    
    if (!qr_kod) {
      Alert.alert('Hata', 'QR kod parametresi bulunamadı');
      router.back();
      return;
    }
    
    // ✅ DÜZELTME: let olarak tanımla ki sonradan değiştirilebilsin
    const rapor_id = params.rapor_id;
    let isRevizyon = !!rapor_id;
    
    console.log('🔍 Load Data:', { qr_kod, rapor_id, isRevizyon });
    
    // ✅ DÜZELTME: Numune bilgilerini çek - hata yakalama ile
    let numuneData;
    try {
      const numuneResponse = await api.get(`/api/numune-sorgula/${qr_kod}`);
      numuneData = numuneResponse.data;
      setNumune(numuneData);
      
      console.log('📊 Numune verisi yüklendi:', {
        qr_kod: numuneData.qr_kod,
        firma_adi: numuneData.firma_adi,
        alinan_yer: numuneData.alinan_yer,
        durum: numuneData.durum,
        company_id: numuneData.company_id
      });
      
    } catch (numuneError) {
      console.error('❌ Numune verisi alınamadı:', numuneError);
      
      let errorMessage = 'Numune bilgileri alınamadı';
      if (numuneError.response?.status === 404) {
        errorMessage = 'Bu QR kod sistemde bulunamadı. Lütfen önce barkod ekranından numune alım işlemini tamamlayın.';
      }
      
      Alert.alert('Hata', errorMessage);
      router.back();
      return;
    }
    
    let firmaAdi = '';
    let firmaAdres = '';
    let numuneCinsi = 'Atık su';
    let uygulananIslemler = '';
    let analizBaslamaTarihi = '';
    let analizBitisTarihi = '';
    let raporNumarasi = '';
    let raporTarihi = '';
    let testSonuclari: TestRow[] = [];

    // ✅ REVIZYON MODU: Önceki rapor verilerini çek
    if (isRevizyon) {
      try {
        console.log('📋 Revizyon modu - önceki rapor verileri çekiliyor...');
        
        const raporResponse = await api.get(`/api/rapor-detay/${rapor_id}`);
        const raporData = raporResponse.data;
        
        console.log('✅ Önceki rapor verisi alındı:', {
          rapor_no: raporData.rapor_no,
          test_sonuclari_count: raporData.test_sonuclari?.length || 0,
          firma_adi: raporData.firma_adi
        });
        
        // ✅ Önceki rapor bilgilerini doldur
        raporNumarasi = raporData.rapor_no || `AR${new Date().getFullYear()}${String(Date.now()).slice(-4)}`;
        raporTarihi = raporData.rapor_tarihi ? 
          new Date(raporData.rapor_tarihi).toLocaleDateString('tr-TR') : 
          new Date().toLocaleDateString('tr-TR');
        
        // ✅ DÜZELTME: Firma bilgilerini öncelik sırasına göre al
        firmaAdi = raporData.firma_adi || numuneData.firma_adi || numuneData.company_name || '';
        firmaAdres = raporData.firma_adres || numuneData.alinan_yer || '';
        numuneCinsi = raporData.numune_cinsi || 'Atık su';
        uygulananIslemler = raporData.uygulanan_islemler || '';
        
        analizBaslamaTarihi = raporData.analiz_baslama_tarihi ? 
          new Date(raporData.analiz_baslama_tarihi).toLocaleDateString('tr-TR') : 
          new Date().toLocaleDateString('tr-TR');
        
        analizBitisTarihi = raporData.analiz_bitis_tarihi ? 
          new Date(raporData.analiz_bitis_tarihi).toLocaleDateString('tr-TR') : 
          new Date().toLocaleDateString('tr-TR');
        
        // ✅ Önceki test sonuçlarını dönüştür
        let oncekiTestler: any[] = [];
        
        // 1. Önce test_sonuclari'ndan dene
        if (raporData.test_sonuclari && Array.isArray(raporData.test_sonuclari)) {
          oncekiTestler = raporData.test_sonuclari;
          console.log('📊 Test sonuçları test_sonuclari alanından alındı');
        }
        // 2. Eğer boşsa rapor_metni'nden dene
        else if (raporData.rapor_metni) {
          try {
            const raporMetni = typeof raporData.rapor_metni === 'string' ? 
              JSON.parse(raporData.rapor_metni) : raporData.rapor_metni;
            
            if (raporMetni.test_sonuclari && Array.isArray(raporMetni.test_sonuclari)) {
              oncekiTestler = raporMetni.test_sonuclari;
              console.log('📊 Test sonuçları rapor_metni alanından alındı');
            }
          } catch (parseError) {
            console.log('⚠️ rapor_metni parse hatası:', parseError);
          }
        }
        
        // ✅ Test verilerini TestRow formatına dönüştür
        testSonuclari = oncekiTestler.map((test, index) => ({
          id: `${Date.now()}-${index}`,
          numune_no: test.artemis_numune_no || test.numune_no || '',
          numune_yeri: test.nokta_adi || test.numune_yeri || 'Giriş',
          testler: test.test_adi || test.testler || '',
          birim: test.test_birimi || test.birim || '',
          bulgu: test.test_sonucu_metin || test.test_sonucu || test.bulgu || '',
          limit_deger: test.limit_deger || '',
          metot: test.test_metodu || test.metot || ''
        }));
        
        console.log(`✅ ${testSonuclari.length} önceki test sonucu yüklendi`);
        
      } catch (raporError) {
        console.error('❌ Önceki rapor verisi alınamadı:', raporError);
        Alert.alert('Uyarı', 'Önceki rapor verileri alınamadı, yeni rapor olarak devam ediliyor.');
        // ✅ DÜZELTME: Artık değiştirilebilir
        isRevizyon = false;
      }
    }
    
    // ✅ YENİ RAPOR MODU: Default değerler
    if (!isRevizyon || testSonuclari.length === 0) {
      console.log('📝 Yeni rapor modu - default değerler ayarlanıyor...');
      
      const bugununTarihi = new Date().toLocaleDateString('tr-TR');
      
      // ✅ DÜZELTME: Rapor numarası oluşturma
      if (!raporNumarasi) {
        raporNumarasi = `AR${new Date().getFullYear()}${String(Date.now()).slice(-4)}`;
      }
      if (!raporTarihi) {
        raporTarihi = bugununTarihi;
      }
      
      // ✅ DÜZELTME: Firma bilgilerini numune verisinden al
      if (!firmaAdi) {
        firmaAdi = numuneData.firma_adi || numuneData.company_name || '';
      }
      if (!firmaAdres) {
        firmaAdres = numuneData.alinan_yer || '';
      }
      
      // ✅ DÜZELTME: Company ID varsa firma detaylarını çek
      if (numuneData.company_id && (!firmaAdres || firmaAdres === 'Bilinmeyen Yer')) {
        try {
          console.log('🏢 Firma detayları çekiliyor, Company ID:', numuneData.company_id);
          const firmaDetayResponse = await api.get(`/api/firma/${numuneData.company_id}`);
          if (firmaDetayResponse.data?.address) {
            firmaAdres = firmaDetayResponse.data.address;
            console.log('✅ Firma adresi API\'den alındı:', firmaAdres);
          }
        } catch (firmaError) {
          console.log('⚠️ Firma detayları alınamadı:', firmaError);
        }
      }
      
      if (!analizBaslamaTarihi) {
        analizBaslamaTarihi = bugununTarihi;
      }
      if (!analizBitisTarihi) {
        analizBitisTarihi = bugununTarihi;
      }
      
      // ✅ DÜZELTME: Boş test satırı ekle (sadece yeni rapor için)
      if (testSonuclari.length === 0) {
        testSonuclari = [{
          id: Date.now().toString(),
          numune_no: '',
          numune_yeri: 'Giriş',
          testler: '',
          birim: '',
          bulgu: '',
          limit_deger: '',
          metot: ''
        }];
      }
    }
    
    // ✅ State'leri güncelle
    setRaporNo(raporNumarasi);
    setRaporTarihi(raporTarihi);
    setFirmaAdi(firmaAdi);
    setFirmaAdres(firmaAdres);
    setNumuneCinsi(numuneCinsi);
    setUygulananIslemler(uygulananIslemler);
    setAnalizBaslamaTarihi(analizBaslamaTarihi);
    setAnalizBitisTarihi(analizBitisTarihi);
    
    // ✅ DÜZELTME: Numune geliş tarihi
    const gelişTarihi = numuneData.numune_alis_tarihi ? 
      new Date(numuneData.numune_alis_tarihi).toLocaleDateString('tr-TR') : 
      new Date().toLocaleDateString('tr-TR');
    setNumuneGelisTarihi(gelişTarihi);
    
    // ✅ Test satırlarını yükle
    setTestRows(testSonuclari);
    
    console.log('✅ Veri yükleme tamamlandı:', {
      isRevizyon,
      testRows_count: testSonuclari.length,
      rapor_no: raporNumarasi,
      firma_adi: firmaAdi,
      firma_adres: firmaAdres,
      numune_durum: numuneData.durum
    });
    
  } catch (error) {
    console.error('❌ Veri yükleme hatası:', error);
    
    let errorMessage = 'Veriler yüklenemedi';
    if (error.response?.status === 404) {
      errorMessage = 'Numune veya rapor bulunamadı';
    } else if (error.response?.data?.error) {
      errorMessage = error.response.data.error;
    }
    
    Alert.alert('Hata', errorMessage);
    router.back();
  } finally {
    setLoading(false);
  }
};

 useEffect(() => {
   loadData();
 }, []);

 // Yeni test satırı ekle
 const addNewTestRow = () => {
   const newRow: TestRow = {
     id: Date.now().toString(),
     numune_no: '',
     numune_yeri: '',
     testler: '',
     birim: '',
     bulgu: '',
     limit_deger: '',
     metot: ''
   };
   setTestRows(prev => [...prev, newRow]);
 };

 // Test satırını sil
 const removeTestRow = (id: string) => {
   if (testRows.length > 1) {
     setTestRows(prev => prev.filter(row => row.id !== id));
   }
 };

 // Test satırını güncelle
 const updateTestRow = (id: string, field: keyof TestRow, value: string) => {
   setTestRows(prev => prev.map(row => 
     row.id === id ? { ...row, [field]: value } : row
   ));
 };

 const handleTestSearch = (rowId: string, text: string) => {
  updateTestRow(rowId, 'testler', text);
  
  // Otomatik birim ve metot ayarlama
  const testParam = TEST_PARAMETERS[text];
  if (testParam) {
    // Birim ayarlama
    if (Array.isArray(testParam.birim)) {
      updateTestRow(rowId, 'birim', testParam.birim[0]);
      // Birden fazla birim seçeneği varsa dropdown'u aç
      setBirimOptions(testParam.birim);
      setActiveBirimDropdown(rowId);
    } else {
      updateTestRow(rowId, 'birim', testParam.birim);
    }
    
    // Metot ayarlama
    if (testParam.metot.length === 1) {
      updateTestRow(rowId, 'metot', testParam.metot[0]);
    } else {
      updateTestRow(rowId, 'metot', testParam.metot[0]);
      // Birden fazla metot seçeneği varsa dropdown'u aç
      setFilteredMetotOptions(testParam.metot);
      setActiveMetotDropdown(rowId);
    }
  }
  
  if (text.length > 0) {
    const filtered = testOptions.filter(option => 
      option.toLowerCase().includes(text.toLowerCase())
    );
    setFilteredTestOptions(filtered);
    setActiveDropdown(rowId);
  } else {
    setFilteredTestOptions(testOptions);
    setActiveDropdown(text.length > 0 ? rowId : null);
  }
};

const selectTest = (rowId: string, testValue: string) => {
  updateTestRow(rowId, 'testler', testValue);
  
  // Otomatik birim ve metot ayarlama
  const testParam = TEST_PARAMETERS[testValue];
  if (testParam) {
    // Birim ayarlama
    if (Array.isArray(testParam.birim)) {
      updateTestRow(rowId, 'birim', testParam.birim[0]);
      // Birden fazla birim seçeneği varsa dropdown'u aç
      setBirimOptions(testParam.birim);
      setActiveBirimDropdown(rowId);
    } else {
      updateTestRow(rowId, 'birim', testParam.birim);
    }
    
    // Metot ayarlama
    if (testParam.metot.length === 1) {
      updateTestRow(rowId, 'metot', testParam.metot[0]);
    } else {
      updateTestRow(rowId, 'metot', testParam.metot[0]);
      // Birden fazla metot seçeneği varsa dropdown'u aç
      setFilteredMetotOptions(testParam.metot);
      setActiveMetotDropdown(rowId);
    }
  }
  
  setActiveDropdown(null);
  setFilteredTestOptions([]);
};

const handleBirimClick = (rowId: string) => {
  const currentRow = testRows.find(row => row.id === rowId);
  if (!currentRow?.testler) return;
  
  const testParam = TEST_PARAMETERS[currentRow.testler];
  if (testParam && Array.isArray(testParam.birim)) {
    setBirimOptions(testParam.birim);
    // Dropdown açık değilse aç, açıksa kapat
    if (activeBirimDropdown === rowId) {
      setActiveBirimDropdown(null);
      setBirimOptions([]);
    } else {
      setActiveBirimDropdown(rowId);
    }
  }
};

const selectBirim = (rowId: string, birimValue: string) => {
  updateTestRow(rowId, 'birim', birimValue);
  setActiveBirimDropdown(null);
  setBirimOptions([]);
};

const handleMetotClick = (rowId: string) => {
  const currentRow = testRows.find(row => row.id === rowId);
  if (!currentRow?.testler) return;
  
  const testParam = TEST_PARAMETERS[currentRow.testler];
  if (testParam && testParam.metot.length > 1) {
    setFilteredMetotOptions(testParam.metot);
    // Dropdown açık değilse aç, açıksa kapat
    if (activeMetotDropdown === rowId) {
      setActiveMetotDropdown(null);
      setFilteredMetotOptions([]);
    } else {
      setActiveMetotDropdown(rowId);
    }
  }
};

const handleMetotSearch = (rowId: string, text: string) => {
  updateTestRow(rowId, 'metot', text);
  
  const currentRow = testRows.find(row => row.id === rowId);
  if (currentRow?.testler) {
    const testParam = TEST_PARAMETERS[currentRow.testler];
    if (testParam && testParam.metot.length > 0) {
      const filtered = testParam.metot.filter(option => 
        option.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredMetotOptions(filtered);
      setActiveMetotDropdown(rowId);
      return;
    }
  }
  
  if (text.length > 0) {
    const filtered = metotOptions.filter(option => 
      option.toLowerCase().includes(text.toLowerCase())
    );
    setFilteredMetotOptions(filtered);
    setActiveMetotDropdown(rowId);
  } else {
    setFilteredMetotOptions(metotOptions);
    setActiveMetotDropdown(text.length > 0 ? rowId : null);
  }
};

const selectMetot = (rowId: string, metotValue: string) => {
  updateTestRow(rowId, 'metot', metotValue);
  setActiveMetotDropdown(null);
  setFilteredMetotOptions([]);
};

const generateRapor = async () => {
  try {
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Form doğrulama
    if (!firmaAdi.trim()) {
      Alert.alert('Hata', 'Firma adı zorunludur');
      setSaving(false);
      return;
    }

    if (!numuneCinsi.trim()) {
      Alert.alert('Hata', 'Numune cinsi zorunludur');
      setSaving(false);
      return;
    }

    if (testRows.length === 0) {
      Alert.alert('Hata', 'En az bir test sonucu ekleyin');
      setSaving(false);
      return;
    }

    // Boş test satırlarını kontrol et - sadece testler alanı dolu olsun yeterli
    const validTestRows = testRows.filter(row => 
      row.testler.trim() // Sadece test adı dolu olması yeterli
    );

    if (validTestRows.length === 0) {
      Alert.alert('Hata', 'En az bir test adı girin');
      setSaving(false);
      return;
    }

    // Rapor verilerini hazırla
    const raporData = {
      qr_kod: qr_kod,
      rapor_no: raporNo,
      rapor_tarihi: raporTarihi,
      firma_adi: firmaAdi,
      firma_adres: firmaAdres,
      numune_cinsi: numuneCinsi,
      uygulanan_islemler: uygulananIslemler,
      numune_gelis_tarihi: numuneGelisTarihi,
      analiz_baslama_tarihi: analizBaslamaTarihi,
      analiz_bitis_tarihi: analizBitisTarihi,
      test_sonuclari: validTestRows
    };

    console.log('📊 Rapor verisi gönderiliyor:', raporData);

    // Rapor oluşturma API'sini çağır
    const response = await api.post('/api/rapor-olustur-detayli', raporData);

    if (response.data) {
      Alert.alert(
        'Başarılı!',
        `Rapor oluşturuldu (${raporNo}). Admin onayına gönderildi.`,
        [
          {
            text: 'Rapor Listesi',
            onPress: () => router.push('/lab-rapor-listesi')
          },
          {
            text: 'Ana Sayfa',
            onPress: () => router.back()
          }
        ]
      );
    }

  } catch (error) {
    console.error('❌ Rapor oluşturma hatası:', error);
    Alert.alert(
      'Hata',
      error.response?.data?.error || 'Rapor oluşturulamadı'
    );
  } finally {
    setSaving(false);
  }
};

 if (loading) {
   return (
     <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
       <ActivityIndicator size="large" color="#1E3A8A" />
       <Text style={styles.loadingText}>Rapor verileri yükleniyor...</Text>
     </View>
   );
 }

 return (
  <KeyboardAvoidingView 
    style={styles.container}
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
  >
    <StatusBar barStyle="light-content" backgroundColor="#1E3A8A" translucent />
    
    <LinearGradient colors={['#1E3A8A', '#2563EB']} style={styles.header}>
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <Ionicons name="arrow-back" size={24} color="white" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Lab Raporu Oluştur</Text>
    </LinearGradient>

    <TouchableWithoutFeedback 
      onPress={() => {
        setActiveDropdown(null);
        setFilteredTestOptions([]);
        setActiveMetotDropdown(null);
        setFilteredMetotOptions([]);
        setActiveBirimDropdown(null);
        setBirimOptions([]);
      }}
    >

    <ScrollView 
      ref={scrollViewRef}
      style={styles.content} 
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 100 }}
    >
      {/* Rapor Temel Bilgileri */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="file-document" size={24} color="#1E3A8A" />
          <Text style={styles.cardTitle}>Rapor Bilgileri</Text>
        </View>
        
        <View style={styles.formRow}>
          <View style={styles.formColumn}>
            <Text style={styles.formLabel}>Rapor No:</Text>
            <TextInput
              style={[styles.textInput, styles.readOnlyInput]}
              value={raporNo}
              editable={false}
            />
          </View>
          <View style={styles.formColumn}>
            <Text style={styles.formLabel}>Tarih:</Text>
            <TextInput
              style={[styles.textInput, styles.readOnlyInput]}
              value={raporTarihi}
              editable={false}
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.formLabel}>Firma:</Text>
          <TextInput
            style={[styles.textInput, styles.readOnlyInput]}
            value={firmaAdi}
            editable={false}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.formLabel}>Adres:</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={firmaAdres}
            onChangeText={setFirmaAdres}
            placeholder="Firma adresini girin"
            multiline
            numberOfLines={3}
          />
        </View>
      </View>

      {/* Numune Bilgileri */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="flask" size={24} color="#1E3A8A" />
          <Text style={styles.cardTitle}>Numune Detayları</Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.formLabel}>Numune Cinsi:</Text>
          <TextInput
            style={styles.textInput}
            value={numuneCinsi}
            onChangeText={setNumuneCinsi}
            placeholder="Numune cinsini girin"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.formLabel}>Numuneye Uygulanan İşlemler:</Text>
          <TextInput
            style={styles.textInput}
            value={uygulananIslemler}
            onChangeText={setUygulananIslemler}
            placeholder="Uygulanan işlemleri girin"
          />
        </View>

        <View style={styles.formRow}>
          <View style={styles.formColumn}>
            <Text style={styles.formLabel}>Geliş Tarihi:</Text>
            <TextInput
              style={[styles.textInput, styles.readOnlyInput]}
              value={numuneGelisTarihi}
              editable={false}
            />
          </View>
          <View style={styles.formColumn}>
            <Text style={styles.formLabel}>Analiz Başlama:</Text>
            <TextInput
              style={styles.textInput}
              value={analizBaslamaTarihi}
              onChangeText={setAnalizBaslamaTarihi}
              placeholder="GG.AA.YYYY"
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.formLabel}>Analiz Bitiş Tarihi:</Text>
          <TextInput
            style={styles.textInput}
            value={analizBitisTarihi}
            onChangeText={setAnalizBitisTarihi}
            placeholder="GG.AA.YYYY"
          />
        </View>
      </View>

      {/* Test Sonuçları Tablosu */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="table" size={24} color="#1E3A8A" />
          <Text style={styles.cardTitle}>Test Sonuçları</Text>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={addNewTestRow}
          >
            <Ionicons name="add" size={20} color="#10B981" />
          </TouchableOpacity>
        </View>

        {/* Tablo Başlık */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.col3]}>Testler</Text>
          <Text style={[styles.tableHeaderText, styles.col4]}>Birim</Text>
          <Text style={[styles.tableHeaderText, styles.col5]}>Bulgu</Text>
          <Text style={[styles.tableHeaderText, styles.col6]}>Limit Değer</Text>
          <Text style={[styles.tableHeaderText, styles.col7]}>Metot</Text>
        </View>

        {/* Test Satırları */}
        {testRows.map((row, index) => (
          <View key={row.id} style={styles.tableRow}>
            {/* Testler - Dropdown ile */}
            <View style={[styles.col3, styles.dropdownContainer]}>
              <TextInput
                style={styles.tableInput}
                value={row.testler}
                onChangeText={(value) => handleTestSearch(row.id, value)}
                onFocus={() => {
                  if (testOptions.length > 0) {
                    setFilteredTestOptions(testOptions);
                    setActiveDropdown(row.id);
                  }
                  // Klavye açıldığında scroll yap
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 300);
                }}
                placeholder="pH"
                returnKeyType="next"
              />
              
              {activeDropdown === row.id && (
              <TouchableWithoutFeedback onPress={() => {}}>
                <View 
                  style={styles.testDropdown}
                  onStartShouldSetResponder={() => true}
                >
                  <ScrollView 
                    style={styles.dropdownScrollView}
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled={true}
                    onStartShouldSetResponder={() => true}
                  >
                    {filteredTestOptions.map((option, optionIndex) => (
                      <TouchableOpacity
                        key={optionIndex}
                        style={styles.dropdownItem}
                        onPress={() => selectTest(row.id, option)}
                      >
                        <Text style={styles.dropdownItemText}>{option}</Text>
                      </TouchableOpacity>
                    ))}
                    {filteredTestOptions.length === 0 && row.testler && (
                      <View style={styles.dropdownItem}>
                        <Text style={styles.dropdownNoResult}>
                          Sonuç bulunamadı. Yeni test olarak eklenecek.
                        </Text>
                      </View>
                    )}
                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
              )}
            </View>

            {/* Birim */}
            <View style={[styles.col4, styles.dropdownContainer]}>
              <TouchableOpacity 
                onPress={() => handleBirimClick(row.id)}
                activeOpacity={0.7}
              >
                <TextInput
                  style={[styles.tableInput]}
                  value={row.birim}
                  onChangeText={(value) => updateTestRow(row.id, 'birim', value)}
                  onFocus={() => {
                    setTimeout(() => {
                      scrollViewRef.current?.scrollToEnd({ animated: true });
                    }, 300);
                  }}
                  placeholder="mg/l"
                  returnKeyType="next"
                  editable={!TEST_PARAMETERS[row.testler] || !Array.isArray(TEST_PARAMETERS[row.testler]?.birim)}
                  pointerEvents={TEST_PARAMETERS[row.testler] && Array.isArray(TEST_PARAMETERS[row.testler]?.birim) ? 'none' : 'auto'}
                />
              </TouchableOpacity>
              
              {activeBirimDropdown === row.id && birimOptions.length > 0 && (
                  <View 
                    style={styles.testDropdown}
                    onStartShouldSetResponder={() => true}
                  >
                    <ScrollView 
                      style={styles.dropdownScrollView}
                      keyboardShouldPersistTaps="handled"
                      nestedScrollEnabled={true}
                      onStartShouldSetResponder={() => true}
                    >
                    {birimOptions.map((option, optionIndex) => (
                      <TouchableOpacity
                        key={optionIndex}
                        style={styles.dropdownItem}
                        onPress={() => selectBirim(row.id, option)}
                      >
                        <Text style={styles.dropdownItemText}>{option}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Bulgu */}
            <TextInput
              style={[styles.tableInput, styles.col5]}
              value={row.bulgu}
              onChangeText={(value) => updateTestRow(row.id, 'bulgu', value)}
              onFocus={() => {
                setTimeout(() => {
                  scrollViewRef.current?.scrollToEnd({ animated: true });
                }, 300);
              }}
              placeholder="7.2"
              returnKeyType="next"
            />

            {/* Limit Değer */}
            <TextInput
              style={[styles.tableInput, styles.col6]}
              value={row.limit_deger}
              onChangeText={(value) => updateTestRow(row.id, 'limit_deger', value)}
              onFocus={() => {
                setTimeout(() => {
                  scrollViewRef.current?.scrollToEnd({ animated: true });
                }, 300);
              }}
              placeholder="6-12"
              returnKeyType="next"
            />

            {/* Metot */}
            <View style={[styles.col7, styles.methodColumn]}>
              <View style={[styles.dropdownContainer, { flex: 1 }]}>
                <TouchableOpacity 
                  onPress={() => handleMetotClick(row.id)}
                  activeOpacity={0.7}
                >
                  <TextInput
                    style={[styles.tableInput, styles.methodInput]}
                    value={row.metot}
                    onChangeText={(value) => handleMetotSearch(row.id, value)}
                    onFocus={() => {
                      const currentRow = testRows.find(r => r.id === row.id);
                      if (currentRow?.testler) {
                        const testParam = TEST_PARAMETERS[currentRow.testler];
                        if (testParam && testParam.metot.length > 0) {
                          setFilteredMetotOptions(testParam.metot);
                          setActiveMetotDropdown(row.id);
                        }
                      }
                      setTimeout(() => {
                        scrollViewRef.current?.scrollToEnd({ animated: true });
                      }, 300);
                    }}
                    placeholder="K-7375"
                    returnKeyType="done"
                    editable={!TEST_PARAMETERS[row.testler] || TEST_PARAMETERS[row.testler]?.metot.length <= 1}
                    pointerEvents={TEST_PARAMETERS[row.testler] && TEST_PARAMETERS[row.testler]?.metot.length > 1 ? 'none' : 'auto'}
                  />
                </TouchableOpacity>
                
                {activeMetotDropdown === row.id && filteredMetotOptions.length > 0 && (
                  <View 
                    style={styles.testDropdown}
                    onStartShouldSetResponder={() => true}
                  >
                    <ScrollView 
                      style={styles.dropdownScrollView}
                      keyboardShouldPersistTaps="handled"
                      nestedScrollEnabled={true}
                      onStartShouldSetResponder={() => true}
                    >
                      {filteredMetotOptions.map((option, optionIndex) => (
                        <TouchableOpacity
                          key={optionIndex}
                          style={styles.dropdownItem}
                          onPress={() => selectMetot(row.id, option)}
                        >
                          <Text style={styles.dropdownItemText}>{option}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
              
              {testRows.length > 1 && (
                <TouchableOpacity 
                  style={styles.deleteButton}
                  onPress={() => removeTestRow(row.id)}
                >
                  <Ionicons name="trash" size={16} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}

        {/* Yeni Satır Ekle Butonu */}
        <TouchableOpacity 
          style={styles.addRowButton}
          onPress={addNewTestRow}
        >
          <Ionicons name="add-circle-outline" size={20} color="#10B981" />
          <Text style={styles.addRowText}>Yeni Test Satırı Ekle</Text>
        </TouchableOpacity>
      </View>

      {/* Rapor Oluştur Butonu */}
      <TouchableOpacity 
        style={[styles.generateButton, saving && styles.disabledButton]}
        onPress={generateRapor}
        disabled={saving}
      >
        <MaterialCommunityIcons name="file-check" size={24} color="white" />
        <Text style={styles.generateButtonText}>
          {saving ? 'Rapor Oluşturuluyor...' : 'Rapor Oluştur ve Onaya Gönder'}
        </Text>
        {saving && <ActivityIndicator color="white" style={{ marginLeft: 10 }} />}
      </TouchableOpacity>
    </ScrollView>
    </TouchableWithoutFeedback>
  </KeyboardAvoidingView>
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
 card: {
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
   flex: 1,
 },
 addButton: {
   padding: 8,
   backgroundColor: '#D1FAE5',
   borderRadius: 8,
 },
 formGroup: {
   marginBottom: 16,
 },
 formRow: {
   flexDirection: 'row',
   marginBottom: 16,
 },
 formColumn: {
   flex: 1,
   marginRight: 8,
 },
 formLabel: {
   fontSize: 14,
   fontWeight: '600',
   color: '#334155',
   marginBottom: 8,
 },
 textInput: {
   borderWidth: 1,
   borderColor: '#D1D5DB',
   borderRadius: 8,
   paddingHorizontal: 12,
   paddingVertical: 10,
   fontSize: 14,
   backgroundColor: '#FFFFFF',
 },
 readOnlyInput: {
   backgroundColor: '#F3F4F6',
   color: '#6B7280',
 },
 textArea: {
   height: 80,
   textAlignVertical: 'top',
 },
 tableHeader: {
   flexDirection: 'row',
   backgroundColor: '#F8FAFC',
   paddingVertical: 12,
   paddingHorizontal: 8,
   borderRadius: 8,
   marginBottom: 8,
 },
 tableHeaderText: {
   fontSize: 12,
   fontWeight: 'bold',
   color: '#374151',
   textAlign: 'center',
 },
 tableRow: {
   flexDirection: 'row',
   marginBottom: 8,
   alignItems: 'center',
 },
 tableInput: {
   borderWidth: 1,
   borderColor: '#E5E7EB',
   borderRadius: 4,
   paddingHorizontal: 6,
   paddingVertical: 8,
   fontSize: 12,
   backgroundColor: '#FFFFFF',
   marginRight: 4,
 },
 col3: { flex: 1.2 }, // Testler
 col4: { flex: 1 },   // Birim
 col5: { flex: 1.2 }, // Bulgu
 col6: { flex: 1.2 }, // Limit Değer
 col7: { flex: 1.5 }, // Metot + Delete
 methodColumn: {
   flexDirection: 'row',
   alignItems: 'center',
 },
 methodInput: {
   flex: 1,
   marginRight: 4,
 },
 deleteButton: {
   padding: 6,
   backgroundColor: '#FEE2E2',
   borderRadius: 4,
 },
 addRowButton: {
   flexDirection: 'row',
   alignItems: 'center',
   justifyContent: 'center',
   paddingVertical: 12,
   paddingHorizontal: 16,
   backgroundColor: '#F0FDF4',
   borderRadius: 8,
   borderWidth: 1,
   borderColor: '#BBF7D0',
   borderStyle: 'dashed',
   marginTop: 8,
 },
 addRowText: {
   marginLeft: 8,
   fontSize: 14,
   fontWeight: '600',
   color: '#10B981',
 },
 generateButton: {
   backgroundColor: '#10B981',
   borderRadius: 16,
   flexDirection: 'row',
   justifyContent: 'center',
   alignItems: 'center',
   paddingVertical: 18,
   marginTop: 20,
   marginBottom: 30,
 },
 generateButtonText: {
   color: 'white',
   fontSize: 18,
   fontWeight: 'bold',
   marginLeft: 10,
 },
 disabledButton: {
   backgroundColor: '#94A3B8',
 },
 dropdownContainer: {
  position: 'relative',
  zIndex: 1000,
},
testDropdown: {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  backgroundColor: 'white',
  borderWidth: 1,
  borderColor: '#E5E7EB',
  borderRadius: 8,
  maxHeight: 150,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 8,
  elevation: 5,
  zIndex: 1001,
},
dropdownScrollView: {
  maxHeight: 140,
},
dropdownItem: {
  paddingVertical: 12,
  paddingHorizontal: 16,
  borderBottomWidth: 1,
  borderBottomColor: '#F3F4F6',
},
dropdownItemText: {
  fontSize: 14,
  color: '#374151',
},
dropdownNoResult: {
  fontSize: 12,
  color: '#9CA3AF',
  fontStyle: 'italic',
},
});