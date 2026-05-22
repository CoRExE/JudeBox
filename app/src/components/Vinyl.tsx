import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, Image } from 'react-native';
import { styles } from '../styles/AppStyles';

interface VinylProps {
  isPlaying: boolean;
  coverBase64?: string;
  coverUrl?: string;
  isLoaded?: boolean;
  defaultIcon: React.ReactNode;
}

export const Vinyl: React.FC<VinylProps> = ({
  isPlaying,
  coverBase64,
  coverUrl,
  isLoaded = true,
  defaultIcon
}) => {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const isSpinning = useRef(false);

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

  return (
    <View style={[styles.vinylContainer, !isLoaded && { opacity: 0.3 }]}>
      <Animated.View style={[styles.vinyl, isPlaying && styles.vinylSpinning, { transform: [{ rotate: spinInterpolate }] }]}>
        {coverBase64 ? (
          <Image
            source={{ uri: `data:image/jpeg;base64,${coverBase64}` }}
            style={styles.coverImage}
          />
        ) : coverUrl ? (
          <Image
            source={{ uri: coverUrl }}
            style={styles.coverImage}
          />
        ) : (
          defaultIcon
        )}
      </Animated.View>
    </View>
  );
};
