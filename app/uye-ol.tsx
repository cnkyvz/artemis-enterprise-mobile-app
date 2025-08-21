// app/uye-ol.tsx
import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Alert, 
  Animated,
  Easing,
  Dimensions,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import api from '../utils/enterpriseApi';
import * as Haptics from 'expo-haptics';

// Get screen dimensions
const { width, height } = Dimensions.get('window');

const UyeOlScreen = () => {
  const [companyName, setCompanyName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChecked, setIsChecked] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const normalizePhoneNumber = (input: string): string => {
    const digits = input.replace(/\D/g, '');
  
    if (digits.length === 10 && digits.startsWith('5')) {
      return '90' + digits;
    } else if (digits.length === 11 && digits.startsWith('0')) {
      return '9' + digits.substring(1);
    } else if (digits.startsWith('90') && digits.length === 12) {
      return digits;
    }
  
    return digits; // fallback
  };
  

  // Animated values for input focuses
  const companyNameFocus = useRef(new Animated.Value(0)).current;
  const phoneNumberFocus = useRef(new Animated.Value(0)).current;
  const addressFocus = useRef(new Animated.Value(0)).current;
  const emailFocus = useRef(new Animated.Value(0)).current;
  const passwordFocus = useRef(new Animated.Value(0)).current;
  const confirmPasswordFocus = useRef(new Animated.Value(0)).current;
  const registerButtonScale = useRef(new Animated.Value(1)).current;

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
    Animated.spring(registerButtonScale, {
      toValue: 0.95,
      friction: 3,
      tension: 40,
      useNativeDriver: true
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(registerButtonScale, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true
    }).start();
  };

  

  const handleRegister = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  
    if (!companyName || !phoneNumber || !address || !email || !password || !confirmPassword || !isChecked) {
      Alert.alert("Hata", "Lütfen tüm alanları doldurun ve şartları kabul edin.");
      return;
    }
  
    if (password.length < 8) {
      Alert.alert("Hata", "Şifreniz en az 8 karakter olmalıdır.");
      return;
    }
  
    if (password !== confirmPassword) {
      Alert.alert("Hata", "Şifreler eşleşmiyor.");
      return;
    }
  
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
  
    try {
      const response = await api.post('/api/companies', {
        company_name: companyName,
        phone_number: normalizedPhone,
        address,
        email,
        form_no: '',
        password
      });
  
      Alert.alert("Başarılı", "Kayıt işleminiz tamamlandı!");
      setCompanyName('');
      setPhoneNumber('');
      setAddress('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setIsChecked(false);
      router.push('/uye-giris');
  
    } catch (error) {
      console.error('Tam hata detayı:', error);
      if (error.response) {
        Alert.alert("Hata", error.response.data?.error || "Kayıt sırasında bir hata oluştu.");
      } else {
        Alert.alert("Hata", "Sunucuya bağlanılamadı.");
      }
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

        {/* Animated Background Circles */}
        <View style={styles.backgroundCircle1} />
        <View style={styles.backgroundCircle2} />

        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentWrapper}>
            <View style={styles.formContainer}>
              <Text style={styles.title}>Firma Kayıt</Text>

              {/* Şirket Input */}
              <Animated.View 
              style={[
                styles.inputContainer, 
                {
                  borderColor: companyNameFocus.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['rgba(255,255,255,0.2)', '#3498DB']
                  })
                }
              ]}
            >
              <Ionicons name="business-outline" size={20} color="#fff" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Şirket Adı"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={companyName}
                onChangeText={setCompanyName}
                onFocus={() => handleInputFocus(companyNameFocus)}
                onBlur={() => handleInputBlur(companyNameFocus)}
              />
            </Animated.View>

              {/* Telefon Input */}
              <Animated.View 
              style={[
                styles.inputContainer, 
                {
                  borderColor: phoneNumberFocus.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['rgba(255,255,255,0.2)', '#3498DB']
                  })
                }
              ]}
            >
              <Ionicons name="call-outline" size={20} color="#fff" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Telefon Numarası"
                placeholderTextColor="rgba(255,255,255,0.5)"
                keyboardType="phone-pad"
                maxLength={11}
                value={phoneNumber}
                onChangeText={(text) => {
                  const formattedText = text.replace(/[^0-9]/g, '');
                  setPhoneNumber(formattedText);
                }}
                onFocus={() => handleInputFocus(phoneNumberFocus)}
                onBlur={() => handleInputBlur(phoneNumberFocus)}
              />
            </Animated.View>

            {/* Adres Input */}
            <Animated.View 
              style={[
                styles.inputContainer, 
                {
                  borderColor: addressFocus.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['rgba(255,255,255,0.2)', '#3498DB']
                  })
                }
              ]}
            >
              <Ionicons name="location-outline" size={20} color="#fff" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Adres"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={address}
                onChangeText={setAddress}
                onFocus={() => handleInputFocus(addressFocus)}
                onBlur={() => handleInputBlur(addressFocus)}
              />
            </Animated.View>

              {/* Email Input */}
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
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => handleInputFocus(emailFocus)}
                  onBlur={() => handleInputBlur(emailFocus)}
                />
              </Animated.View>

              {/* Şifre Input */}
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
                  placeholder="Şifre (En az 8 karakter)"
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

              {/* Şifre Tekrar Input */}
              <Animated.View 
                style={[
                  styles.inputContainer, 
                  {
                    borderColor: confirmPasswordFocus.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['rgba(255,255,255,0.2)', '#3498DB']
                    })
                  }
                ]}
              >
                <Ionicons name="lock-closed-outline" size={20} color="#fff" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Şifre Tekrar"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  onFocus={() => handleInputFocus(confirmPasswordFocus)}
                  onBlur={() => handleInputBlur(confirmPasswordFocus)}
                />
                <TouchableOpacity 
                  onPress={() => {
                    setShowConfirmPassword(!showConfirmPassword);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }} 
                  style={styles.passwordToggle}
                >
                  <Ionicons 
                    name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} 
                    size={20} 
                    color="white" 
                  />
                </TouchableOpacity>
              </Animated.View>

              {/* Checkbox */}
              <TouchableOpacity 
                style={styles.checkboxContainer} 
                onPress={() => {
                  setIsChecked(!isChecked);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Ionicons
                  name={isChecked ? 'checkbox' : 'square-outline'}
                  size={24}
                  color="#3498DB"
                />
                <Text style={styles.checkboxText}>
                  Kullanım koşullarını ve gizlilik politikasını kabul ediyorum
                </Text>
              </TouchableOpacity>

              {/* Register Button */}
              <Animated.View style={{ transform: [{ scale: registerButtonScale }] }}>
                <TouchableOpacity 
                  style={styles.registerButton} 
                  onPress={handleRegister}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                >
                  <LinearGradient
                    colors={['#3498DB', '#2980B9']}
                    style={styles.registerButtonGradient}
                  >
                    <Text style={styles.registerButtonText}>Kayıt Ol</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>

              {/* Login Link */}
              <View style={styles.loginContainer}>
                <Text style={styles.loginText}>Zaten bir hesabınız var mı?</Text>
                <TouchableOpacity onPress={() => router.push('/uye-giris')}>
                  <Text style={styles.loginLink}>Giriş Yapın</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: height * 0.05, // Dikey padding ekledik
  },
  contentWrapper: {
    width: width,
    paddingHorizontal: width * 0.05,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
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
  formContainer: {
    width: '100%',
    maxWidth: 500,
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
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: height * 0.02,
  },
  checkboxText: {
    marginLeft: 10,
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    flex: 1,
  },
  registerButton: {
    borderRadius: 15,
    overflow: 'hidden',
    marginTop: height * 0.01,
  },
  registerButtonGradient: {
    paddingVertical: height * 0.02,
    alignItems: 'center',
    borderRadius: 15,
  },
  registerButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: height * 0.02,
  },
  loginText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginRight: 5,
  },
  loginLink: {
    color: '#3498DB',
    fontWeight: 'bold',
    fontSize: 14,
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30, // iOS ve Android için farklı konumlandırma
    left: 20,
    zIndex: 10, // Diğer elemanların üzerinde görünmesi için
  },
});

export default UyeOlScreen;