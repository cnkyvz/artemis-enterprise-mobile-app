// app/profil.tsx
import React, { useState, useEffect } from 'react';
import {
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert,
  StatusBar,
  Platform,
  Dimensions,
  ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../utils/enterpriseApi';
import EnterpriseTokenManager from '../utils/enterpriseTokenManager';

const { width, height } = Dimensions.get('window');

// StatusBar yüksekliğini hesapla
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

export default function Profil() {
  const router = useRouter();

  // Kullanıcı bilgileri state'leri
  const [userData, setUserData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Form state'leri
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      console.log('🔍 Profil user data alınıyor...');
      
      let userData = null;
      
      // ✅ 1. Önce Enterprise sistemden dene
      const hasEnterpriseToken = await EnterpriseTokenManager.hasValidToken();
      if (hasEnterpriseToken) {
        userData = await EnterpriseTokenManager.getUserData();
        console.log('✅ Enterprise user data alındı:', userData);
      }
      
      // ✅ 2. Fallback: Legacy sistem
      if (!userData) {
        console.log('⚠️ Enterprise data yok, legacy sistemi deneniyor...');
        const storedUserData = await AsyncStorage.getItem('userData');
        if (storedUserData && storedUserData !== 'null') {
          userData = JSON.parse(storedUserData);
          console.log('✅ Legacy user data alındı:', userData);
        }
      }
      
      // ✅ 3. User data varsa state'leri doldur
      if (userData) {
        setUserData(userData);
        
        console.log('👤 User rol:', userData.rol);
        console.log('👤 User type:', userData.userType);
        
        // Çalışan (rol = 1 veya userType = 'employee')
        if (userData.rol === 1 || userData.userType === 'employee') {
          console.log('👷 Çalışan profili yükleniyor...');
          setName(userData.ad || '');
          setSurname(userData.soyad || '');
          setEmail(userData.email || '');
          setPhoneNumber(userData.telefon_no || '');
          setAddress(userData.adres || '');
        } 
        // Firma (rol = 2 veya userType = 'company')
        else if (userData.rol === 2 || userData.userType === 'company') {
          console.log('🏢 Firma profili yükleniyor...');
          setCompanyName(userData.company_name || '');
          setEmail(userData.email || '');
          setPhoneNumber(userData.phone_number || '');
          setAddress(userData.address || '');
        }
        
        console.log('✅ Profil alanları dolduruldu');
      } else {
        console.log('❌ Hiç user data bulunamadı');
        Alert.alert('Hata', 'Kullanıcı bilgileri bulunamadı');
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('❌ Kullanıcı verisi çekilirken hata:', error);
      setIsLoading(false);
      Alert.alert('Hata', 'Kullanıcı bilgileri yüklenemedi');
    }
  };

  const hapticFeedback = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Doğrulama kodu gönderme
  const sendVerificationCode = async () => {
    hapticFeedback();
    try {
      let userData = null;
      let userEmail = '';
      
      // ✅ Enterprise sistemden user data al
      const hasEnterpriseToken = await EnterpriseTokenManager.hasValidToken();
      if (hasEnterpriseToken) {
        userData = await EnterpriseTokenManager.getUserData();
        userEmail = userData?.email || '';
      }
      
      // Fallback: Legacy sistem
      if (!userData) {
        const storedUserData = await AsyncStorage.getItem('userData');
        if (storedUserData && storedUserData !== 'null') {
          userData = JSON.parse(storedUserData);
          userEmail = userData?.email || '';
        }
      }
      
      // Form'dan email kullan (eğer değiştirilmişse)
      if (!userEmail) {
        userEmail = email;
      }
      
      if (!userEmail) {
        Alert.alert('Hata', 'E-posta adresi bulunamadı');
        return;
      }
  
      console.log('📧 Doğrulama Kodu Gönderilen Email:', userEmail);
  
      const response = await api.post('/api/send-verification-code', { 
        email: userEmail 
      });
  
      console.log('✅ Doğrulama Kodu Yanıtı:', response.data);
  
      // Temp token'ı saklayın
      await AsyncStorage.setItem('tempToken', response.data.tempToken);
  
      Alert.alert(
        "Doğrulama Kodu", 
        `E-posta adresinize (${userEmail}) 6 haneli doğrulama kodu gönderildi.`
      );
      
      setVerificationSent(true);
      console.log("✅ verificationSent SET edildi");
    } catch (error) {
      console.error('❌ Doğrulama kodu gönderme hatası:', error);
  
      const errorMessage = error.response 
        ? error.response.data.error || 'Bilinmeyen bir hata oluştu' 
        : error.message || 'Sunucuyla bağlantı kurulamadı';
  
      Alert.alert('Hata', errorMessage);
    }
  };


// Şifre değiştirme işlemi
const handlePasswordChange = async () => {
  hapticFeedback();
  
  if (verificationCode.length !== 6) {
    Alert.alert("Hata", "Lütfen geçerli bir doğrulama kodu girin.");
    return;
  }

  if (!newPassword.trim()) {
    Alert.alert("Hata", "Lütfen yeni şifrenizi girin.");
    return;
  }

  // Şifre karmaşıklık kontrolü
  if (newPassword.length < 8) {
    Alert.alert("Hata", "Şifreniz en az 8 karakter uzunluğunda olmalıdır.");
    return;
  }

  try {
    // Temp token'ı al
    const tempToken = await AsyncStorage.getItem('tempToken');

    const response = await api.post('/api/change-password', {
      verificationCode,
      newPassword,
      tempToken
    });

    Alert.alert("Başarılı", "Şifreniz başarıyla değiştirildi!");
    
    // Geçici token'ı temizle
    await AsyncStorage.removeItem('tempToken');
    
    // State'leri sıfırla
    setVerificationCode('');
    setNewPassword('');
    setVerificationSent(false);
  } catch (error) {
    console.error('Şifre değişikliği hatası:', error);
    Alert.alert(
      'Hata', 
      error.response?.data?.error || 'Şifre değişikliği yapılamadı'
    );
  }
};

// Profil güncelleme
const handleProfileUpdate = async () => {
  hapticFeedback();
  try {
    // Kullanıcı verilerini AsyncStorage'den al
    const storedUserData = await AsyncStorage.getItem('userData');
    const userToken = await AsyncStorage.getItem('userToken');
    
    if (!storedUserData || !userToken) {
      Alert.alert('Hata', 'Kullanıcı bilgileri veya token bulunamadı');
      return;
    }
 
    const parsedUserData = JSON.parse(storedUserData);
 
    // Rol'e göre farklı güncelleme işlemi
    if (parsedUserData.rol === 2) {
      // Şirket güncelleme
      const updateData = {
        company_name: companyName,
        email: email,
        phone_number: phoneNumber,
        address: address
      };
 
      try {
        const response = await api.put('/api/companies/update', updateData);
        
        if (response.data) {
          // Başarılı güncelleme durumunda AsyncStorage'i de güncelle
          const updatedUserData = {
            ...parsedUserData,
            company_name: companyName,
            email: email,
            phone_number: phoneNumber,
            address: address
          };
 
          await AsyncStorage.setItem('userData', JSON.stringify(updatedUserData));
 
          Alert.alert("Başarılı", "Profil bilgileriniz güncellendi.");
        }
      } catch (error) {
        console.error('Şirket Güncelleme Hatası:', error.response?.data);
        Alert.alert(
          'Güncelleme Hatası', 
          error.response?.data?.error || 'Şirket bilgileri güncellenemedi'
        );
      }
    } else if (parsedUserData.rol === 1) {
      // Çalışan güncelleme
      const updateData = {
        ad: name,
        soyad: surname,
        email: email
      };
 
      try {
        const response = await api.put('/api/calisanlar/update', updateData);
        
        if (response.data) {
          // Başarılı güncelleme durumunda AsyncStorage'i de güncelle
          const updatedUserData = {
            ...parsedUserData,
            ad: name,
            soyad: surname,
            email: email
          };
 
          await AsyncStorage.setItem('userData', JSON.stringify(updatedUserData));
 
          Alert.alert("Başarılı", "Profil bilgileriniz güncellendi.");
        }
      } catch (error) {
        console.error('Çalışan Güncelleme Hatası:', error.response?.data);
        Alert.alert(
          'Güncelleme Hatası', 
          error.response?.data?.error || 'Çalışan bilgileri güncellenemedi'
        );
      }
    }
  } catch (error) {
    console.error('Profil Güncelleme Genel Hatası:', error);
    Alert.alert('Hata', 'Profil güncellenemedi');
  }
 };
 
 if (isLoading || !userData) {
  return (
    <View style={styles.loadingContainer}>
      <Text>Yükleniyor...</Text>
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
          <Text style={styles.headerTitle}>Profil Bilgileri</Text>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => {
              hapticFeedback();
              router.back();
            }}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileIconContainer}>
          <View style={styles.profileIcon}>
            <Text style={styles.profileInitials}>
              {userData?.rol === 1 
                ? (name ? name.charAt(0) : '') 
                : (companyName ? companyName.charAt(0) : '')}
            </Text>
          </View>
          <Text style={styles.welcomeText}>
            {userData?.rol === 1 
              ? `Hoşgeldiniz, ${name} ${surname}` 
              : `Hoşgeldiniz, ${companyName}`}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Kişisel Bilgiler</Text>
          
          {userData?.rol === 1 ? (
            // Çalışan (Personel) Bilgileri
            <>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Adres</Text>
                <View style={[styles.inputContainer, styles.addressInputContainer]}>
                  <Ionicons name="location" size={20} color="#777" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, styles.addressInput]}
                    value={address}
                    onChangeText={setAddress}
                    multiline={true}
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Soyad</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="person" size={20} color="#777" style={styles.inputIcon} />
                  <TextInput 
                    style={styles.input}
                    value={surname}
                    onChangeText={setSurname}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>E-Posta</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="mail" size={20} color="#777" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                  />
                </View>
              </View>
            </>
          ) : (
            // Şirket Bilgileri
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Şirket Adı</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="business" size={20} color="#777" style={styles.inputIcon} />
                  <TextInput 
                    style={styles.input}
                    value={companyName}
                    onChangeText={setCompanyName}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Telefon</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="call" size={20} color="#777" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Adres</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="location" size={20} color="#777" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={address}
                    onChangeText={setAddress}
                    multiline={true}
                    numberOfLines={2}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>E-Posta</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="mail" size={20} color="#777" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                  />
                </View>
              </View>
            </>
          )}
        </View>

        <View style={styles.card}>
  <Text style={styles.cardTitle}>Güvenlik Ayarları</Text>

  <TouchableOpacity 
    style={styles.verifyButton} 
    onPress={sendVerificationCode}
  >
    <Ionicons name="lock-closed" size={20} color="white" style={{marginRight: 10}} />
    <Text style={styles.verifyButtonText}>Şifreyi Değiştir</Text>
  </TouchableOpacity>
