import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Play, Pause, SkipBack, SkipForward, Repeat, Repeat1, ListMusic, FolderHeart, Music } from 'lucide-react-native';
import { COLORS } from '../constants/colors';
import { styles } from '../styles/AppStyles';
import { Vinyl } from './Vinyl';

interface HostPlayerViewProps {
  isPlaying: boolean;
  trackMetadata: { title?: string, artist?: string, coverBase64?: string, coverUrl?: string } | null;
  currentFileURI: string | null;
  progress: number;
  isAutoPlay: boolean;
  isUploading: boolean;
  playerLoaded: boolean;
  hasNextTrack: boolean;
  nextTrackFilename?: string;
  currentPlaybackContextType: 'library' | 'playlist';
  onToggleLibrary: () => void;
  onPlayPrevious: () => void;
  onPlayNext: () => void;
  onTogglePlay: () => void;
  onToggleAutoPlay: () => void;
}

export const HostPlayerView: React.FC<HostPlayerViewProps> = ({
  isPlaying,
  trackMetadata,
  currentFileURI,
  progress,
  isAutoPlay,
  isUploading,
  playerLoaded,
  hasNextTrack,
  nextTrackFilename,
  currentPlaybackContextType,
  onToggleLibrary,
  onPlayPrevious,
  onPlayNext,
  onTogglePlay,
  onToggleAutoPlay
}) => {
  return (
    <View style={styles.playerCard}>
      <Vinyl
        isPlaying={isPlaying}
        coverBase64={trackMetadata?.coverBase64}
        coverUrl={trackMetadata?.coverUrl}
        isLoaded={playerLoaded}
        defaultIcon={<Music size={40} color={COLORS.bg} />}
      />

      <Text style={styles.trackName} numberOfLines={1}>
        {trackMetadata?.title && trackMetadata?.artist
          ? `${trackMetadata.title} - ${trackMetadata.artist}`
          : (trackMetadata?.title || currentFileURI || "Aucun fichier sélectionné")}
      </Text>

      {isAutoPlay && nextTrackFilename ? (
        <View style={styles.nextTrackInfo}>
          <Text style={styles.nextTrackLabel}>À suivre :</Text>
          <Text style={styles.nextTrackText} numberOfLines={1}>
            {nextTrackFilename}
          </Text>
        </View>
      ) : null}

      <View style={styles.progressContainer}>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
        </View>
      </View>

      <View style={styles.hostControls}>
        <TouchableOpacity style={styles.actionBtn} onPress={onToggleLibrary} disabled={isUploading}>
          {(currentPlaybackContextType === 'playlist') ? (
            <FolderHeart size={24} color={COLORS.accent} />
          ) : (
            <ListMusic size={24} color={COLORS.text} />
          )}
        </TouchableOpacity>

        <View style={styles.playbackControls}>
          <TouchableOpacity style={styles.secondaryActionBtn} onPress={onPlayPrevious} disabled={!playerLoaded}>
            <SkipBack size={28} color={playerLoaded ? COLORS.text : COLORS.textMuted} fill={playerLoaded ? COLORS.text : COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.playBtn, !playerLoaded && styles.btnDisabled]}
            onPress={onTogglePlay}
            disabled={!playerLoaded}>
            {isPlaying ? <Pause size={32} color="#fff" /> : <Play size={32} color="#fff" style={{ marginLeft: 4 }} />}
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryActionBtn} onPress={onPlayNext} disabled={!playerLoaded || !hasNextTrack}>
            <SkipForward size={28} color={playerLoaded && hasNextTrack ? COLORS.text : COLORS.textMuted} fill={playerLoaded && hasNextTrack ? COLORS.text : COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.actionBtn, isAutoPlay && styles.activeActionBtn]} onPress={onToggleAutoPlay}>
          {isAutoPlay ? <Repeat size={24} color={COLORS.bg} /> : <Repeat1 size={24} color={COLORS.textMuted} />}
        </TouchableOpacity>
      </View>
    </View>
  );
};
