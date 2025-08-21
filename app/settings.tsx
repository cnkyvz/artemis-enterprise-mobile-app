// app/settings.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../utils/enterpriseApi'; // axios yerine bunu kullan

type UserRole = 1 | 2;

export default function SettingsScreen() {
    const router = useRouter();
    const [userRole, setUserRole] = useState<UserRole>(2);
    const [isLoading, setIsLoading] = useState(true);

    const fetchUserRole = useCallback(async () => {
        try {
          const token = await AsyncStorage.getItem('userToken');
      
          if (!token) {
            throw new Error('Token bulunamadı');
          }
      
          const response = await api.get('/api/user/role', {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
      
          setUserRole(response.data.role);
        } catch (error) {
          console.error('Rol alma hatası:', error);
          setUserRole(2);
        } finally {
          setIsLoading(false);
        }
      }, []);
      

    // ✅ useEffect kısmı sadece doğru fonksiyonu çağırmalı
    useEffect(() => {
    fetchUserRole();
}, [fetchUserRole]);


    const handleCall = () => {
        Linking.openURL("tel:+905555555555");
    };

    const handleLogout = async () => {
        try {
            // Token'ı sil
            await AsyncStorage.removeItem('userToken');
            // Giriş ekranına yönlendir
            router.replace('/calisan-giris');
        } catch (error) {
            console.error('Çıkış yapılırken hata:', error);
            Alert.alert('Hata', 'Çıkış yapılamadı');
        }
    };

    // Conditional rendering of Arıza Formu based on user role
    const showArizaFormu = userRole === 1;

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <Text>Yükleniyor...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Cihaz Ayarları</Text>

                <TouchableOpacity style={styles.settingItem}>
                    <View style={styles.settingLeft}>
                        <Ionicons name="wifi-outline" size={24} color="#0088cc" />
                        <Text style={styles.settingText}>Ağ Bağlantısı</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#aaa" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.settingItem} onPress={() => router.push('/bildirim-ayarlari')}>
                    <View style={styles.settingLeft}>
                        <Ionicons name="notifications-outline" size={24} color="#0088cc" />
                        <Text style={styles.settingText}>Bildirim Ayarları</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#aaa" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.settingItem}>
                    <View style={styles.settingLeft}>
                        <Ionicons name="shield-outline" size={24} color="#0088cc" />
                        <Text style={styles.settingText}>Güvenlik</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#aaa" />
                </TouchableOpacity>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Servis Bilgileri</Text>

                <TouchableOpacity style={styles.settingItem}>
                    <View style={styles.settingLeft}>
                        <Ionicons name="build-outline" size={24} color="#0088cc" />
                        <Text style={styles.settingText}>Bakım Geçmişi</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#aaa" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.settingItem}>
                    <View style={styles.settingLeft}>
                        <Ionicons name="calendar-outline" size={24} color="#0088cc" />
                        <Text style={styles.settingText}>Servis Takvimi</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#aaa" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.settingItem} onPress={handleCall}>
                    <View style={styles.settingLeft}>
                        <Ionicons name="call-outline" size={24} color="#0088cc" />
                        <Text style={styles.settingText}>Teknik Destek</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#aaa" />
                </TouchableOpacity>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Hesap</Text>

                <TouchableOpacity style={styles.settingItem} onPress={() => router.push('/profil')}>
                    <View style={styles.settingLeft}>
                        <Ionicons name="person-outline" size={24} color="#0088cc" />
                        <Text style={styles.settingText}>Profil Bilgileri</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#aaa" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.settingItem}>
                    <View style={styles.settingLeft}>
                        <Ionicons name="card-outline" size={24} color="#0088cc" />
                        <Text style={styles.settingText}>Ödeme Bilgileri</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#aaa" />
                </TouchableOpacity>

                {/* Conditionally render Arıza Formu only for role 1 */}
                {showArizaFormu && (
                    <TouchableOpacity style={styles.settingItem} onPress={() => router.push('/arizaformu')}>
                        <View style={styles.settingLeft}>
                            <Ionicons name="document-text-outline" size={24} color="#0088cc" />
                            <Text style={styles.settingText}>Arıza Formu</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#aaa" />
                    </TouchableOpacity>
                )}
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Uygulama</Text>

                <TouchableOpacity style={styles.settingItem}>
                    <View style={styles.settingLeft}>
                        <Ionicons name="information-circle-outline" size={24} color="#0088cc" />
                        <Text style={styles.settingText}>Hakkında</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#aaa" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.settingItem}>
                    <View style={styles.settingLeft}>
                        <Ionicons name="help-circle-outline" size={24} color="#0088cc" />
                        <Text style={styles.settingText}>Yardım Merkezi</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#aaa" />
                </TouchableOpacity>

                <TouchableOpacity 
                    style={styles.settingItem} 
                    onPress={handleLogout}
                >
                    <View style={styles.settingLeft}>
                        <Ionicons name="log-out-outline" size={24} color="#F44336" />
                        <Text style={[styles.settingText, { color: '#F44336' }]}>Çıkış Yap</Text>
                    </View>
                </TouchableOpacity>
            </View>

            <Text style={styles.versionText}>Artemis Arıtım: Artemis v1.0.0</Text>
        </ScrollView>
    );
}


const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        padding: 15,
    },
    section: {
        backgroundColor: 'white',
        borderRadius: 10,
        padding: 15,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#555',
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    settingLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    settingText: {
        fontSize: 15,
        marginLeft: 12,
        color: '#333',
    },
    versionText: {
        textAlign: 'center',
        color: '#888',
        marginVertical: 20,
        fontSize: 12,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});