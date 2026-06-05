/**
 * app/(tabs)/_layout.web.tsx
 *
 * Web-only tab layout.  Metro picks this file over _layout.tsx for web builds.
 *
 * - Desktop (≥ 1024 px):  persistent left sidebar (240 px) with vertical nav
 *   items, accent bar, hover/active states via Pressable's style callback.
 * - Mobile / tablet (< 1024 px): falls back to the same bottom-tab style as
 *   the native _layout.tsx so the mobile-web experience is unchanged.
 *
 * Keyboard shortcut: Cmd/Ctrl+K → /users/search  (desktop feel)
 *                    Escape      → router.back()
 *
 * File ownership: web-dev  — do NOT edit _layout.tsx (native/frontend-dev).
 */

import { useResponsive } from '@/lib/responsive';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

// ---------------------------------------------------------------------------
// Design tokens (mirror _layout.tsx so both surfaces feel identical)
// ---------------------------------------------------------------------------
const PURPLE = '#7C3AED';
const PURPLE_SOFT = '#7C3AED22';
const PURPLE_TEXT = '#A78BFA';
const TAB_BG = '#13131a';
const SIDEBAR_BG = '#13131a';
const SIDEBAR_BORDER = '#1e1e2a';
const INACTIVE = '#444';
const INACTIVE_LABEL = '#666';

// ---------------------------------------------------------------------------
// Route definitions — order matches _layout.tsx
// ---------------------------------------------------------------------------
type NavItem = {
  name: string;
  title: string;
  iconFocused: React.ComponentProps<typeof Ionicons>['name'];
  iconDefault: React.ComponentProps<typeof Ionicons>['name'];
};

const NAV_ITEMS: NavItem[] = [
  { name: 'index',           title: 'Home',    iconFocused: 'home-sharp',    iconDefault: 'home-outline'    },
  { name: 'lists',           title: 'Lists',   iconFocused: 'list',          iconDefault: 'list-outline'    },
  { name: 'search',          title: 'Search',  iconFocused: 'search',        iconDefault: 'search-outline'  },
  { name: 'recommendations', title: 'For You', iconFocused: 'star',          iconDefault: 'star-outline'    },
  { name: 'profile',         title: 'Profile', iconFocused: 'person',        iconDefault: 'person-outline'  },
];

