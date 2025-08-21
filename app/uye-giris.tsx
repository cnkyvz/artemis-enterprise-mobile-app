// app/uye-giris.tsx
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

import { registerForPushNotificationsAsync } from '../utils/pushNotifications';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../utils/enterpriseApi';
import { AxiosError } from 'axios';
import * as Haptics from 'expo-haptics';
import DeviceInfoManager from '../utils/deviceInfo';
import { enterpriseAuth } from '../utils/enterpriseApi';



// Get screen dimensions
const { width, height } = Dimensions.get('window');

export default function UyeGiris() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Animated values
  const emailFocus = useRef(new Animated.Value(0)).current;
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
  
    if (!email.trim() || !password.trim()) {
      Alert.alert("Uyarı", "E-posta ve şifre alanları boş bırakılamaz");
      return;
    }
  
    setLoading(true);
  
    try {
      console.log('🔐 Enterprise giriş başlatılıyor...');
      
      // Enterprise Auth sistemi kullan
      const authResponse = await enterpriseAuth.login({
        email,
        password
      }, 'company');
  
      console.log('✅ Enterprise giriş başarılı:', {
        tokenType: authResponse.systemInfo?.tokenType,
        sessionDuration: authResponse.systemInfo?.sessionDuration,
        autoLogout: authResponse.systemInfo?.autoLogout,
        // ✅ User data kontrolü ekle
        userData: authResponse.user
      });
      
      // ✅ User data kontrolü ekle
      if (!authResponse.user) {
        console.error('❌ Kullanıcı verileri eksik:', authResponse.user);
        Alert.alert('Hata', 'Giriş başarılı ama kullanıcı bilgileri alınamadı');
        return;
      }
  
      const companyId = authResponse.user.company_id || authResponse.user.id;
      if (!companyId) {
        console.error('❌ Company ID eksik:', authResponse.user);
        Alert.alert('Hata', 'Firma ID bilgisi alınamadı');
        return;
      }
      
      console.log('✅ Kullanıcı verileri doğrulandı:', {
        company_id: companyId,
        email: authResponse.user.email,
        company_name: authResponse.user.company_name
      });
  
      // ✅ Push notification token kaydet - companyId kullan
      const pushToken = await registerForPushNotificationsAsync();
      if (pushToken) {
        try {
          await api.post('/api/push-token-kaydet', {
            token: pushToken,
            user_id: companyId,    // ✅ DEĞİŞTİ
            company_id: companyId  // ✅ DEĞİŞTİ
          });
        } catch (pushError) {
          console.log('⚠️ Push token kaydedilemedi:', pushError.message);
        }
      }

      const backgroundSync = require('../artemis-api/utils/backgroundSync').default;
      backgroundSync.startupSync().catch(console.error);
  
      // Ana sayfaya yönlendir
      router.replace('/(tabs)');
  
    } catch (err) {
      console.error('❌ Enterprise giriş hatası:', err);
      
      const errorMessage = err.response?.data?.error || 
                          err.message || 
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
              style={styles.container}
            >
              {/* Geri butonu */}
              <TouchableOpacity 
                style={styles.backButton} 
                onPress={() => router.back()}
              >
                <Ionicons name="arrow-back" size={24} color="white" />
              </TouchableOpacity>
  
              {/* Expanded Background Circles */}
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
                  <Text style={styles.title}>Firma Girişi</Text>
  
                  <Animated.View 
                    style={[
                      styles.inputContainer, 
                      {
                        borderColor: emailFocus.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['rgba(255,255,255,0.2)', '#3498DB']
                        })
                      }
                    ]}
                  >
                    <Ionicons name="mail-outline" size={20} color="#fff" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="E-posta Adresiniz"
                      placeholderTextColor="rgba(255,255,255,0.5)"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={email}
                      onChangeText={setEmail}
                      onFocus={() => handleInputFocus(emailFocus)}
                      onBlur={() => handleInputBlur(emailFocus)}
                    />
                  </Animated.View>
  
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
  
                  <View style={styles.registerContainer}>
                    <Text style={styles.registerText}>Henüz hesabınız yok mu?</Text>
                    <TouchableOpacity onPress={() => router.push('/uye-ol')}>
                      <Text style={styles.registerLink}>Kayıt Ol</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </LinearGradient>
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
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: height * 0.02,
  },
  registerText: {
    color: 'rgba(255,255,255,0.7)',
    marginRight: 5,
  },
  registerLink: {
    color: '#3498DB',
    fontWeight: 'bold',
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30, // iOS ve Android için farklı konumlandırma
    left: 20,
    zIndex: 10, // Diğer elemanların üzerinde görünmesi için
  },
});