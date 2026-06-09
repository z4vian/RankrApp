import { Image } from 'expo-image';
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radius } from '@/lib/theme';

export interface AvatarProps {
  uri?: string | null;
  name?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/** Circular avatar — renders a remote image or a purple-soft initials fallback. */
export function Avatar({ uri, name, size = 48, style }: AvatarProps) {
  const circleStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  if (uri) {
    return (
      <View style={[circleStyle, styles.imageWrap, style]}>
        <Image
          source={{ uri }}
          style={styles.imageFill}
          contentFit="cover"
        />
      </View>
    );
  }

  const initial = name ? name.charAt(0).toUpperCase() : '?';
  const fontSize = Math.round(size * 0.4);

  return (
    <View style={[circleStyle, styles.fallback, style]}>
      <Text style={[styles.initial, { fontSize }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  imageWrap: {
    backgroundColor: colors.card,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: colors.imageBorder,
  },
  imageFill: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    backgroundColor: colors.purpleSoft,
    borderWidth: 1,
    borderColor: colors.purple,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initial: {
    color: colors.purpleLight,
    fontWeight: '700',
  },
});
