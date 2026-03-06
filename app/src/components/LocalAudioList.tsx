import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { Music, AlertCircle, Plus } from 'lucide-react-native';

const COLORS = {
  bg: '#0F172A',         // Slate 900
  card: '#1E293B',       // Slate 800
  accent: '#8B5CF6',     // Violet 500
  text: '#F8FAFC',       // Slate 50
  textMuted: '#94A3B8',  // Slate 400
  danger: '#EF4444',     // Red 500
};

interface LocalAudioListProps {
  onSelectTrack: (fileUri: string, filename: string) => void;
  onTracksLoaded?: (tracks: { uri: string, filename: string }[]) => void;
  onAddToPlaylist?: (fileUri: string, filename: string) => void;
}

export const LocalAudioList: React.FC<LocalAudioListProps> = ({ onSelectTrack, onTracksLoaded, onAddToPlaylist }) => {
  const [audioFiles, setAudioFiles] = useState<MediaLibrary.Asset[]>([]);
  const [permissionResponse, requestPermission] = MediaLibrary.usePermissions();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (permissionResponse?.status !== 'granted') {
      requestPermission();
    }
  }, []);

  useEffect(() => {
    if (permissionResponse?.status === 'granted') {
      loadAudioFiles();
    } else if (permissionResponse?.status === 'denied') {
      setLoading(false);
    }
  }, [permissionResponse]);

  const loadAudioFiles = async () => {
    try {
      setLoading(true);

      let allAssets: MediaLibrary.Asset[] = [];
      let hasNextPage = true;
      let after: string | undefined = undefined;

      while (hasNextPage) {
        const media = await MediaLibrary.getAssetsAsync({
          mediaType: 'audio',
          first: 1000, // Fetch in batches
          sortBy: [[MediaLibrary.SortBy.modificationTime, false]], // false for descending, latest downloads first
          after: after,
        });

        allAssets = [...allAssets, ...media.assets];
        hasNextPage = media.hasNextPage;
        after = media.endCursor;
      }

      // Filter out unwanted system folders (Alarms, Ringtones, Notifications)
      const filteredAssets = allAssets.filter(asset => {
        const uriLower = asset.uri.toLowerCase();
        return !uriLower.includes('alarms') &&
          !uriLower.includes('ringtones') &&
          !uriLower.includes('notifications');
      });

      // Remove duplicates by filename
      const uniqueAssets = Array.from(
        new Map(filteredAssets.map(asset => [asset.filename, asset])).values()
      );

      setAudioFiles(uniqueAssets);
      if (onTracksLoaded) {
        onTracksLoaded(uniqueAssets.map(a => ({ uri: a.uri, filename: a.filename })));
      }
    } catch (error) {
      console.error("Erreur lors du chargement des musiques:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: MediaLibrary.Asset }) => (
    <View style={styles.trackItem}>
      <TouchableOpacity
        style={styles.trackContent}
        onPress={() => onSelectTrack(item.uri, item.filename)}
      >
        <View style={styles.iconContainer}>
          <Music size={24} color={COLORS.accent} />
        </View>
        <View style={styles.trackInfo}>
          <Text style={styles.trackName} numberOfLines={1}>{item.filename}</Text>
          <Text style={styles.trackDetails}>
            {item.duration > 0 ? `${Math.floor(item.duration / 60)}:${Math.floor(item.duration % 60).toString().padStart(2, '0')}` : 'Durée inconnue'}
          </Text>
        </View>
      </TouchableOpacity>
      {onAddToPlaylist && (
        <TouchableOpacity
          style={styles.addToPlaylistBtn}
          onPress={() => onAddToPlaylist(item.uri, item.filename)}
        >
          <Plus size={24} color={COLORS.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Recherche de musiques...</Text>
      </View>
    );
  }

  if (permissionResponse?.status !== 'granted') {
    return (
      <View style={styles.centerContainer}>
        <AlertCircle size={48} color={COLORS.danger} />
        <Text style={styles.errorText}>Permission refusée</Text>
        <Text style={styles.errorSubtext}>
          Nous avons besoin d'accéder à vos médias pour afficher vos musiques locales.
        </Text>
        <TouchableOpacity style={styles.btnPrimary} onPress={requestPermission}>
          <Text style={styles.btnPrimaryText}>Autoriser l'accès</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Musiques Locales ({audioFiles.length})</Text>
      {audioFiles.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Music size={48} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>Aucune musique trouvée sur l'appareil.</Text>
        </View>
      ) : (
        <FlatList
          data={audioFiles}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  title: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    marginLeft: 8,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 32,
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  loadingText: {
    color: COLORS.textMuted,
    marginTop: 16,
    fontSize: 14,
  },
  errorText: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtext: {
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 24,
    fontSize: 14,
  },
  btnPrimary: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnPrimaryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    color: COLORS.textMuted,
    marginTop: 16,
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 16,
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.02)',
    marginBottom: 8,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  trackContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  trackInfo: {
    flex: 1,
  },
  trackName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  trackDetails: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  addToPlaylistBtn: {
    padding: 8,
    marginLeft: 8,
  },
});
