// app/bakim-form-detay/[id].tsx
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image,
  ActivityIndicator,
  Alert
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';  
import api from '../../utils/enterpriseApi';
import { StatusBar, Platform, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import offlineStorage from '../../artemis-api/utils/offlineStorage';

const { width, height } = Dimensions.get('window');

// StatusBar yüksekliğini hesapla
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

// Gerekli tip tanımlamaları
interface Durum {
  mekanikCalisir: boolean;
  mekanikArizali: boolean;
  elektrikliCalisir: boolean;
  elektrikliArizali: boolean;
}

interface BakimFormuDetay {
  id: number;
  tarih: string;
  firma_adi: string;
  adres: string;
  telefon: string;
  model: string;
  aciklamalar: string;
  servis_imza: string;
  firma_imza: string;
  giris_numune: string;
  giris_litre: number;
  cikis_numune: string;
  cikis_litre: number;
  seri_no: string;
  calisan_ad?: string;
  calisan_soyad?: string;
  firma_yetkili_ad?: string;
  firma_yetkili_soyad?: string;
  
  // Kontrol parametreleri
  [key: string]: any; // Diğer tüm parametreler için
}

const FormImzaGoruntule = ({ imza, ad, soyad, tip }) => {
  if (!imza) {
    return (
      <View style={styles.imzaContainer}>
        <Text style={styles.imzaBaslik}>{tip === 'firma' ? 'Firma İmzası' : 'Servis İmzası'}</Text>
        <View style={styles.imzaYok}>
          <Text style={styles.imzaYokText}>İmza bulunamadı</Text>
        </View>
        <Text style={styles.imzaSahibi}>{ad} {soyad}</Text>
      </View>
    );
  }

  return (
    <View style={styles.imzaContainer}>
      <Text style={styles.imzaBaslik}>{tip === 'firma' ? 'Firma İmzası' : 'Servis İmzası'}</Text>
      <View style={styles.imzaBox}>
        <Image 
          source={{ uri: imza }} 
          style={styles.imzaImage} 
          resizeMode="contain"
        />
      </View>
      <Text style={styles.imzaSahibi}>{ad} {soyad}</Text>
    </View>
  );
};

export default function BakimFormuDetay() {
  const [formDetay, setFormDetay] = useState<BakimFormuDetay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { id } = useLocalSearchParams();
  const router = useRouter();

  // Parametre isimlerinin listesi (arıza formundaki ile aynı)
  const parametreIsimleri = [
    { id: 'izgaralar', text: 'Izgaralar' },
    { id: 'dengeleme', text: 'Dengeleme' },
    { id: 'terfi_pompasi', text: 'Terfi Pompası' },
    { id: 'kalibrasyon_vanalari', text: 'Kalibrasyon Vanaları' },
    { id: 'reaktor_tanki', text: 'Reaktör Tankı' },
    { id: 'mekanik_karistiriciler', text: 'Mekanik Karıştırıcılar' },
    { id: 'blower', text: 'Blower' },
    { id: 'desarj_pompasi', text: 'Deşarj Pompası' },
    { id: 'camur_pompasi', text: 'Çamur Pompası' },
    { id: 'filtrepress_pompasi', text: 'Filtrepress Pompası' },
    { id: 'filtrepress', text: 'Filtrepress' },
    { id: 'suzuntu_pompasi', text: 'Süzüntü Pompası' },
    { id: 'boru_hatlari', text: 'Boru Hatları' },
    { id: 'vana_adedi', text: 'Vana Adedi' },
    { id: 'camur_kurutma_yatagi', text: 'Çamur Kurutma Yatağı' },
    { id: 'selenoid_valf', text: 'Selenoid Valf' },
    { id: 'torba_filtre', text: 'Torba Filtre' },
    { id: 'ph_metre', text: 'pH Metre' },
    { id: 'ph_probu', text: 'pH Probu' },
    { id: 'redox_metre', text: 'Redox Metre' },
    { id: 'redox_probu', text: 'Redox Probu' },
    { id: 'kumanda_panosu', text: 'Kumanda Panosu' },
  ];

  useEffect(() => {
    fetchBakimFormuDetay();
  }, []);

  const fetchBakimFormuDetay = async () => {
    try {
      const networkState = await NetInfo.fetch();
      
      if (networkState.isConnected) {
        // ✅ Online - API'den çek (varsayılan değer verme!)
        console.log('🌐 Online: API\'den form detayı çekiliyor...');
        const response = await api.get(`/api/bakim-formu-detay/${id}`);
        setFormDetay(response.data);
        console.log('✅ Online: Form detayı API\'den alındı');
      } else {
        // ✅ Offline - Cache'den çek ve eksik alanları doldur
        console.log('📴 Offline: Cache\'den bakım formu detayı aranıyor...');
        
        const allCompanies = await offlineStorage.getCachedCompanies();
        let formDetail = null;
  
        for (const company of allCompanies) {
          try {
            const forms = await offlineStorage.getCachedBakimGecmisi(company.company_id);
            formDetail = forms.find(form => form.id.toString() === id);
            if (formDetail) {
              console.log(`📴 Offline: Form detayı cache'den alındı (Firma: ${company.company_name})`);
              
              // ✅ SADECE OFFLINE'DA eksik alanları varsayılan değerlerle doldur
              formDetail = {
                ...formDetail,
                adres: formDetail.adres || 'Offline - Adres bilgisi mevcut değil',
                telefon: formDetail.telefon || 'Offline - Telefon bilgisi mevcut değil',
                servis_imza: formDetail.servis_imza || null,
                firma_imza: formDetail.firma_imza || null,
                calisan_ad: formDetail.calisan_ad || 'Bilinmiyor',
                calisan_soyad: formDetail.calisan_soyad || '',
                firma_yetkili_ad: formDetail.firma_yetkili_ad || 'Bilinmiyor',
                firma_yetkili_soyad: formDetail.firma_yetkili_soyad || ''
              };
              
              break;
            }
          } catch (error) {
            console.log(`⚠️ Firma ${company.company_id} cache'i kontrol edilemedi:`, error);
            continue;
          }
        }
        
        if (formDetail) {
          setFormDetay(formDetail);
        } else {
          setError('Offline modda form detayı bulunamadı. Bu form daha önce görüntülenmemiş olabilir.');
        }
      }
      setLoading(false);
    } catch (err: any) {
      console.error('Bakım formu detay hatası:', err);
      setError('Bakım formu detayları yüklenemedi: ' + (err.response?.data?.error || err.message));
      setLoading(false);
    }
  };

  // Tarih formatını düzenler
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      
      // Tarih geçerli mi kontrol et
      if (isNaN(date.getTime())) {
        return dateString;
      }
      
      return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    } catch (e) {
      return dateString;
    }
  };

  // Durum hücresini görüntüler
  const renderTableCell = (parametre: string, alan: string) => {
    const key = `${parametre}_${alan}`;
    const isSelected = formDetay?.[key] === true;
    const isError = alan.includes('arizali'); // Arızalı kontrolü
    
    return (
      <View 
        style={[
          styles.tableCell, 
          isSelected && (isError ? styles.tableCellSelectedError : styles.tableCellSelected)
        ]}
      />
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0088cc" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!formDetay) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Form bilgileri bulunamadı.</Text>
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
        <StatusBar
          barStyle="light-content"
          backgroundColor="#2C3E50"
          translucent
        />

     <LinearGradient 
           colors={['#2C3E50', '#34495E']} 
           style={styles.headerGradient}
         >
           <View style={styles.headerContent}>
             <Text style={styles.headerTitle}>Teknik Servis Formu</Text>
             <TouchableOpacity 
               style={styles.backButton}
               onPress={() => {
                 Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                 router.back();
               }}
             >
               <Ionicons name="arrow-back" size={24} color="white" />
             </TouchableOpacity>
           </View>
         </LinearGradient>

    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Image 
            source={require('../../assets/images/logo-white.png')} 
            style={styles.logo} 
          />
        </View>
        <View style={styles.formInfoContainer}>
          <Text style={styles.formTitle}>TEKNİK SERVİS FORMU</Text>
          <Text style={styles.formDate}>Tarih: {formatDate(formDetay.tarih)}</Text>
          <Text style={styles.formSeriNo}>Seri No: {formDetay.seri_no}</Text>
        </View>
      </View>

      <View style={styles.infoContainer}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Firmanın Adı:</Text>
          <Text style={styles.infoText}>{formDetay.firma_adi}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Adresi:</Text>
          <Text style={styles.infoText}>{formDetay.adres}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Tel:</Text>
          <Text style={styles.infoText}>{formDetay.telefon}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Arıtma Sisteminin Modeli:</Text>
          <Text style={styles.infoText}>{formDetay.model}</Text>
        </View>
      </View>

      {/* Kontrol Parametreleri Tablosu */}
      <View style={styles.kontrolTable}>
        {/* Tablo Başlığı */}
        <View style={styles.tableHeader}>
          <Text style={styles.tableHeaderTitle}>Kontrol Parametreleri</Text>
          <View style={styles.tableHeaderRow}>
            {/* Parametreler başlığı */}
            <View style={styles.parameterHeaderColumn}>
              <Text style={styles.parameterHeaderText}>Parametre</Text>
            </View>
            
            <View style={styles.columnsDivider} />
            
            {/* Mekanik başlıkları */}
            <View style={styles.columnsContainer}>
              <Text style={styles.categoryHeaderText}>Mekanik</Text>
              <View style={styles.statusHeaderRow}>
                <Text style={styles.statusHeaderText}>Çalışır</Text>
                <Text style={styles.statusHeaderText}>Arızalı</Text>
              </View>
            </View>
            
            <View style={styles.columnsDivider} />
            
            {/* Elektrikli başlıkları */}
            <View style={styles.columnsContainer}>
              <Text style={styles.categoryHeaderText}>Elektrikli</Text>
              <View style={styles.statusHeaderRow}>
                <Text style={styles.statusHeaderText}>Çalışır</Text>
                <Text style={styles.statusHeaderText}>Arızalı</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Tablo İçeriği */}
        <View style={styles.tableContent}>
          {parametreIsimleri.map((parametre, index) => (
            <View key={parametre.id} style={[
              styles.tableRow,
              index < parametreIsimleri.length - 1 && styles.tableRowBorder
            ]}>
              <Text style={styles.parameterText}>{parametre.text}</Text>
              <View style={styles.columnsDivider} />
              <View style={styles.checkboxGroup}>
                {renderTableCell(parametre.id, 'mekanik_calisir')}
                {renderTableCell(parametre.id, 'mekanik_arizali')}
              </View>
              <View style={styles.columnsDivider} />
              <View style={styles.checkboxGroup}>
                {renderTableCell(parametre.id, 'elektrikli_calisir')}
                {renderTableCell(parametre.id, 'elektrikli_arizali')}
              </View>
            </View>
          ))}
        </View>
      </View>


      {/* Numune ve Miktar Tablosu */}
      <View style={styles.sampleTable}>
        <View style={styles.sampleTableHeader}>
          <Text style={styles.sampleHeaderText}>Numune</Text>
          <Text style={styles.sampleHeaderText}>Birim</Text>
          <Text style={styles.sampleHeaderText}>Alınan Miktar</Text>
          <Text style={styles.sampleHeaderText}>Numune</Text>
          <Text style={styles.sampleHeaderText}>Birim</Text>
          <Text style={styles.sampleHeaderText}>Alınan Miktar</Text>
        </View>
        
        <View style={styles.sampleTableRow}>
          <Text style={styles.sampleRowText}>Giriş</Text>
          <Text style={styles.sampleValue}>{formDetay.giris_numune || 'Litre'}</Text>
          <Text style={styles.sampleValue}>{formDetay.giris_litre || '-'}</Text>
          <Text style={styles.sampleRowText}>Çıkış</Text>
          <Text style={styles.sampleValue}>{formDetay.cikis_numune || 'Litre'}</Text>
          <Text style={styles.sampleValue}>{formDetay.cikis_litre || '-'}</Text>
        </View>
      </View>

      {/* Açıklamalar Alanı */}
      <View style={styles.commentsContainer}>
        <Text style={styles.commentsHeader}>AÇIKLAMALAR:</Text>
        <Text style={styles.commentsText}>{formDetay.aciklamalar || 'Açıklama yok'}</Text>
      </View>

      {/* İmza Bölümü */}
      <View style={styles.imzalarHeader}>
        <Text style={styles.imzalarTitle}>İmzalar</Text>
      </View>

      <View style={styles.imzalarContainer}>
        <FormImzaGoruntule 
          imza={formDetay.firma_imza} 
          ad={formDetay.firma_yetkili_ad} 
          soyad={formDetay.firma_yetkili_soyad} 
          tip="firma" 
        />
        
        <FormImzaGoruntule 
          imza={formDetay.servis_imza} 
          ad={formDetay.calisan_ad} 
          soyad={formDetay.calisan_soyad} 
          tip="servis" 
        />
      </View>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#F5F9FF',
  },
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    paddingBottom: 10,
    paddingTop: 15,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    backgroundColor: 'white',
  },
  headerGradient: {
    paddingTop: STATUSBAR_HEIGHT + 10,
    paddingBottom: height * 0.02,
    paddingHorizontal: width * 0.05,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  backButton: {
    padding: 10,
  },
  logo: {
    width: 150,
    height: 80,
    resizeMode: 'contain',
  },
  formInfoContainer: {
    alignItems: 'flex-end',
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  formDate: {
    fontSize: 14,
    marginBottom: 3,
  },
  formSeriNo: {
    fontSize: 12,
    color: '#666',
  },
  infoContainer: {
    marginBottom: 15,
    paddingHorizontal: 15,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'center',
  },
  infoLabel: {
    width: 150,
    fontSize: 14,
    fontWeight: 'bold',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 5,
  },
  kontrolTable: {
    marginBottom: 15,
    marginHorizontal: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  tableHeader: {
    padding: 5,
    backgroundColor: '#f5f5f5',
  },
  tableHeaderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingTop: 5,
  },
  parameterHeaderColumn: {
    width: '40%',
    paddingLeft: 5,
  },
  parameterHeaderText: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'left',
  },
  columnsContainer: {
    flex: 1,
  },
  categoryHeaderText: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  statusHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statusHeaderText: {
    fontSize: 12,
    textAlign: 'center',
    width: '50%',
  },
  columnsDivider: {
    width: 1,
    backgroundColor: '#ddd',
    alignSelf: 'stretch',
  },
  tableContent: {
    // Tablo içeriği
  },
  tableRow: {
    flexDirection: 'row',
    minHeight: 30,
    alignItems: 'center',
    paddingVertical: 5,
  },
  tableRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  parameterText: {
    width: '40%',
    paddingLeft: 5,
    fontSize: 12,
  },
  checkboxGroup: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  tableCell: {
    width: '45%',
    height: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    margin: 2,
  },
  tableCellSelected: {
    backgroundColor: '#007BFF',
  },
  sampleTable: {
    marginBottom: 15,
    marginHorizontal: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  sampleTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    paddingVertical: 8,
  },
  sampleHeaderText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 'bold',
  },
  sampleTableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  sampleRowText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
  },
  sampleValue: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
  },
  commentsContainer: {
    marginBottom: 15,
    marginHorizontal: 15,
  },
  commentsHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  commentsText: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    fontSize: 14,
  },
  signatureContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    marginHorizontal: 15,
  },
  signatureColumn: {
    flex: 1,
    marginHorizontal: 5,
  },
  signatureTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  signatureBox: {
    height: 100,
    borderWidth: 1,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signatureImage: {
    width: '100%',
    height: '100%',
  },
  noSignatureText: {
    color: '#999',
    fontStyle: 'italic',
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 20,
  },
  nameInputContainer: {
    flexDirection: 'column',
    height: 100,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
  },
  imzalarHeader: {
    backgroundColor: '#f8f8f8',
    padding: 15,
    marginVertical: 10,
    marginHorizontal: 15,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#ddd',
  },
  imzalarTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  imzalarContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    marginBottom: 20,
  },
  imzaContainer: {
    width: '48%',
    alignItems: 'center',
  },
  imzaBaslik: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#555',
  },
  imzaBox: {
    width: '100%',
    height: 120,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: '#f9f9f9',
  },
  imzaImage: {
    width: '100%',
    height: '100%',
  },
  imzaYok: {
    width: '100%',
    height: 120,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    backgroundColor: '#f9f9f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imzaYokText: {
    color: '#888',
    fontStyle: 'italic',
  },
  imzaSahibi: {
    fontSize: 12,
    marginTop: 5,
    color: '#666',
  },
  tableCellSelectedError: {
    backgroundColor: '#dc3545', // Kırmızı (arızalı için)
  }
});