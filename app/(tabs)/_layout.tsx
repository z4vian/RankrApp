import { colors, glow } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const INACTIVE = '#444';
const BAR_CONTENT_HEIGHT = 60; // icon + label area
const BAR_TOP_PADDING = 10;
const BAR_MIN_BOTTOM_PADDING = 12;

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, BAR_MIN_BOTTOM_PADDING);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgDeeper,
          borderTopColor: '#1e1e2a',
          borderTopWidth: 1,
          height: BAR_CONTENT_HEIGHT + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: BAR_TOP_PADDING,
          elevation: 0,
        },
        tabBarActiveTintColor: colors.purple,
        tabBarInactiveTintColor: INACTIVE,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrapper, focused && styles.activeWrapper]}>
              <Ionicons name={focused ? 'home-sharp' : 'home-outline'} color={color} size={22} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="lists"
        options={{
          title: 'Lists',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrapper, focused && styles.activeWrapper]}>
              <Ionicons name={focused ? 'list' : 'list-outline'} color={color} size={22} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.searchWrapper, focused && styles.searchActive]}>
              <Ionicons name="search" color={focused ? '#fff' : INACTIVE} size={22} />
            </View>
          ),
          tabBarLabelStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="recommendations"
        options={{
          title: 'For You',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrapper, focused && styles.activeWrapper]}>
              <Ionicons name={focused ? 'star' : 'star-outline'} color={color} size={22} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrapper, focused && styles.activeWrapper]}>
              <Ionicons name={focused ? 'person' : 'person-outline'} color={color} size={22} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile-settings"
        options={{ href: null }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrapper: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  activeWrapper: {
    backgroundColor: '#7C3AED22',
  },
  searchWrapper: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#1e1e2e',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#2a2a3a',
    marginBottom: 4,
  },
  searchActive: {
    backgroundColor: colors.purple,
    borderColor: colors.purple,
    ...glow.purpleStrong,
  },
});