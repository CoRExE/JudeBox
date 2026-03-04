import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Button, TextInput, Alert, Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import { io, Socket } from 'socket.io-client';

// Remplacez par l'IP locale de votre machine pour tester sur un vrai appareil
// Pour l'émulateur Android natif local : 'http://10.0.2.2:3000'
const SERVER_URL = 'http://192.168.1.20:3000';

type Role = 'host' | 'listener' | null;

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomId, setRoomId] = useState('');
  const [role, setRole] = useState<Role>(null);
  const [isConnected, setIsConnected] = useState(false);

  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFileURI, setCurrentFileURI] = useState<string | null>(null);

  // Refs pour éviter des boucles infinies de Socket.io qui déclenche l'Audio qui déclenche Socket.io
  const isUpdatingFromSocket = useRef(false);

  useEffect(() => {
    const newSocket = io(SERVER_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      setRole(null);
    });

    newSocket.on('connect_error', (err) => {
      console.log('Erreur de connexion Socket:', err.message);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Nettoyage Audio
  useEffect(() => {
    return sound ? () => { sound.unloadAsync(); } : undefined;
  }, [sound]);

  // ===== LISTENERS WEBSOCKET =====
  useEffect(() => {
    if (!socket) return;

    // --- Commune ---
    socket.on('syncState', async (state: { isPlaying: boolean, positionMillis: number, updatedAt: number }) => {
      if (!sound || role === 'host') return; // L'hôte est la source de vérité, il ignore ces events

      isUpdatingFromSocket.current = true;

      // Calculer le timestamp réel en prenant en compte la latence réseau
      const now = Date.now();
      const latency = now - state.updatedAt;
      const targetPosition = state.positionMillis + (state.isPlaying ? latency : 0);

      await sound.setPositionAsync(targetPosition);
      if (state.isPlaying) {
        await sound.playAsync();
        setIsPlaying(true);
      } else {
        await sound.pauseAsync();
        setIsPlaying(false);
      }

      setTimeout(() => { isUpdatingFromSocket.current = false; }, 500); // Debounce
    });

    // --- Auditeur Spécifique ---
    socket.on('newTrack', async (streamPath: string) => {
      if (role !== 'listener') return;

      console.log("Nouvelle piste dispo ! Loading stream...", SERVER_URL + streamPath);
      if (sound) await sound.unloadAsync();

      const timestamp = Date.now()
      // On contourne le cache React Native avec un paramètre de requête bidon
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: `${SERVER_URL}${streamPath}?t=${timestamp}` },
        { shouldPlay: false }
      );
      setSound(newSound);
    });

  }, [socket, sound, role]);

  // ===== ACTIONS SALONS =====
  const createRoom = () => {
    if (!roomId) return;
    socket?.emit('createRoom', roomId, (success: boolean) => {
      if (success) setRole('host');
      else Alert.alert('Erreur', 'Cette Room existe déjà.');
    });
  };

  const joinRoom = () => {
    if (!roomId) return;
    socket?.emit('joinRoom', roomId, (success: boolean) => {
      if (success) setRole('listener');
      else Alert.alert('Erreur', 'Room introuvable.');
    });
  };

  // ===== ACTIONS HÔTE =====
  const pickAndUploadAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*' });
      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const file = result.assets[0];
      setCurrentFileURI(file.name);

      // 1. Upload du fichier vers le serveur
      const formData = new FormData();
      formData.append('audio', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'audio/mpeg',
      } as any);

      const uploadRes = await fetch(`${SERVER_URL}/room/${roomId}/upload`, {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (!uploadRes.ok) {
        Alert.alert('Erreur', "Échec de l'upload du fichier.");
        return;
      }

      const resData = await uploadRes.json();

      // 2. Charger le flux depuis le serveur localement pour avoir la même latence que tout le monde
      if (sound) await sound.unloadAsync();
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: SERVER_URL + resData.streamUrl },
        { shouldPlay: false }
      );

      // 3. Écouter l'avancement pour mettre à jour le serveur périodiquement
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if (isUpdatingFromSocket.current) return;

        // Si on est Hôte, on push l'état au serveur quand ça change (Play/Pause)
        // On peut optimiser pour n'envoyer que sur certaines actions plutôt qu'en permanence
        if (status.isPlaying !== isPlaying) {
          setIsPlaying(status.isPlaying);
          socket?.emit('updateState', roomId, {
            isPlaying: status.isPlaying,
            positionMillis: status.positionMillis
          });
        }
      });

      setSound(newSound);

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
      socket?.emit('updateState', roomId, { isPlaying: false, positionMillis: status.positionMillis });
    } else {
      await sound.playAsync();
      setIsPlaying(true);
      socket?.emit('updateState', roomId, { isPlaying: true, positionMillis: status.positionMillis });
    }
  };

  // ===== RENDUS =====
  if (!role) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>JudeBox</Text>
        <Text style={styles.status}>Serveur : {isConnected ? '🟢 Connecté' : '🔴 Déconnecté'}</Text>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Nom du salon (ex: 1234)"
            value={roomId}
            onChangeText={setRoomId}
          />
        </View>

        <View style={styles.buttons}>
          <Button title="Créer un salon (Hôte)" onPress={createRoom} />
          <Button title="Rejoindre (Auditeur)" onPress={joinRoom} color="green" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>JudeBox</Text>
      <Text style={styles.subtitle}>Room : {roomId}</Text>
      <Text style={styles.roleTitle}>Vous êtes : {role === 'host' ? '👑 Hôte' : '🎧 Auditeur'}</Text>

      {role === 'host' && (
        <View style={styles.hostPanel}>
          <Button title="1. Choisir et Uploader un MP3" onPress={pickAndUploadAudio} />
          {currentFileURI && <Text style={styles.fileName}>Fichier : {currentFileURI}</Text>}

          <View style={styles.controls}>
            <Button
              title={isPlaying ? "⏸ Pause (Sync)" : "▶️ Play (Sync)"}
              onPress={togglePlayHost}
              disabled={!sound}
            />
          </View>
        </View>
      )}

      {role === 'listener' && (
        <View style={styles.listenerPanel}>
          <Text style={styles.infoText}>
            {sound ? '🎶 Musique prête. En attente de l\'hôte...' : '⏳ En attente que l\'hôte lance la musique...'}
          </Text>
          <Text style={styles.status}>Statut: {isPlaying ? '▶️ En lecture' : '⏸ En pause'}</Text>
        </View>
      )}

      <Button title="Quitter le salon" onPress={() => setRole(null)} color="red" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 20,
    marginBottom: 10,
  },
  roleTitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 40,
  },
  status: {
    fontSize: 14,
    color: 'gray',
    marginBottom: 20,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 5,
    width: '100%',
    textAlign: 'center',
  },
  buttons: {
    gap: 10,
    width: '100%',
  },
  hostPanel: {
    width: '100%',
    gap: 20,
    marginBottom: 40,
  },
  listenerPanel: {
    marginBottom: 40,
    alignItems: 'center',
  },
  infoText: {
    fontSize: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  fileName: {
    fontSize: 12,
    color: 'gray',
    textAlign: 'center',
  },
  controls: {
    marginTop: 20,
  }
});
