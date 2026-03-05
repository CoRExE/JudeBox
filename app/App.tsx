import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, Alert, Platform, ActivityIndicator, KeyboardAvoidingView, ScrollView, Image, Animated, Dimensions, Easing } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import { io, Socket } from 'socket.io-client';
import { Play, Pause, Upload, Headphones, LogOut, Radio, Music, RadioTower, ListMusic, Repeat, Repeat1, X } from 'lucide-react-native';
import { LocalAudioList } from './src/components/LocalAudioList';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SERVER_URL = 'http://192.168.1.20:3000';

type Role = 'host' | 'listener' | null;

// Thème des couleurs
const COLORS = {
  bg: '#0F172A',         // Slate 900
  card: '#1E293B',       // Slate 800
  accent: '#8B5CF6',     // Violet 500
  accentHover: '#7C3AED',// Violet 600
  accentGhost: 'rgba(139, 92, 246, 0.15)',
  text: '#F8FAFC',       // Slate 50
  textMuted: '#94A3B8',  // Slate 400
  success: '#10B981',    // Emerald 500
  danger: '#EF4444',     // Red 500
  dangerGhost: 'rgba(239, 68, 68, 0.15)'
};

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomId, setRoomId] = useState('');
  const [role, setRole] = useState<Role>(null);
  const [isConnected, setIsConnected] = useState(false);

  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFileURI, setCurrentFileURI] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [trackMetadata, setTrackMetadata] = useState<{ title?: string, artist?: string, coverBase64?: string } | null>(null);
  const [showLocalLibrary, setShowLocalLibrary] = useState(false);
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [allLocalTracks, setAllLocalTracks] = useState<{ uri: string, filename: string }[]>([]);

  const isUpdatingFromSocket = useRef(false);
  const currentIsPlayingRef = useRef(false);
  const hasTriggeredNextTrackRef = useRef(false);

  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current; // Initially off-screen
  const spinAnim = useRef(new Animated.Value(0)).current;

  const isSpinning = useRef(false);

  // Vinyl Spin Animation
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (isPlaying) {
      if (!isSpinning.current) {
        spinAnim.setValue(0);
        Animated.loop(
          Animated.timing(spinAnim, {
            toValue: 1,
            duration: 12000,
            easing: Easing.linear,
            useNativeDriver: true,
          })
        ).start();
        isSpinning.current = true;
      }
    } else {
      // Debounce stop to prevent jump on track change
      timeout = setTimeout(() => {
        spinAnim.stopAnimation();
        isSpinning.current = false;
      }, 500);
    }
    return () => clearTimeout(timeout);
  }, [isPlaying]);

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const toggleLibraryPanel = () => {
    const isOpening = !showLocalLibrary;
    setShowLocalLibrary(isOpening);
    Animated.timing(slideAnim, {
      toValue: isOpening ? 0 : SCREEN_WIDTH,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const getNextTrackInfo = () => {
    if (!currentFileURI || allLocalTracks.length === 0) return null;
    const currentIndex = allLocalTracks.findIndex(t => t.filename === currentFileURI);
    if (currentIndex !== -1 && currentIndex + 1 < allLocalTracks.length) {
      return allLocalTracks[currentIndex + 1];
    }
    return null;
  };

  const playNextTrack = async () => {
    const next = getNextTrackInfo();
    if (next) {
      hasTriggeredNextTrackRef.current = true;
      setProgress(0); // Reset progress immediately
      await handleAudioSelection(next.uri, next.filename, 'audio/mpeg', true);
    }
  };

  // Auto-play listener based on progress instead of callback
  useEffect(() => {
    if (isAutoPlay && role === 'host' && progress >= 0.99 && !hasTriggeredNextTrackRef.current) {
      playNextTrack();
    }
  }, [progress, isAutoPlay, role]);

  // Initialisation Socket
  useEffect(() => {
    const newSocket = io(SERVER_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => setIsConnected(true));
    newSocket.on('disconnect', () => {
      setIsConnected(false);
      setRole(null);
    });

    newSocket.on('connect_error', (err) => {
      console.log('Erreur de connexion Socket:', err.message);
    });

    return () => { newSocket.disconnect(); };
  }, []);

  useEffect(() => {
    return sound ? () => { sound.unloadAsync(); } : undefined;
  }, [sound]);

  // Écouteurs Server/Sync
  useEffect(() => {
    if (!socket) return;

    socket.on('syncState', async (state: { isPlaying: boolean, positionMillis: number, updatedAt: number }) => {
      if (!sound || role === 'host') return;

      isUpdatingFromSocket.current = true;
      const now = Date.now();
      const latency = now - state.updatedAt;
      const targetPosition = state.positionMillis + (state.isPlaying ? latency : 0);

      const status = await sound.getStatusAsync();

      if (status.isLoaded) {
        const drift = Math.abs(status.positionMillis - targetPosition);
        if (drift > 2000) {
          await sound.setPositionAsync(targetPosition);
        }

        if (state.isPlaying && !status.isPlaying) {
          await sound.playAsync();
          setIsPlaying(true);
          currentIsPlayingRef.current = true;
        } else if (!state.isPlaying && status.isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
          currentIsPlayingRef.current = false;
        }
      }

      setTimeout(() => { isUpdatingFromSocket.current = false; }, 500);
    });

    socket.on('newTrack', async (streamPath: string, metadata?: { title?: string, artist?: string, coverBase64?: string }) => {
      if (role !== 'listener') return;
      if (sound) await sound.unloadAsync();

      setTrackMetadata(metadata || null);

      const timestamp = Date.now()
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: `${SERVER_URL}${streamPath}?t=${timestamp}` },
        { shouldPlay: false }
      );

      newSound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.isLoaded) setProgress(status.positionMillis / (status.durationMillis || 1));
      });
      setSound(newSound);
    });
  }, [socket, sound, role]);

  // Actions Room
  const createRoom = () => {
    if (!roomId) return;
    socket?.emit('createRoom', roomId, (success: boolean) => {
      if (success) setRole('host');
      else Alert.alert('Erreur', 'Ce salon existe déjà.');
    });
  };

  const joinRoom = () => {
    if (!roomId) return;
    socket?.emit('joinRoom', roomId, (success: boolean) => {
      if (success) setRole('listener');
      else Alert.alert('Erreur', 'Salon introuvable.');
    });
  };

  // Actions Audio
  const handleAudioSelection = async (uri: string, filename: string, mimeType: string = 'audio/mpeg', autoPlayOnLoad: boolean = false) => {
    try {
      setCurrentFileURI(filename);
      setIsUploading(true);
      setShowLocalLibrary(false);

      const formData = new FormData();
      formData.append('audio', {
        uri: uri,
        name: filename,
        type: mimeType,
      } as any);

      const uploadRes = await fetch(`${SERVER_URL}/room/${roomId}/upload`, {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (!uploadRes.ok) {
        setIsUploading(false);
        Alert.alert('Erreur', "Échec de l'upload du fichier.");
        return;
      }

      const resData = await uploadRes.json();

      setTrackMetadata(resData.metadata || null);

      if (sound) await sound.unloadAsync();
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: SERVER_URL + resData.streamUrl },
        { shouldPlay: false }
      );

      newSound.setOnPlaybackStatusUpdate(async (status: any) => {
        if (!status.isLoaded) return;
        setProgress(status.positionMillis / (status.durationMillis || 1));

        if (isUpdatingFromSocket.current) return;

        // Ensure play state is synchronized
        if (status.isPlaying !== currentIsPlayingRef.current) {
          currentIsPlayingRef.current = status.isPlaying;
          setIsPlaying(status.isPlaying);
          socket?.emit('updateState', roomId, {
            isPlaying: status.isPlaying,
            positionMillis: status.positionMillis
          });
        }
      });

      setSound(newSound);

      if (autoPlayOnLoad) {
        await newSound.playAsync();
        setIsPlaying(true);
        currentIsPlayingRef.current = true;
        socket?.emit('updateState', roomId, { isPlaying: true, positionMillis: 0 });
      }

      setIsUploading(false);
      hasTriggeredNextTrackRef.current = false;
    } catch (err) {
      console.error(err);
      setIsUploading(false);
      Alert.alert('Erreur', 'Impossible de charger ce fichier.');
    }
  };

  const pickAndUploadAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*' });
      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const file = result.assets[0];
      await handleAudioSelection(file.uri, file.name, file.mimeType || 'audio/mpeg');
    } catch (err) {
      console.error(err);
      Alert.alert('Erreur', 'Impossible de charger ce fichier.');
    }
  };



  const togglePlayHost = async () => {
    if (!sound) return;
    const status = await sound.getStatusAsync();
    if (!status.isLoaded) return;

    if (status.isPlaying) {
      await sound.pauseAsync();
      setIsPlaying(false);
      currentIsPlayingRef.current = false;
      socket?.emit('updateState', roomId, { isPlaying: false, positionMillis: status.positionMillis });
    } else {
      await sound.playAsync();
      setIsPlaying(true);
      currentIsPlayingRef.current = true;
      socket?.emit('updateState', roomId, { isPlaying: true, positionMillis: status.positionMillis });
    }
  };

  const leaveRoom = () => {
    setRole(null);
    setRoomId('');
    if (sound) {
      sound.unloadAsync();
      setSound(null);
    }
    setTrackMetadata(null);
  };

  // --- RENDUS COMPOSANTS ---

  if (!role) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
            <View style={styles.logoContainer}>
              <View style={styles.iconCircle}>
                <RadioTower size={48} color={COLORS.accent} />
              </View>
              <Text style={styles.title}>JudeBox</Text>
              <Text style={styles.subtitle}>Écoute partagée en temps réel.</Text>
            </View>

            <View style={[styles.statusBadge, { backgroundColor: isConnected ? COLORS.accentGhost : COLORS.dangerGhost }]}>
              <View style={[styles.statusDot, { backgroundColor: isConnected ? COLORS.accent : COLORS.danger }]} />
              <Text style={[styles.statusText, { color: isConnected ? COLORS.accent : COLORS.danger }]}>
                {isConnected ? 'Serveur Connecté' : 'Serveur Déconnecté'}
              </Text>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.label}>Code du salon</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: SOIRÉE-123"
                placeholderTextColor={COLORS.textMuted}
                value={roomId}
                onChangeText={setRoomId}
                autoCapitalize="characters"
              />

              <TouchableOpacity style={[styles.btnPrimary, !roomId && styles.btnDisabled]} onPress={joinRoom} disabled={!roomId || !isConnected}>
                <Headphones size={20} color="#fff" />
                <Text style={styles.btnPrimaryText}>Rejoindre (Auditeur)</Text>
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OU</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity style={[styles.btnSecondary, !roomId && styles.btnDisabled]} onPress={createRoom} disabled={!roomId || !isConnected}>
                <Radio size={20} color={COLORS.text} />
                <Text style={styles.btnSecondaryText}>Créer un salon (Hôte)</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Salon {roomId}</Text>
            <Text style={styles.headerRole}>{role === 'host' ? '👑 Vous êtes l\'Hôte' : '🎧 Vous êtes Auditeur'}</Text>
          </View>
          <TouchableOpacity style={styles.leaveBtn} onPress={leaveRoom}>
            <LogOut size={20} color={COLORS.danger} />
          </TouchableOpacity>
        </View>

        <View style={styles.roomContent}>
          {role === 'host' && (
            <View style={styles.playerCard}>
              <View style={styles.vinylContainer}>
                <Animated.View style={[styles.vinyl, isPlaying && styles.vinylSpinning, { transform: [{ rotate: spinInterpolate }] }]}>
                  {trackMetadata?.coverBase64 ? (
                    <Image
                      source={{ uri: `data:image/jpeg;base64,${trackMetadata.coverBase64}` }}
                      style={styles.coverImage}
                    />
                  ) : (
                    <Music size={40} color={COLORS.bg} />
                  )}
                </Animated.View>
              </View>

              <Text style={styles.trackName} numberOfLines={1}>
                {trackMetadata?.title && trackMetadata?.artist
                  ? `${trackMetadata.title} - ${trackMetadata.artist}`
                  : (trackMetadata?.title || currentFileURI || "Aucun fichier sélectionné")}
              </Text>

              {isAutoPlay && role === 'host' && getNextTrackInfo() && (
                <View style={styles.nextTrackInfo}>
                  <Text style={styles.nextTrackLabel}>À suivre :</Text>
                  <Text style={styles.nextTrackText} numberOfLines={1}>
                    {getNextTrackInfo()?.filename}
                  </Text>
                </View>
              )}

              <View style={styles.progressContainer}>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
                </View>
              </View>

              <View style={styles.hostControls}>
                <TouchableOpacity style={styles.actionBtn} onPress={toggleLibraryPanel} disabled={isUploading}>
                  <ListMusic size={24} color={COLORS.text} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.playBtn, !sound && styles.btnDisabled]}
                  onPress={togglePlayHost}
                  disabled={!sound}>
                  {isPlaying ? <Pause size={32} color="#fff" /> : <Play size={32} color="#fff" style={{ marginLeft: 4 }} />}
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtn} onPress={() => setIsAutoPlay(!isAutoPlay)}>
                  {isAutoPlay ? <Repeat size={24} color={COLORS.accent} /> : <Repeat1 size={24} color={COLORS.textMuted} />}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Animated Library Side Panel over content */}
          {role === 'host' && (
            <Animated.View style={[styles.sidePanel, { transform: [{ translateX: slideAnim }] }]}>
              <View style={styles.sidePanelHeader}>
                <Text style={styles.sidePanelTitle}>Bibliothèque</Text>
                <TouchableOpacity onPress={toggleLibraryPanel} style={styles.closePanelBtn}>
                  <X size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              <LocalAudioList
                onSelectTrack={(uri, filename) => handleAudioSelection(uri, filename)}
                onTracksLoaded={(tracks) => setAllLocalTracks(tracks)}
              />
            </Animated.View>
          )}

          {role === 'listener' && (
            <View style={styles.playerCard}>
              <View style={[styles.vinylContainer, !sound && { opacity: 0.3 }]}>
                <Animated.View style={[styles.vinyl, isPlaying && styles.vinylSpinning, { transform: [{ rotate: spinInterpolate }] }]}>
                  {trackMetadata?.coverBase64 ? (
                    <Image
                      source={{ uri: `data:image/jpeg;base64,${trackMetadata.coverBase64}` }}
                      style={styles.coverImage}
                    />
                  ) : (
                    isPlaying ? <Radio size={40} color={COLORS.bg} /> : <Headphones size={40} color={COLORS.bg} />
                  )}
                </Animated.View>
              </View>

              <Text style={styles.trackName}>
                {trackMetadata?.title && trackMetadata?.artist
                  ? `${trackMetadata.title} - ${trackMetadata.artist}`
                  : (trackMetadata?.title || (sound ? '🎧 En écoute partagée' : '⏳ En attente de musique...'))}
              </Text>
              <Text style={[styles.syncStatus, { color: isPlaying ? COLORS.accent : COLORS.textMuted }]}>
                {isPlaying ? "En direct avec l'hôte" : (sound ? "L'hôte a mis en pause" : "Silence dans le salon")}
              </Text>

              {sound && (
                <View style={styles.progressContainer}>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
                  </View>
                </View>
              )}
            </View>
          )}

        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 30,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  formCard: {
    backgroundColor: COLORS.card,
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  label: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: COLORS.bg,
    color: COLORS.text,
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 24,
  },
  btnPrimary: {
    backgroundColor: COLORS.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 10,
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dividerText: {
    color: COLORS.textMuted,
    paddingHorizontal: 16,
    fontSize: 12,
    fontWeight: '600',
  },
  btnSecondary: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  btnSecondaryText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },

  // -- ROOM STYLES --
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
  },
  headerRole: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  leaveBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.dangerGhost,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomContent: {
    padding: 24,
    flex: 1,
    justifyContent: 'center',
  },
  playerCard: {
    backgroundColor: COLORS.card,
    borderRadius: 32,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  vinylContainer: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.02)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  vinyl: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: COLORS.text,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  vinylSpinning: {
    // Dans React Native brut sans library externe, on peut simuler ou utiliser Reanimated plus tard.
    // L'ajout de l'animation de bordure corail active
    shadowOpacity: 0.8,
    shadowRadius: 30,
    backgroundColor: COLORS.accent,
  },
  trackName: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  syncStatus: {
    fontSize: 14,
    marginBottom: 24,
  },
  progressContainer: {
    width: '100%',
    marginBottom: 32,
  },
  progressBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 3,
  },
  hostControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  actionBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 8,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    borderRadius: 80, // Moitié de width/height (160) de vinyl
  },
  nextTrackInfo: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accent,
  },
  nextTrackLabel: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  nextTrackText: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  sidePanel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: SCREEN_WIDTH * 0.85,
    backgroundColor: COLORS.card,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: -5, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 20,
    paddingTop: 0, // Handled by header
  },
  sidePanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  sidePanelTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  closePanelBtn: {
    padding: 4,
  }
});
