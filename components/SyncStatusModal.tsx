// components/SyncStatusModal.tsx
import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import syncManager from '../artemis-api/utils/syncManager';
import offlineStorage from '../artemis-api/utils/offlineStorage';

interface SyncStatusModalProps {
  visible: boolean;
  onClose: () => void;
}

interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pending: number;
  syncing: number;
  failed: number;
}

interface PendingForm {
  id: number;
  form_type: string;
  sync_status: string;
  created_at: string;
  error_message?: string;
}

const SyncStatusModal: React.FC<SyncStatusModalProps> = ({ visible, onClose }) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [pendingForms, setPendingForms] = useState<PendingForm[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (visible) {
      loadSyncStatus();
    }
  }, [visible]);

  const loadSyncStatus = async (): Promise<void> => {
    setIsLoading(true);
    try {
      const status = await syncManager.getSyncStatus();
      const forms = await offlineStorage.getPendingForms();
      setSyncStatus(status);
      setPendingForms(forms);
    } catch (error) {
      console.error('Sync status yükleme hatası:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForceSync = async (): Promise<void> => {
    try {
      await syncManager.forcSync();
      await loadSyncStatus();
    } catch (error) {
      console.error('Manuel sync hatası:', error);
    }
  };

  const handleCleanup = async (): Promise<void> => {
    try {
      await offlineStorage.cleanupSyncedForms();
      await loadSyncStatus();
    } catch (error) {
      console.error('Temizleme hatası:', error);
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('tr-TR');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Senkronizasyon Durumu</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Durum kontrol ediliyor...</Text>
          </View>
        ) : (
          <ScrollView style={styles.content}>
            {/* Durum Özeti */}
            <View style={styles.statusSection}>
              <Text style={styles.sectionTitle}>Bağlantı Durumu</Text>
              <View style={styles.statusCard}>
                <View style={styles.statusRow}>
                  <Ionicons 
                    name={syncStatus?.isOnline ? "wifi" : "wifi-off"} 
                    size={20} 
                    color={syncStatus?.isOnline ? "#34C759" : "#FF3B30"} 
                  />
                  <Text style={styles.statusText}>
                    {syncStatus?.isOnline ? "Çevrimiçi" : "Çevrimdışı"}
                  </Text>
                </View>
                {syncStatus?.isSyncing && (
                  <View style={styles.statusRow}>
                    <ActivityIndicator size="small" color="#007AFF" />
                    <Text style={styles.statusText}>Senkronize ediliyor...</Text>
                  </View>
                )}
              </View>
            </View>

            {/* İstatistikler */}
            <View style={styles.statsSection}>
              <Text style={styles.sectionTitle}>İstatistikler</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>{syncStatus?.pending || 0}</Text>
                  <Text style={styles.statLabel}>Bekleyen</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>{syncStatus?.syncing || 0}</Text>
                  <Text style={styles.statLabel}>İşleniyor</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>{syncStatus?.failed || 0}</Text>
                  <Text style={styles.statLabel}>Başarısız</Text>
                </View>
              </View>
            </View>

            {/* Bekleyen Formlar */}
            {pendingForms.length > 0 && (
              <View style={styles.formsSection}>
                <Text style={styles.sectionTitle}>Bekleyen Formlar</Text>
                {pendingForms.map((form) => (
                  <View key={form.id} style={styles.formCard}>
                    <View style={styles.formHeader}>
                      <Text style={styles.formType}>
                        {form.form_type === 'teknik_servis' ? 'Teknik Servis' : 'Talep'}
                      </Text>
                      <View style={[styles.statusBadge, 
                        form.sync_status === 'failed' ? styles.failedBadge : styles.pendingBadge
                      ]}>
                        <Text style={styles.badgeText}>{form.sync_status}</Text>
                      </View>
                    </View>
                    <Text style={styles.formDate}>{formatDate(form.created_at)}</Text>
                    {form.error_message && (
                      <Text style={styles.errorMessage}>{form.error_message}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Aksiyon Butonları */}
            <View style={styles.actionsSection}>
              <TouchableOpacity 
                style={[styles.actionButton, styles.primaryButton]}
                onPress={handleForceSync}
                disabled={!syncStatus?.isOnline}
              >
                <Ionicons name="refresh" size={20} color="white" />
                <Text style={styles.actionButtonText}>Manuel Senkronize Et</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionButton, styles.secondaryButton]}
                onPress={handleCleanup}
              >
                <Ionicons name="trash" size={20} color="#666" />
                <Text style={styles.actionButtonTextSecondary}>Eski Verileri Temizle</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F9FF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: 'white',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  statusSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  statusCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  statusText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#333',
  },
  statsSection: {
    marginBottom: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  formsSection: {
    marginBottom: 20,
  },
  formCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  formType: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pendingBadge: {
    backgroundColor: '#FFF3CD',
  },
  failedBadge: {
    backgroundColor: '#F8D7DA',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  formDate: {
    fontSize: 12,
    color: '#666',
  },
  errorMessage: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 5,
    fontStyle: 'italic',
  },
  actionsSection: {
    marginTop: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '500',
    marginLeft: 8,
  },
  actionButtonTextSecondary: {
    color: '#666',
    fontWeight: '500',
    marginLeft: 8,
  },
});

export default SyncStatusModal;