</View>

{verificationSent && (
  <View style={styles.card}>
    <View style={styles.verificationContainer}>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Doğrulama Kodu</Text>
        <View style={styles.inputContainer}>
          <Ionicons name="key" size={20} color="#777" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="6 Haneli Kodu Girin"
            keyboardType="numeric"
            value={verificationCode}
            onChangeText={setVerificationCode}
            maxLength={6}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Yeni Şifre</Text>
        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed" size={20} color="#777" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Yeni Şifrenizi Girin"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
          />
        </View>
      </View>

      <TouchableOpacity 
        style={styles.changePasswordButton} 
        onPress={handlePasswordChange}
      >
        <Ionicons name="checkmark-circle" size={20} color="white" style={{marginRight: 10}} />
        <Text style={styles.changePasswordButtonText}>Şifreyi Güncelle</Text>
      </TouchableOpacity>
    </View>
  </View>
)}


        <TouchableOpacity 
          style={styles.saveButton}
          onPress={handleProfileUpdate}
        >
          <Text style={styles.saveButtonText}>BİLGİLERİ GÜNCELLE</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#F5F9FF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    padding: 15,
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
  profileIconContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  profileIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1E88E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  profileInitials: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
  },
  welcomeText: {
    fontSize: 18,
    color: '#333',
    fontWeight: '500',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 10,
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
    color: '#555',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 10,
    backgroundColor: '#FAFAFA',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 45,
    fontSize: 16,
    color: '#333',
  },
  verifyButton: {
    backgroundColor: '#FFA726',
    flexDirection: 'row',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  verificationContainer: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#FFA726',
  },
  changePasswordButton: {
    backgroundColor: '#28A745',
    flexDirection: 'row',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
  },
  changePasswordButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#1E88E5',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginVertical: 10,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // styles içine eklenen yeni stiller
  addressInputContainer: {
    minHeight: 100,
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  addressInput: {
    height: 80,
    textAlignVertical: 'top',
  }
});