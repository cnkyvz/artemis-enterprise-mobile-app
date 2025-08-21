// components/VerificationCodeModal.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform, // WEB: Platform import eklendi
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface VerificationCodeModalProps {
  visible: boolean;
  phoneNumber: string;
  onClose: () => void;
  onVerify: (code: string) => Promise<boolean>;
  onResend: () => Promise<void>;
}

// WEB: Platform bazlı alert fonksiyonu eklendi
const platformAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    // WEB: Web için standart browser alert
    window.alert(message);
  } else {
    // Native platformlar için React Native Alert
    Alert.alert(title, message);
  }
};

const VerificationCodeModal: React.FC<VerificationCodeModalProps> = ({
  visible,
  phoneNumber,
  onClose,
  onVerify,
  onResend,
}) => {
  const [code, setCode] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [resendLoading, setResendLoading] = useState<boolean>(false);
  const [timer, setTimer] = useState<number>(60);
  const [timerActive, setTimerActive] = useState<boolean>(true);
  const inputRefs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (timerActive && timer > 0) {
      interval = setInterval(() => {
        setTimer((prevTimer) => prevTimer - 1);
      }, 1000);
    } else if (timer === 0) {
      setTimerActive(false);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timer, timerActive]);

  const handleVerify = async () => {
    if (code.length !== 6) {
      // WEB: Alert yerine platform bazlı alert kullanıldı
      platformAlert('Hata', 'Lütfen 6 haneli doğrulama kodunu girin.');
      return;
    }
    
    setLoading(true);
    
    try {
      const success = await onVerify(code);
      
      if (success) {
        setCode('');
        onClose();
      }
    } catch (error) {
      console.error('Doğrulama hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendLoading(true);
    
    try {
      await onResend();
      setTimer(60);
      setTimerActive(true);
      // WEB: Alert yerine platform bazlı alert kullanıldı
      platformAlert('Başarılı', 'Yeni doğrulama kodu gönderildi.');
    } catch (error) {
      console.error('Yeniden gönderme hatası:', error);
      // WEB: Alert yerine platform bazlı alert kullanıldı
      platformAlert('Hata', 'Doğrulama kodu gönderilemedi.');
    } finally {
      setResendLoading(false);
    }
  };

  // WEB: Telefon numarası formatı web için de aynı kalacak
  const formatPhoneNumber = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
  
    if (digits.startsWith('90') && digits.length === 12) {
      return `+90 ${digits.substring(2, 5)} ${digits.substring(5, 8)} ${digits.substring(8, 10)} ${digits.substring(10, 12)}`;
    } else if (digits.length === 11 && digits.startsWith('0')) {
      return `${digits.substring(0, 4)} ${digits.substring(4, 7)} ${digits.substring(7, 9)} ${digits.substring(9, 11)}`;
    } else if (digits.length === 10) {
      return `0${digits.substring(0, 3)} ${digits.substring(3, 6)} ${digits.substring(6, 8)} ${digits.substring(8, 10)}`;
    }
  
    return phone;
  };
  

  return (
    // WEB: Modal bileşeni aynen kalacak, platform farkı gözetilmeyecek
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Telefon Doğrulama</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.modalBody}>
            <Text style={styles.modalDescription}>
              <Text style={styles.phoneNumber}>{formatPhoneNumber(phoneNumber)}</Text> numaralı telefona gönderilen 6 haneli doğrulama kodunu girin:
            </Text>
            
            <View style={styles.codeInputContainer}>
              <TextInput
                style={styles.codeInput}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="_ _ _ _ _ _"
                placeholderTextColor="#aaa"
                autoFocus={true}
              />
            </View>
            
            <TouchableOpacity
              style={[styles.verifyButton, loading && styles.disabledButton]}
              onPress={handleVerify}
              disabled={loading || code.length !== 6}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.verifyButtonText}>Doğrula</Text>
              )}
            </TouchableOpacity>
            
            <View style={styles.resendContainer}>
              {timerActive ? (
                <Text style={styles.timerText}>
                  Yeni kod gönderimi için: {timer} saniye
                </Text>
              ) : (
                <TouchableOpacity
                  style={styles.resendButton}
                  onPress={handleResend}
                  disabled={resendLoading || timerActive}
                >
                  {resendLoading ? (
                    <ActivityIndicator color="#0088cc" size="small" />
                  ) : (
                    <Text style={styles.resendButtonText}>Kodu Tekrar Gönder</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};


const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: 'white',
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  modalBody: {
    padding: 20,
  },
  modalDescription: {
    fontSize: 14,
    color: '#555',
    marginBottom: 20,
    textAlign: 'center',
  },
  phoneNumber: {
    fontWeight: 'bold',
    color: '#333',
  },
  codeInputContainer: {
    marginVertical: 15,
    alignItems: 'center',
  },
  codeInput: {
    width: '100%',
    height: 50,
    fontSize: 24,
    letterSpacing: 10,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 20,
  },
  verifyButton: {
    backgroundColor: '#0088cc',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
  },
  disabledButton: {
    opacity: 0.7,
  },
  verifyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  timerText: {
    color: '#666',
    fontSize: 14,
  },
  resendButton: {
    padding: 10,
  },
  resendButtonText: {
    color: '#0088cc',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default VerificationCodeModal;   