import React, { useState, useEffect, useRef } from 'react';
import { Text, View, TouchableOpacity, Alert, Animated, Dimensions, Modal, FlatList } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Buffer } from 'buffer';
import * as mm from 'music-metadata-browser';

// Polyfill global Buffer pour les librairies Node.js fonctionnant dans React Native
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

import { io, Socket } from 'socket.io-client';
import { LogOut, X, FolderHeart, Library, Search } from 'lucide-react-native';
import { LocalAudioList } from './src/components/LocalAudioList';
import { usePlaylists, Playlist, PlaylistTrack } from './src/hooks/usePlaylists';
import { PlaylistsView } from './src/components/PlaylistsView';
import { Toast } from './src/components/Toast';
import { FSoundSearch } from './src/components/FSoundSearch';
import { resolveTrack } from './src/utils/fsound';
import { COLORS } from './src/constants/colors';
import { styles } from './src/styles/AppStyles';
import { LobbyView } from './src/components/LobbyView';
import { HostPlayerView } from './src/components/HostPlayerView';
import { ListenerPlayerView } from './src/components/ListenerPlayerView';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SERVER_URL = 'http://192.168.1.12:3000';

type Role = 'host' | 'listener' | 'offline' | null;

const extractLocalMetadata = async (uri: string, filename: string) => {
  try {
    // Read the entire file as Base64 to prevent 'Unexpected end of file' parser errors
    const base64Str = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64'
    });

    const buffer = Buffer.from(base64Str, 'base64');
    const metadata = await mm.parseBuffer(buffer, 'audio/mpeg', { duration: false });

    let coverBase64 = undefined;
    if (metadata.common.picture && metadata.common.picture.length > 0) {
      coverBase64 = Buffer.from(metadata.common.picture[0].data).toString('base64');
    }

    return {
      title: metadata.common.title || filename.replace('.mp3', ''),
      artist: metadata.common.artist || 'Artiste Inconnu',
      coverBase64
    };
  } catch (err) {
    console.warn("Erreur extract ID3 local:", err);
    return { title: filename.replace('.mp3', ''), artist: 'Artiste Inconnu' };
  }
};

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomId, setRoomId] = useState('');
  const [role, setRole] = useState<Role>(null);
  const [isConnected, setIsConnected] = useState(false);

  const player = useAudioPlayer(); // expo-audio hook

  // Initialize background audio mode
  useEffect(() => {
    const setupAudio = async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
          interruptionMode: 'doNotMix',
        });
      } catch (e) {
        console.warn('Failed to set audio mode:', e);
      }
    };
    setupAudio();
  }, []);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFileURI, setCurrentFileURI] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [trackMetadata, setTrackMetadata] = useState<{ title?: string, artist?: string, coverBase64?: string, coverUrl?: string } | null>(null);
  const [showLocalLibrary, setShowLocalLibrary] = useState(false);
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [allLocalTracks, setAllLocalTracks] = useState<{ uri: string, filename: string }[]>([]);

  // Playlist State
  const { playlists, createPlaylist, addTrackToPlaylist, removeTrackFromPlaylist, deletePlaylist } = usePlaylists();
  const [activeTab, setActiveTab] = useState<'library' | 'playlists' | 'fsound'>('library');
  const [currentPlaybackContext, setCurrentPlaybackContext] = useState<{ type: 'library' } | { type: 'playlist', id: string }>({ type: 'library' });
  const [isPlaylistModalVisible, setPlaylistModalVisible] = useState(false);
  const [trackToAdd, setTrackToAdd] = useState<PlaylistTrack | null>(null);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
  };

  const isUpdatingFromSocket = useRef(false);
  const currentIsPlayingRef = useRef(false);
  const hasTriggeredNextTrackRef = useRef(false);

  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current; // Initially off-screen

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
    if (!currentFileURI) return null;

    let trackList = allLocalTracks;
    if (currentPlaybackContext.type === 'playlist') {
      const playlist = playlists.find(p => p.id === currentPlaybackContext.id);
      if (playlist) trackList = playlist.tracks;
    }

    if (trackList.length === 0) return null;

    const currentIndex = trackList.findIndex(t => t.filename === currentFileURI);
    if (currentIndex !== -1 && currentIndex + 1 < trackList.length) {
      return trackList[currentIndex + 1];
    }
    return null;
  };

  const getPreviousTrackInfo = () => {
    if (!currentFileURI) return null;

    let trackList = allLocalTracks;
    if (currentPlaybackContext.type === 'playlist') {
      const playlist = playlists.find(p => p.id === currentPlaybackContext.id);
      if (playlist) trackList = playlist.tracks;
    }

    if (trackList.length === 0) return null;

    const currentIndex = trackList.findIndex(t => t.filename === currentFileURI);
    if (currentIndex > 0) {
      return trackList[currentIndex - 1];
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

  const playPreviousTrack = async () => {
    const prev = getPreviousTrackInfo();
    if (prev) {
      hasTriggeredNextTrackRef.current = true;
      setProgress(0);
      await handleAudioSelection(prev.uri, prev.filename, 'audio/mpeg', true);
    }
  };

  // Auto-play listener based on progress instead of callback
  useEffect(() => {
    if (isAutoPlay && role === 'host' && progress >= 0.99 && !hasTriggeredNextTrackRef.current) {
      playNextTrack();
    }
  }, [progress, isAutoPlay, role]);

  // Status and Event Listener for AudioPlayer
  useEffect(() => {
    // Synchronize local state with player status
    const updateListener = player.addListener('playbackStatusUpdate', (status: any) => {
      // expo-audio currentTime and duration are in seconds!
      const currentPos = status.currentTime || 0;
      const totalDur = status.duration || 1;

      if (status.isLoaded) {
        setProgress(currentPos / totalDur);
      }

      if (isUpdatingFromSocket.current) return;

      // Ensure play state is synchronized based on user interactions
      if (status.playing !== currentIsPlayingRef.current) {
        currentIsPlayingRef.current = status.playing;
        setIsPlaying(status.playing);
        if (role !== 'offline') {
          socket?.emit('updateState', roomId, {
            isPlaying: status.playing,
            positionMillis: currentPos * 1000 // Send in ms for backwards compatibility
          });
        }
      }
    });

    return () => {
      updateListener.remove();
    };
  }, [player, roomId, role, socket]);


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


  // Écouteurs Server/Sync
  useEffect(() => {
    if (!socket) return;

    socket.on('syncState', async (state: { isPlaying: boolean, positionMillis: number, updatedAt: number }) => {
      if (role === 'host') return;

      isUpdatingFromSocket.current = true;
      const now = Date.now();
      const latency = now - state.updatedAt;

      // Calculate target position in SECONDS
      const targetPosition = (state.positionMillis + (state.isPlaying ? latency : 0)) / 1000;

      if (player.isLoaded) {
        const drift = Math.abs(player.currentTime - targetPosition);
        if (drift > 2) { // 2 seconds leeway
          await player.seekTo(targetPosition);
        }

        if (state.isPlaying && !player.playing) {
          player.play();
          setIsPlaying(true);
          currentIsPlayingRef.current = true;
        } else if (!state.isPlaying && player.playing) {
          player.pause();
          setIsPlaying(false);
          currentIsPlayingRef.current = false;
        }
      }

      setTimeout(() => { isUpdatingFromSocket.current = false; }, 500);
    });

    socket.on('newTrack', async (streamPath: string, metadata?: { title?: string, artist?: string, coverBase64?: string, coverUrl?: string }) => {
      if (role !== 'listener') return;

      setTrackMetadata(metadata || null);

      const isExternal = streamPath.startsWith('http://') || streamPath.startsWith('https://');
      const finalUri = isExternal ? streamPath : `${SERVER_URL}${streamPath}?t=${Date.now()}`;

      // Load the new stream URL into the player
      player.replace({ uri: finalUri });
      player.setActiveForLockScreen(true, {
        title: metadata?.title || 'JudeBox Stream',
        artist: metadata?.artist || 'Artiste Inconnu',
      });
      // The status listener already set up will handle progress updates
    });

    return () => {
      socket.off('syncState');
      socket.off('newTrack');
    };
  }, [socket, player, role]);

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

  const startOfflineMode = () => {
    setRole('offline');
    setRoomId(''); // No room mapped
  };

  // Actions Audio
  const handleAudioSelection = async (
    uri: string,
    filename: string,
    mimeType: string = 'audio/mpeg',
    autoPlayOnLoad: boolean = false,
    context?: { type: 'library' } | { type: 'playlist', id: string }
  ) => {
    try {
      setCurrentFileURI(filename);
      if (context) {
        setCurrentPlaybackContext(context);
      }

      setIsUploading(true);
      setShowLocalLibrary(false);

      let audioStreamUri = '';
      let coverData: { title?: string, artist?: string, coverBase64?: string, coverUrl?: string } | null = null;

      const isFSound = uri.startsWith('fsound://');

      if (isFSound) {
        const match = uri.match(/^fsound:\/\/([^?]+)/);
        const trackId = match ? match[1] : '';
        const artistMatch = uri.match(/[?&]artist=([^&]+)/);
        const titleMatch = uri.match(/[?&]title=([^&]+)/);
        const coverUrlMatch = uri.match(/[?&]coverUrl=([^&]+)/);
        const artist = artistMatch ? decodeURIComponent(artistMatch[1]) : '';
        const title = titleMatch ? decodeURIComponent(titleMatch[1]) : '';
        const coverUrl = coverUrlMatch ? decodeURIComponent(coverUrlMatch[1]) : '';

        try {
          audioStreamUri = await resolveTrack(trackId, artist, title);
          coverData = { title, artist, coverUrl: coverUrl || undefined };
          setTrackMetadata(coverData);
        } catch (err) {
          console.warn("[FSound Resolve Error]:", err);
          setIsUploading(false);
          Alert.alert('Erreur', 'Impossible de récupérer le flux de lecture pour ce morceau.');
          return;
        }

        if (role !== 'offline') {
          socket?.emit("playTrackUrl", roomId, audioStreamUri, coverData);
        }
      } else {
        if (role === 'offline') {
          // Mode Hors Ligne: on lit le fichier local directement
          audioStreamUri = uri;
          coverData = await extractLocalMetadata(uri, filename);
          setTrackMetadata(coverData);
        } else {
          // Mode Hôte Online: upload vers le serveur
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
          coverData = resData.metadata || null;
          setTrackMetadata(coverData);
          audioStreamUri = SERVER_URL + resData.streamUrl;
        }
      }

      // Load new source with the expo-audio player
      player.replace(audioStreamUri);

      player.setActiveForLockScreen(true, {
        title: coverData?.title || filename.replace('.mp3', ''),
        artist: coverData?.artist || 'Artiste Inconnu',
      });

      if (autoPlayOnLoad) {
        player.play();
        setIsPlaying(true);
        currentIsPlayingRef.current = true;

        if (role !== 'offline') {
          socket?.emit('updateState', roomId, { isPlaying: true, positionMillis: 0 });
        }
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



  const togglePlayHost = () => {
    if (!player.isLoaded) return;

    if (player.playing) {
      player.pause();
      setIsPlaying(false);
      currentIsPlayingRef.current = false;
      if (role !== 'offline') {
        socket?.emit('updateState', roomId, { isPlaying: false, positionMillis: player.currentTime * 1000 });
      }
    } else {
      player.play();
      setIsPlaying(true);
      currentIsPlayingRef.current = true;
      if (role !== 'offline') {
        socket?.emit('updateState', roomId, { isPlaying: true, positionMillis: player.currentTime * 1000 });
      }
    }
  };

  const leaveRoom = () => {
    if (socket && roomId && role !== 'offline') {
      socket.emit('leaveRoom', roomId);
    }
    setRole(null);
    setRoomId('');
    player.pause();
    player.clearLockScreenControls();
    setTrackMetadata(null);
  };

  // --- RENDUS COMPOSANTS ---

  if (!role) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <LobbyView
            roomId={roomId}
            setRoomId={setRoomId}
            isConnected={isConnected}
            joinRoom={joinRoom}
            createRoom={createRoom}
            startOfflineMode={startOfflineMode}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <Toast visible={toastVisible} message={toastMessage} onHide={() => setToastVisible(false)} type="success" />
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>{role === 'offline' ? 'Mode Hors Ligne' : `Salon ${roomId}`}</Text>
            <Text style={styles.headerRole}>
              {role === 'offline' ? '🎧 Écoute Locale' : (role === 'host' ? '👑 Vous êtes l\'Hôte' : '🎧 Vous êtes Auditeur')}
            </Text>
          </View>
          <TouchableOpacity style={styles.leaveBtn} onPress={leaveRoom}>
            <LogOut size={20} color={COLORS.danger} />
          </TouchableOpacity>
        </View>

        <View style={styles.roomContent}>
          {(role === 'host' || role === 'offline') && (
            <HostPlayerView
              isPlaying={isPlaying}
              trackMetadata={trackMetadata}
              currentFileURI={currentFileURI}
              progress={progress}
              isAutoPlay={isAutoPlay}
              isUploading={isUploading}
              playerLoaded={player.isLoaded}
              hasNextTrack={getNextTrackInfo() !== null}
              nextTrackFilename={getNextTrackInfo()?.filename}
              currentPlaybackContextType={currentPlaybackContext.type}
              onToggleLibrary={toggleLibraryPanel}
              onPlayPrevious={playPreviousTrack}
              onPlayNext={playNextTrack}
              onTogglePlay={togglePlayHost}
              onToggleAutoPlay={() => setIsAutoPlay(!isAutoPlay)}
            />
          )}

          {/* Animated Library Side Panel over content */}
          {(role === 'host' || role === 'offline') && (
            <Animated.View style={[styles.sidePanel, { transform: [{ translateX: slideAnim }] }]}>
              <View style={styles.sidePanelHeader}>
                <Text style={styles.sidePanelTitle}>Médiathèque</Text>
                <TouchableOpacity onPress={toggleLibraryPanel} style={styles.closePanelBtn}>
                  <X size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.tabContainer}>
                <TouchableOpacity
                  style={[styles.tabBtn, activeTab === 'library' && styles.activeTabBtn]}
                  onPress={() => setActiveTab('library')}
                >
                  <Library size={18} color={activeTab === 'library' ? COLORS.text : COLORS.textMuted} />
                  <Text style={[styles.tabText, activeTab === 'library' && styles.activeTabText]}>Local</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tabBtn, activeTab === 'playlists' && styles.activeTabBtn]}
                  onPress={() => setActiveTab('playlists')}
                >
                  <FolderHeart size={18} color={activeTab === 'playlists' ? COLORS.text : COLORS.textMuted} />
                  <Text style={[styles.tabText, activeTab === 'playlists' && styles.activeTabText]}>Playlists</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tabBtn, activeTab === 'fsound' && styles.activeTabBtn]}
                  onPress={() => setActiveTab('fsound')}
                >
                  <Search size={18} color={activeTab === 'fsound' ? COLORS.text : COLORS.textMuted} />
                  <Text style={[styles.tabText, activeTab === 'fsound' && styles.activeTabText]}>En ligne</Text>
                </TouchableOpacity>
              </View>

              {activeTab === 'library' ? (
                <LocalAudioList
                  onSelectTrack={(uri, filename) => handleAudioSelection(uri, filename, 'audio/mpeg', false, { type: 'library' })}
                  onTracksLoaded={(tracks) => setAllLocalTracks(tracks)}
                  onAddToPlaylist={(uri, filename) => {
                    setTrackToAdd({ uri, filename });
                    setPlaylistModalVisible(true);
                  }}
                />
              ) : activeTab === 'playlists' ? (
                <PlaylistsView
                  playlists={playlists}
                  onCreatePlaylist={createPlaylist}
                  onDeletePlaylist={deletePlaylist}
                  onRemoveTrack={removeTrackFromPlaylist}
                  onPlayTrack={(track, playlistId) => handleAudioSelection(track.uri, track.filename, 'audio/mpeg', false, { type: 'playlist', id: playlistId })}
                  onPlayPlaylist={(playlistId) => {
                    const playlist = playlists.find(p => p.id === playlistId);
                    if (playlist && playlist.tracks.length > 0) {
                      handleAudioSelection(
                        playlist.tracks[0].uri,
                        playlist.tracks[0].filename,
                        'audio/mpeg',
                        true,
                        { type: 'playlist', id: playlistId }
                      );
                    }
                  }}
                />
              ) : (
                <FSoundSearch
                  onSelectTrack={(uri, filename) => handleAudioSelection(uri, filename, 'audio/mpeg', true)}
                  onAddToPlaylist={(uri, filename) => {
                    setTrackToAdd({ uri, filename });
                    setPlaylistModalVisible(true);
                  }}
                />
              )}
            </Animated.View>
          )}

          {role === 'listener' && (
            <ListenerPlayerView
              isPlaying={isPlaying}
              trackMetadata={trackMetadata}
              progress={progress}
              playerLoaded={player.isLoaded}
            />
          )}

          {/* Modal Add to Playlist */}
          <Modal visible={isPlaylistModalVisible} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Ajouter à la playlist</Text>
                  <TouchableOpacity onPress={() => setPlaylistModalVisible(false)}>
                    <X size={24} color={COLORS.text} />
                  </TouchableOpacity>
                </View>

                {playlists.length === 0 ? (
                  <View style={styles.modalEmpty}>
                    <Text style={styles.modalEmptyText}>Aucune playlist disponible.</Text>
                    <Text style={styles.modalEmptySubText}>Créez-en une depuis l'onglet Playlists.</Text>
                  </View>
                ) : (
                  <FlatList
                    data={playlists}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.modalPlaylistBtn}
                        onPress={() => {
                          if (trackToAdd) {
                            addTrackToPlaylist(item.id, trackToAdd);
                            setPlaylistModalVisible(false);
                            showToast(`Ajouté à "${item.name}"`);
                          }
                        }}
                      >
                        <FolderHeart size={20} color={COLORS.accent} />
                        <Text style={styles.modalPlaylistText}>{item.name}</Text>
                      </TouchableOpacity>
                    )}
                  />
                )}
              </View>
            </View>
          </Modal>

        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

