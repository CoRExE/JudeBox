import React from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { RadioTower, Headphones, Radio, Music } from 'lucide-react-native';
import { COLORS } from '../constants/colors';
import { styles } from '../styles/AppStyles';

interface LobbyViewProps {
  roomId: string;
  setRoomId: (id: string) => void;
  isConnected: boolean;
  joinRoom: () => void;
  createRoom: () => void;
  startOfflineMode: () => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  roomId,
  setRoomId,
  isConnected,
  joinRoom,
  createRoom,
  startOfflineMode
}) => {
  return (
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

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>HORS LIGNE</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity style={styles.btnSecondary} onPress={startOfflineMode}>
          <Music size={20} color={COLORS.text} />
          <Text style={styles.btnSecondaryText}>Écouter ma musique (Solo)</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};
