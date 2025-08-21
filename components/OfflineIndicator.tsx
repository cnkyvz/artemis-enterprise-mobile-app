// components/OfflineIndicator.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import syncManager from '../artemis-api/utils/syncManager';
import offlineIntegrationManager from '../artemis-api/utils/offlineIntegrationManager';


interface SyncResult {
  synced: number;
  failed: number;
}

interface OfflineEvent {
  networkChange: { isOnline: boolean; type?: string };
  syncStart: undefined;
  syncComplete: { synced?: number; failed?: number };
  syncError: { error: string };
  formSubmitted: { formType: string; online: boolean };
  cacheRefreshed: { type: string; count: number };
}

type OfflineEventType = keyof OfflineEvent;

const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [slideAnim] = useState(new Animated.Value(-100));

  useEffect(() => {
    // Sync manager'ı dinle
    const handleNetworkChange = (online: boolean) => {
      setIsOnline(online);
      if (!online) {
        showIndicator();
      } else {
        hideIndicator();
      }
    };

    const handleSyncStart = () => {
      setSyncStatus('syncing');
    };

    const handleSyncComplete = (result: SyncResult) => {
      setSyncStatus(`synced: ${result.synced}, failed: ${result.failed}`);
      setTimeout(() => setSyncStatus(null), 3000);
    };

    const handleSyncError = () => {
      setSyncStatus('error');
      setTimeout(() => setSyncStatus(null), 5000);
    };

  // useEffect içinde:
  const removeOfflineCallback = offlineIntegrationManager.addUICallback(
    (event: OfflineEventType, data: OfflineEvent[OfflineEventType]) => {
      if (event === 'networkChange') {
        setIsOnline((data as OfflineEvent['networkChange']).isOnline);
      } else if (event === 'syncStart') {
        setSyncStatus('syncing');
      } else if (event === 'syncComplete') {
        const syncData = data as OfflineEvent['syncComplete'];
        setSyncStatus(`synced: ${syncData?.synced || 0}, failed: ${syncData?.failed || 0}`);
        setTimeout(() => setSyncStatus(null), 3000);
      }
    }
  );

    syncManager.on('networkChange', handleNetworkChange);
    syncManager.on('syncStart', handleSyncStart);
    syncManager.on('syncComplete', handleSyncComplete);
    syncManager.on('syncError', handleSyncError);

    return () => {
      syncManager.off('networkChange', handleNetworkChange);
      syncManager.off('syncStart', handleSyncStart);
      syncManager.off('syncComplete', handleSyncComplete);
      syncManager.off('syncError', handleSyncError);
      removeOfflineCallback();
    };
  }, []);

  const showIndicator = () => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const hideIndicator = () => {
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = async () => {
    if (isOnline) {
      await syncManager.forcSync();
    }
  };

  const getIndicatorStyle = () => {
    if (!isOnline) return styles.offline;
    if (syncStatus === 'syncing') return styles.syncing;
    if (syncStatus?.includes('synced')) return styles.synced;
    if (syncStatus === 'error') return styles.error;
    return styles.online;
  };

  const getIndicatorText = (): string => {
    if (!isOnline) return 'Çevrimdışı Mode';
    if (syncStatus === 'syncing') return 'Senkronize ediliyor...';
    if (syncStatus?.includes('synced')) return 'Senkronizasyon tamamlandı';
    if (syncStatus === 'error') return 'Senkronizasyon hatası';
    return 'Çevrimiçi';
  };

  const getIcon = (): keyof typeof Ionicons.glyphMap => {
    if (!isOnline) return 'cloud-offline';
    if (syncStatus === 'syncing') return 'sync';
    if (syncStatus?.includes('synced')) return 'checkmark-circle';
    if (syncStatus === 'error') return 'warning';
    return 'cloud-done';
  };

  return (
    <Animated.View 
      style={[
        styles.container, 
        getIndicatorStyle(),
        { transform: [{ translateY: slideAnim }] }
      ]}
    >
      <TouchableOpacity style={styles.content} onPress={handlePress}>
        <Ionicons name={getIcon()} size={16} color="white" />
        <Text style={styles.text}>{getIndicatorText()}</Text>
        {!isOnline && (
          <Ionicons name="refresh" size={14} color="white" style={styles.refreshIcon} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
  },
  refreshIcon: {
    marginLeft: 6,
  },
  offline: {
    backgroundColor: '#FF3B30',
  },
  online: {
    backgroundColor: '#34C759',
  },
  syncing: {
    backgroundColor: '#007AFF',
  },
  synced: {
    backgroundColor: '#34C759',
  },
  error: {
    backgroundColor: '#FF9500',
  },
});

export default OfflineIndicator;