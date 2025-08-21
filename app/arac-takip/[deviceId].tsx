// app/arac-takip/[deviceId].tsx

import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  StatusBar,
  Platform,
  Dimensions,
  ActivityIndicator,
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import api from '../../utils/enterpriseApi';

const { width, height } = Dimensions.get('window');
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

type VehicleLocation = {
  deviceId: string;
  plaka: string;
  model: string;
  konum: {
    latitude: number;
    longitude: number;
    address: string;
  };
  durum: {
    hiz: number;
    ignition: boolean;
    son_guncelleme: string;
  };
};

export default function AracTakip() {
  const router = useRouter();
  const { deviceId, grupAdi } = useLocalSearchParams();
  
  const [vehicleData, setVehicleData] = useState<VehicleLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const mapRef = useRef<MapView>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    console.log('🗺️ Araç takip ekranı açıldı:', { deviceId, grupAdi });
    fetchVehicleLocation();
    
    // 30 saniyede bir güncelle
    refreshIntervalRef.current = setInterval(() => {
      fetchVehicleLocation(true); // background refresh
    }, 30000);
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [deviceId]);

  const fetchVehicleLocation = async (isBackgroundRefresh = false) => {
    try {
      if (!isBackgroundRefresh) {
        setLoading(true);
        setError(null);
      } else {
        setRefreshing(true);
      }
      
      console.log('📡 Araç konum güncelleniyor:', deviceId);
      
      const response = await api.get(`/api/arac-konum/${deviceId}`);
      const data = response.data as VehicleLocation;
      
      setVehicleData(data);
      
      // Haritayı konuma odakla
      if (mapRef.current && data.konum) {
        mapRef.current.animateToRegion({
          latitude: data.konum.latitude,
          longitude: data.konum.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 1000);
      }
      
      console.log('✅ Araç konum güncellendi:', data.plaka);
      
    } catch (err: any) {
      console.error('❌ Araç konum hatası:', err);
      setError('Araç konumu alınamadı');
      
      if (!isBackgroundRefresh) {
        Alert.alert('Hata', 'Araç konum bilgisi alınamadı. Lütfen tekrar deneyin.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchVehicleLocation();
  };

  const handleCenterMap = () => {
    if (vehicleData && mapRef.current) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      mapRef.current.animateToRegion({
        latitude: vehicleData.konum.latitude,
        longitude: vehicleData.konum.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    }
  };

  const getStatusColor = () => {
    if (!vehicleData) return '#95a5a6';
    
    if (vehicleData.durum.ignition && vehicleData.durum.hiz > 0) {
      return '#27ae60'; // Hareket halinde - yeşil
    } else if (vehicleData.durum.ignition && vehicleData.durum.hiz === 0) {
      return '#f39c12'; // Kontak açık ama durgun - sarı
    } else {
      return '#e74c3c'; // Kontak kapalı - kırmızı
    }
  };

  const getStatusText = () => {
    if (!vehicleData) return 'Bilinmiyor';
    
    if (vehicleData.durum.ignition && vehicleData.durum.hiz > 0) {
      return 'Hareket Halinde';
    } else if (vehicleData.durum.ignition && vehicleData.durum.hiz === 0) {
      return 'Beklemede';
    } else {
      return 'Park Halinde';
    }
  };

  if (loading && !vehicleData) {
    return (
      <View style={styles.mainContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#2C3E50" translucent />
        
        <LinearGradient colors={['#2C3E50', '#34495E']} style={styles.headerGradient}>
          <View style={styles.headerContent}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.back();
              }}
            >
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            
            <Text style={styles.headerTitle}>Araç Takibi</Text>
            <View style={{ width: 40 }} />
          </View>
        </LinearGradient>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0088cc" />
          <Text style={styles.loadingText}>Araç konumu yükleniyor...</Text>
        </View>
      </View>
    );
  }

  if (error && !vehicleData) {
    return (
      <View style={styles.mainContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#2C3E50" translucent />
        
        <LinearGradient colors={['#2C3E50', '#34495E']} style={styles.headerGradient}>
          <View style={styles.headerContent}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.back();
              }}
            >
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            
            <Text style={styles.headerTitle}>Araç Takibi</Text>
            <View style={{ width: 40 }} />
          </View>
        </LinearGradient>
        
        <View style={styles.errorContainer}>
          <Ionicons name="warning-outline" size={60} color="#e74c3c" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#2C3E50" translucent />
      
      <LinearGradient colors={['#2C3E50', '#34495E']} style={styles.headerGradient}>
        <View style={styles.headerContent}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>
              {vehicleData?.plaka || 'Araç Takibi'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {grupAdi || 'Canlı Takip'}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={handleRefresh}
            disabled={loading}
          >
            <Ionicons 
              name="refresh" 
              size={20} 
              color="white" 
              style={{
                transform: [{ rotate: refreshing ? '180deg' : '0deg' }]
              }}
            />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Ana İçerik */}
      <View style={styles.container}>
        {/* Durum Kartı */}
        {vehicleData && (
          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <View style={styles.vehicleInfo}>
                <Text style={styles.vehiclePlate}>{vehicleData.plaka}</Text>
                <Text style={styles.vehicleModel}>{vehicleData.model}</Text>
              </View>
              
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
                <Text style={styles.statusBadgeText}>{getStatusText()}</Text>
              </View>
            </View>
            
            <View style={styles.statusDetails}>
              <View style={styles.statusItem}>
                <Ionicons name="speedometer-outline" size={16} color="#3498db" />
                <Text style={styles.statusItemText}>{vehicleData.durum.hiz} km/h</Text>
              </View>
              
              <View style={styles.statusItem}>
                <Ionicons 
                  name={vehicleData.durum.ignition ? "key" : "key-outline"} 
                  size={16} 
                  color={vehicleData.durum.ignition ? "#27ae60" : "#e74c3c"} 
                />
                <Text style={styles.statusItemText}>
                  {vehicleData.durum.ignition ? 'Açık' : 'Kapalı'}
                </Text>
              </View>
              
              <View style={styles.statusItem}>
                <Ionicons name="time-outline" size={16} color="#95a5a6" />
                <Text style={styles.statusItemText}>
                  {new Date(vehicleData.durum.son_guncelleme).toLocaleTimeString('tr-TR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Harita */}
        <View style={styles.mapContainer}>
          {vehicleData && vehicleData.konum ? (
            <MapView
              ref={mapRef}
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              initialRegion={{
                latitude: vehicleData.konum.latitude,
                longitude: vehicleData.konum.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              showsUserLocation={true}
              showsMyLocationButton={false}
              showsTraffic={true}
              mapType="standard"
            >
              <Marker
                coordinate={{
                  latitude: vehicleData.konum.latitude,
                  longitude: vehicleData.konum.longitude,
                }}
                title={vehicleData.plaka}
                description={vehicleData.konum.address}
                pinColor={getStatusColor()}
              >
                <View style={[styles.customMarker, { backgroundColor: getStatusColor() }]}>
                  <Ionicons name="car-sport" size={20} color="white" />
                </View>
              </Marker>
            </MapView>
          ) : (
            <View style={styles.mapPlaceholder}>
              <Ionicons name="location-outline" size={50} color="#bdc3c7" />
              <Text style={styles.mapPlaceholderText}>Konum bilgisi yükleniyor...</Text>
            </View>
          )}
          
          {/* Harita Kontrolleri */}
          <TouchableOpacity 
            style={styles.centerButton}
            onPress={handleCenterMap}
          >
            <Ionicons name="locate" size={24} color="#0088cc" />
          </TouchableOpacity>
        </View>

        {/* Adres Bilgisi */}
        {vehicleData && vehicleData.konum && (
          <View style={styles.addressCard}>
            <View style={styles.addressHeader}>
              <Ionicons name="location-outline" size={18} color="#0088cc" />
              <Text style={styles.addressTitle}>Mevcut Konum</Text>
            </View>
            <Text style={styles.addressText}>{vehicleData.konum.address}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerGradient: {
    paddingTop: STATUSBAR_HEIGHT + 25,
    paddingBottom: height * 0.02,
    paddingHorizontal: width * 0.05,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 2,
  },
  backButton: {
    padding: 10,
  },
  refreshButton: {
    padding: 10,
  },
  container: {
    flex: 1,
    padding: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#7f8c8d',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#e74c3c',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#0088cc',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  statusCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehiclePlate: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  vehicleModel: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusItemText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#34495e',
    fontWeight: '500',
  },
  mapContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 15,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ecf0f1',
  },
  mapPlaceholderText: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 10,
  },
  customMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
  },
  centerButton: {
    position: 'absolute',
    right: 15,
    bottom: 15,
    backgroundColor: 'white',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addressCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  addressTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginLeft: 8,
  },
  addressText: {
    fontSize: 14,
    color: '#7f8c8d',
    lineHeight: 20,
  },
});