// ---------------------------------------------------------------------------
// Sidebar nav item
// ---------------------------------------------------------------------------
function SidebarItem({
  item,
  focused,
  onPress,
}: {
  item: NavItem;
  focused: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        sidebarStyles.navItem,
        focused && sidebarStyles.navItemActive,
        !focused && (hovered as boolean) && sidebarStyles.navItemHovered,
        !focused && pressed && sidebarStyles.navItemPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={item.title}
    >
      {/* left accent bar — only visible when active */}
      <View style={[sidebarStyles.accentBar, focused && sidebarStyles.accentBarActive]} />
      <View style={[sidebarStyles.iconWrap, focused && sidebarStyles.iconWrapActive]}>
        <Ionicons
          name={focused ? item.iconFocused : item.iconDefault}
          size={20}
          color={focused ? PURPLE : INACTIVE}
        />
      </View>
      <Text style={[sidebarStyles.navLabel, focused && sidebarStyles.navLabelActive]}>
        {item.title}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Sidebar shell (desktop only)
// ---------------------------------------------------------------------------
function Sidebar({
  state,
  navigation,
}: {
  state: { index: number; routes: { name: string }[] };
  navigation: { navigate: (name: string) => void };
}) {
  return (
    <View style={sidebarStyles.sidebar}>
      {/* wordmark */}
      <View style={sidebarStyles.wordmark}>
        <Text style={sidebarStyles.wordmarkText}>Rankr</Text>
      </View>

      {/* nav items */}
      <View style={sidebarStyles.navList}>
        {NAV_ITEMS.map((item) => {
          const routeIndex = state.routes.findIndex((r) => r.name === item.name);
          const focused = routeIndex === state.index;
          return (
            <SidebarItem
              key={item.name}
              item={item}
              focused={focused}
              onPress={() => navigation.navigate(item.name)}
            />
          );
        })}
      </View>

      {/* bottom hint */}
      <View style={sidebarStyles.shortcutHint}>
        <Ionicons name="search-outline" size={12} color="#555" />
        <Text style={sidebarStyles.shortcutText}>⌘K to search</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Custom tabBar — switches between sidebar (desktop) and bottom bar (mobile)
// ---------------------------------------------------------------------------
function CustomTabBar(props: any) {
  const { isDesktop, isWide } = useResponsive();
  const showSidebar = isDesktop || isWide;

  if (showSidebar) {
    return <Sidebar state={props.state} navigation={props.navigation} />;
  }

  // ---- Mobile / tablet bottom tab bar (mirrors _layout.tsx styling) ----
  const { state, descriptors, navigation } = props;
  return (
    <View style={bottomStyles.tabBar}>
      {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;

        // Grab the nav item definition so we can render icons consistently
        const navItem = NAV_ITEMS.find((n) => n.name === route.name);
        if (!navItem) return null; // hide hidden routes (profile-settings)

        const isSearch = route.name === 'search';

        return (
          <Pressable
            key={route.key}
            onPress={() => navigation.navigate(route.name)}
            style={({ pressed }: { pressed: boolean }) => [
              bottomStyles.tabItem,
              pressed && { opacity: 0.7 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={navItem.title}
          >
            {isSearch ? (
              <View style={[bottomStyles.searchWrapper, focused && bottomStyles.searchActive]}>
                <Ionicons name="search" size={22} color={focused ? '#fff' : INACTIVE} />
              </View>
            ) : (
              <View style={[bottomStyles.iconWrapper, focused && bottomStyles.activeWrapper]}>
                <Ionicons
                  name={focused ? navItem.iconFocused : navItem.iconDefault}
                  size={22}
                  color={focused ? PURPLE : INACTIVE}
                />
              </View>
            )}
            {!isSearch && (
              <Text style={[bottomStyles.label, focused && bottomStyles.labelActive]}>
                {navItem.title}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Root layout component
// ---------------------------------------------------------------------------
export default function TabLayoutWeb() {
  const router = useRouter();
  const { isDesktop, isWide } = useResponsive();
  const showSidebar = isDesktop || isWide;

  // Keyboard shortcuts — web only
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        router.push('/users/search' as any);
      }
      if (e.key === 'Escape') {
        router.back();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [router]);

  return (
    <View style={[shellStyles.root, showSidebar && shellStyles.rootDesktop]}>
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          // Hide the default tab bar completely — CustomTabBar renders it
          tabBarStyle: { display: 'none' },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="lists" options={{ title: 'Lists' }} />
        <Tabs.Screen name="search" options={{ title: 'Search' }} />
        <Tabs.Screen name="recommendations" options={{ title: 'For You' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
        {/* Hide extra screens from the tab bar */}
        <Tabs.Screen name="profile-settings" options={{ href: null }} />
      </Tabs>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const shellStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0f0f13',
  },
  rootDesktop: {
    flexDirection: 'row',
  },
});

const sidebarStyles = StyleSheet.create({
  sidebar: {
    width: 240,
    backgroundColor: SIDEBAR_BG,
    borderRightWidth: 1,
    borderRightColor: SIDEBAR_BORDER,
    paddingTop: 24,
    paddingBottom: 24,
    flexDirection: 'column',
    // sticky on web via position fixed equivalent (react-native-web honours this)
    // We rely on the parent flex row — sidebar stays in place naturally.
  },

  wordmark: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 8,
  },
  wordmarkText: {
    color: PURPLE_TEXT,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },

  navList: {
    flex: 1,
    gap: 2,
    paddingHorizontal: 8,
  },

  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    height: 48,
    paddingRight: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  navItemActive: {
    backgroundColor: PURPLE_SOFT,
  },
  navItemHovered: {
    backgroundColor: '#1e1e2a',
  },
  navItemPressed: {
    backgroundColor: '#252535',
  },

  accentBar: {
    width: 3,
    height: '100%' as any,
    borderRadius: 2,
    backgroundColor: 'transparent',
    marginRight: 8,
  },
  accentBarActive: {
    backgroundColor: PURPLE,
  },

  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  iconWrapActive: {
    backgroundColor: PURPLE_SOFT,
  },

  navLabel: {
    color: INACTIVE_LABEL,
    fontSize: 14,
    fontWeight: '500',
  },
  navLabelActive: {
    color: '#fff',
    fontWeight: '700',
  },

  shortcutHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  shortcutText: {
    color: '#444',
    fontSize: 11,
  },
});

const bottomStyles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: TAB_BG,
    borderTopColor: '#1e1e2a',
    borderTopWidth: 1,
    height: 70,
    paddingBottom: 12,
    paddingTop: 10,
    alignItems: 'center',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeWrapper: {
    backgroundColor: PURPLE_SOFT,
  },
  searchWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1e1e2e',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a3a',
    marginBottom: 4,
  },
  searchActive: {
    backgroundColor: PURPLE,
    borderColor: PURPLE,
    shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  label: {
    color: INACTIVE_LABEL,
    fontSize: 11,
    fontWeight: '600',
  },
  labelActive: {
    color: PURPLE,
  },
});
