// app/calisan-giris.tsx
import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  Animated,
  Easing,
  Dimensions
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router'; 
import api from '../utils/enterpriseApi';
import * as Haptics from 'expo-haptics';
import DeviceInfoManager from '../utils/deviceInfo';
import { enterpriseAuth } from '../utils/enterpriseApi';
import appStateMonitor from '../utils/appStateMonitor';



// Get screen dimensions
const { width, height } = Dimensions.get('window');

export default function CalisanGiris() {
  const [personelId, setPersonelId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Animated values
  const personelIdFocus = useRef(new Animated.Value(0)).current;
  const passwordFocus = useRef(new Animated.Value(0)).current;
  const loginButtonScale = useRef(new Animated.Value(1)).current;


  // Focus animation
  const handleInputFocus = (animatedValue: Animated.Value) => {
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 200,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false
    }).start();
  };

  const handleInputBlur = (animatedValue: Animated.Value) => {
    Animated.timing(animatedValue, {
      toValue: 0,
      duration: 200,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false
    }).start();
  };

  // Button press animation
  const handlePressIn = () => {
    Animated.spring(loginButtonScale, {
      toValue: 0.95,
      friction: 3,
      tension: 40,
      useNativeDriver: true
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(loginButtonScale, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true
    }).start();
  };



  const handleLogin = async () => {
    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  
    // Basit doğrulama
    if (!personelId.trim() || !password.trim()) {
      Alert.alert("Uyarı", "Personel ID ve şifre alanları boş bırakılamaz");
      return;
    }
    
    setLoading(true);
    
    try {
      console.log('🔐 Enterprise çalışan girişi başlatılıyor...');
      
      // Enterprise Auth sistemi kullan
      const authResponse = await enterpriseAuth.login({
        personel_id: personelId,
        password: password
      }, 'employee');
  
      // ✅ App State Monitor'ü başlat - handleLogin içinde
      console.log('✅ Enterprise çalışan girişi başarılı:', {
        personel_id: authResponse.employee?.personel_id,
        tokenType: authResponse.systemInfo?.tokenType,
        sessionDuration: authResponse.systemInfo?.sessionDuration
      });

      // ✅ App State Monitor'ü başlat
      appStateMonitor.start();
      console.log('✅ App State Monitor başlatıldı');

      const backgroundSync = require('../artemis-api/utils/backgroundSync').default;
      backgroundSync.startupSync().catch(console.error);
      console.log('✅ Background sync başlatıldı');

      // UserType kaydetme ve role kontrolü
      if (authResponse.employee) {
        const updatedEmployeeData = {
          ...authResponse.employee,
          userType: 'employee' as const
        };
        
        try {
          await AsyncStorage.setItem('userData', JSON.stringify(updatedEmployeeData));
          console.log('✅ UserType bilgisi kaydedildi');
        } catch (storageError) {
          console.warn('⚠️ UserData storage warning:', storageError);
        }

        // Role kontrolü
        console.log('🎯 Role kontrolü:', authResponse.employee.rol);

        if (authResponse.employee.rol === 1) {
          console.log('➡️ Teknisyen paneline yönlendiriliyor');
          router.replace('/teknisyen-panel');
        } else if (authResponse.employee.rol === 2) {
          console.log('➡️ Üye paneline yönlendiriliyor');  
          router.replace('/uye-panel');
        } else {
          console.log('❌ Bilinmeyen rol, ana sayfaya yönlendiriliyor');
          router.replace('/');
        }
      } else {
        console.log('❌ Employee data bulunamadı');
        router.replace('/');
      }
  
    } catch (error) {
      console.error('❌ Enterprise çalışan giriş hatası:', error);
      
      const errorMessage = error.response?.data?.error || 
                          error.message || 
                          "Bağlantı hatası. Lütfen internet bağlantınızı kontrol edin.";
      
      Alert.alert("Giriş Hatası", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <LinearGradient
        colors={['#2C3E50', '#34495E', '#2980B9']}
        style={[styles.container, { position: 'absolute', width: '100%', height: '100%' }]}
      />
  
      {/* Geri butonu */}
      <TouchableOpacity 
        style={styles.backButton} 
        onPress={() => router.back()}
      >
        <Ionicons name="arrow-back" size={24} color="white" />
      </TouchableOpacity>
  
      {/* Dekoratif arka plan daireler */}
      <View style={styles.backgroundCircle1} />
      <View style={styles.backgroundCircle2} />
  
      <View style={styles.contentWrapper}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../assets/images/logo-whitee.png')}
            style={styles.logo}
          />
        </View>
  
        <View style={styles.formContainer}>
          <Text style={styles.title}>Çalışan Girişi</Text>
  
          {/* Personel ID input */}
          <Animated.View 
            style={[
              styles.inputContainer, 
              {
                borderColor: personelIdFocus.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['rgba(255,255,255,0.2)', '#3498DB']
                })
              }
            ]}
          >
            <Ionicons name="id-card-outline" size={20} color="#fff" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Personel ID"
              placeholderTextColor="rgba(255,255,255,0.5)"
              keyboardType="numeric"
              autoCapitalize="none"
              value={personelId}
              onChangeText={setPersonelId}
              onFocus={() => handleInputFocus(personelIdFocus)}
              onBlur={() => handleInputBlur(personelIdFocus)}
            />
          </Animated.View>
  
          {/* Şifre input */}
          <Animated.View 
            style={[
              styles.inputContainer, 
              {
                borderColor: passwordFocus.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['rgba(255,255,255,0.2)', '#3498DB']
                })
              }
            ]}
          >
            <Ionicons name="lock-closed-outline" size={20} color="#fff" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Şifreniz"
              placeholderTextColor="rgba(255,255,255,0.5)"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              onFocus={() => handleInputFocus(passwordFocus)}
              onBlur={() => handleInputBlur(passwordFocus)}
            />
            <TouchableOpacity 
              onPress={() => {
                setShowPassword(!showPassword);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }} 
              style={styles.passwordToggle}
            >
              <Ionicons 
                name={showPassword ? 'eye-off-outline' : 'eye-outline'} 
                size={20} 
                color="white" 
              />
            </TouchableOpacity>
          </Animated.View>
  
          <TouchableOpacity style={styles.forgotPassword}>
            <Text style={styles.forgotPasswordText}>Şifremi Unuttum</Text>
          </TouchableOpacity>
  
          {/* Giriş butonu */}
          <Animated.View style={{ transform: [{ scale: loginButtonScale }] }}>
            <TouchableOpacity 
              style={[styles.loginButton, loading && styles.disabledButton]} 
              onPress={handleLogin}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              disabled={loading}
            >
              <LinearGradient
                colors={['#3498DB', '#2980B9']}
                style={styles.loginButtonGradient}
              >
                <Text style={styles.loginButtonText}>
                  {loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
  
  
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  cardWrapper: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  
  contentWrapper: {
    width: width, // Full screen width
    paddingHorizontal: width * 0.05, // 5% padding on both sides
    alignItems: 'center',
    justifyContent: 'center',
  },
  backgroundCircle1: {
    position: 'absolute',
    top: -width * 0.3,
    left: -width * 0.2,
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
  },
  backgroundCircle2: {
    position: 'absolute',
    bottom: -width * 0.3,
    right: -width * 0.2,
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    backgroundColor: 'rgba(41, 128, 185, 0.2)',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: height * 0.04,
  },
  logo: {
    width: width * 0.6,
    height: height * 0.1,
    resizeMode: 'contain',
  },
  formContainer: {
    width: '100%',
    maxWidth: 500, // Increased max width
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: width * 0.06,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: height * 0.03,
    letterSpacing: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 15,
    marginBottom: height * 0.02,
    paddingHorizontal: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  input: {
    flex: 1,
    height: height * 0.06,
    fontSize: 16,
    color: 'white',
  },
  inputIcon: {
    marginRight: 10,
  },
  passwordToggle: {
    padding: 10,
  },
  forgotPassword: {
    alignItems: 'flex-end',
    marginBottom: height * 0.02,
  },
  forgotPasswordText: {
    color: '#3498DB',
    fontWeight: '600',
  },
  loginButton: {
    borderRadius: 15,
    overflow: 'hidden',
  },
  disabledButton: {
    opacity: 0.7,
  },
  loginButtonGradient: {
    paddingVertical: height * 0.02,
    alignItems: 'center',
    borderRadius: 15,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30, // iOS ve Android için farklı konumlandırma
    left: 20,
    zIndex: 10, // Diğer elemanların üzerinde görünmesi için
  },
});