import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

const PURPLE = '#7C3AED';
const TAB_BG = '#13131a';
const INACTIVE = '#444';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: TAB_BG,
          borderTopColor: '#1e1e2a',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 70,
          paddingBottom: Platform.OS === 'ios' ? 28 : 12,
          paddingTop: 10,
          elevation: 0,
        },
        tabBarActiveTintColor: PURPLE,
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
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
});