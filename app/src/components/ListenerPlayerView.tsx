import React from 'react';
import { View, Text } from 'react-native';
import { Radio, Headphones } from 'lucide-react-native';
import { COLORS } from '../constants/colors';
import { styles } from '../styles/AppStyles';
import { Vinyl } from './Vinyl';

interface ListenerPlayerViewProps {
  isPlaying: boolean;
  trackMetadata: { title?: string, artist?: string, coverBase64?: string, coverUrl?: string } | null;
  progress: number;
  playerLoaded: boolean;
}

export const ListenerPlayerView: React.FC<ListenerPlayerViewProps> = ({
  isPlaying,
  trackMetadata,
  progress,
  playerLoaded
}) => {
  return (
    <View style={styles.playerCard}>
      <Vinyl
        isPlaying={isPlaying}
        coverBase64={trackMetadata?.coverBase64}
        coverUrl={trackMetadata?.coverUrl}
        isLoaded={playerLoaded}
        defaultIcon={isPlaying ? <Radio size={40} color={COLORS.bg} /> : <Headphones size={40} color={COLORS.bg} />}
      />

      <Text style={styles.trackName}>
        {trackMetadata?.title && trackMetadata?.artist
          ? `${trackMetadata.title} - ${trackMetadata.artist}`
          : (trackMetadata?.title || (playerLoaded ? '🎧 En écoute partagée' : '⏳ En attente de musique...'))}
      </Text>
      
      <Text style={[styles.syncStatus, { color: isPlaying ? COLORS.accent : COLORS.textMuted }]}>
        {isPlaying ? "En direct avec l'hôte" : (playerLoaded ? "L'hôte a mis en pause" : "Silence dans le salon")}
      </Text>

      {playerLoaded ? (
        <View style={styles.progressContainer}>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>
      ) : null}
    </View>
  );
};
