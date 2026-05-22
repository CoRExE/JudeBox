import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, TextInput, Image, Keyboard } from 'react-native';
import { Music, Search, Plus, Play, AlertCircle } from 'lucide-react-native';
import { FSoundTrack, searchTracks } from '../utils/fsound';

const COLORS = {
  bg: '#0F172A',         // Slate 900
  card: '#1E293B',       // Slate 800
  accent: '#8B5CF6',     // Violet 500
  text: '#F8FAFC',       // Slate 50
  textMuted: '#94A3B8',  // Slate 400
  danger: '#EF4444',     // Red 500
};

interface FSoundSearchProps {
  onSelectTrack: (uri: string, filename: string) => void;
  onAddToPlaylist: (uri: string, filename: string) => void;
}

export const FSoundSearch: React.FC<FSoundSearchProps> = ({ onSelectTrack, onAddToPlaylist }) => {
  const [query, setQuery] = useState('');
  const [tracks, setTracks] = useState<FSoundTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    Keyboard.dismiss();
    setLoading(true);
    setErrorMsg(null);

    try {
      const results = await searchTracks(query);
      setTracks(results);
    } catch (err: any) {
      console.warn("[FSoundSearch] Error:", err.message);
      setErrorMsg("Impossible de joindre le catalogue FSound. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: FSoundTrack }) => {
    const artistName = item.artists && item.artists.length > 0 ? item.artists[0].name : 'Artiste Inconnu';
    const filename = `${artistName} - ${item.name}`;

    // Check for artwork URL
    const artworkUrl = item.artists && item.artists.length > 0 && item.artists[0].image_small 
      ? item.artists[0].image_small 
      : (item.album?.image ? item.album.image : null);

    const uri = `fsound://${item.id}?artist=${encodeURIComponent(artistName)}&title=${encodeURIComponent(item.name)}${artworkUrl ? `&coverUrl=${encodeURIComponent(artworkUrl)}` : ''}`;

    return (
      <View style={styles.trackItem}>
        <TouchableOpacity
          style={styles.trackContent}
          onPress={() => onSelectTrack(uri, filename)}
        >
          <View style={styles.iconContainer}>
            {artworkUrl ? (
              <Image source={{ uri: artworkUrl }} style={styles.artwork} />
            ) : (
              <Music size={20} color={COLORS.accent} />
            )}
          </View>
          <View style={styles.trackInfo}>
            <Text style={styles.trackName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.trackArtist} numberOfLines={1}>{artistName}</Text>
          </View>
        </TouchableOpacity>
        
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.playBtn}
            onPress={() => onSelectTrack(uri, filename)}
          >
            <Play size={20} color={COLORS.accent} fill={COLORS.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onAddToPlaylist(uri, filename)}
          >
            <Plus size={22} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Recherche en ligne (FSound)</Text>
      
      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          placeholder="Artiste, titre de chanson..."
          placeholderTextColor={COLORS.textMuted}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Search size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      {errorMsg && (
        <View style={styles.errorContainer}>
          <AlertCircle size={20} color={COLORS.danger} />
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      {loading && tracks.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Interrogation du catalogue...</Text>
        </View>
      ) : tracks.length === 0 && !loading ? (
        <View style={styles.emptyContainer}>
          <Music size={40} color={COLORS.textMuted} />
          {query ? (
            <Text style={styles.emptyText}>Aucun résultat trouvé pour "{query}".</Text>
          ) : (
            <Text style={styles.emptyText}>Recherchez des millions de morceaux à écouter en direct.</Text>
          )}
        </View>
      ) : (
        <FlatList
          data={tracks}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    height: 48,
    backgroundColor: COLORS.bg,
    color: COLORS.text,
    paddingHorizontal: 16,
    borderRadius: 12,
    fontSize: 15,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchBtn: {
    width: 48,
    height: 48,
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    color: COLORS.textMuted,
    marginTop: 16,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    paddingVertical: 64,
  },
  emptyText: {
    color: COLORS.textMuted,
    marginTop: 16,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  listContent: {
    paddingBottom: 16,
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.02)',
    marginBottom: 8,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  artwork: {
    width: '100%',
    height: '100%',
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
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  trackArtist: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playBtn: {
    padding: 8,
    opacity: 0.8,
  },
  actionBtn: {
    padding: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 13,
    flex: 1,
  },
});
