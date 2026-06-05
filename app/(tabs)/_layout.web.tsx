/**
 * app/(tabs)/_layout.web.tsx
 *
 * Web-only tab layout.  Metro picks this file over _layout.tsx for web builds.
 *
 * --------------------------------------------------------------------------
 * Why this file does NOT use expo-router's <Tabs /> on desktop
 * --------------------------------------------------------------------------
 * Expo static export performs an SSR pass during `expo export -p web`.
 * During that pass `useWindowDimensions()` returns `{ width: 0, height: 0 }`,
 * so any branching that depends on viewport width evaluates the mobile path
 * at build time and ships HTML containing the bottom-tab layout.  Worse,
 * <Tabs /> appears to commit its tab-bar layout at first render and does not
 * re-render cleanly when the dimensions hook updates post-hydration —
 * meaning desktop users saw a mobile-shaped page even after JS booted.
 *
 * Fix: on desktop, skip <Tabs /> entirely and render <Slot /> ourselves
 * inside a custom shell with a sidebar.  <Slot /> renders whichever child
 * route is currently active without locking in any tab-bar layout.
 * On mobile/tablet we still use <Tabs /> so the bottom-bar experience is
 * untouched.
 *
 * The `hasMounted` gate prevents a hydration mismatch / mobile-flash by
 * rendering a null shell on the very first SSR render, then re-rendering
 * with the real `window.innerWidth` post-mount.
 *
 * File ownership: web-dev  — do NOT edit _layout.tsx (native/frontend-dev).
 */

import { useResponsive } from '@/lib/responsive';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Slot, Tabs, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
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
  /** Path we push to when the item is tapped. */
  href: string;
  title: string;
  iconFocused: React.ComponentProps<typeof Ionicons>['name'];
  iconDefault: React.ComponentProps<typeof Ionicons>['name'];
};

const NAV_ITEMS: NavItem[] = [
  { name: 'index',           href: '/(tabs)',                 title: 'Home',    iconFocused: 'home-sharp', iconDefault: 'home-outline'   },
  { name: 'lists',           href: '/(tabs)/lists',           title: 'Lists',   iconFocused: 'list',       iconDefault: 'list-outline'   },
  { name: 'search',          href: '/(tabs)/search',          title: 'Search',  iconFocused: 'search',     iconDefault: 'search-outline' },
  { name: 'recommendations', href: '/(tabs)/recommendations', title: 'For You', iconFocused: 'star',       iconDefault: 'star-outline'   },
  { name: 'profile',         href: '/(tabs)/profile',         title: 'Profile', iconFocused: 'person',     iconDefault: 'person-outline' },
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
  activeName,
  onNavigate,
}: {
  activeName: string;
  onNavigate: (item: NavItem) => void;
}) {
  return (
    <View style={sidebarStyles.sidebar}>
      <View style={sidebarStyles.wordmark}>
        <Text style={sidebarStyles.wordmarkText}>Rankr</Text>
      </View>

      <View style={sidebarStyles.navList}>
        {NAV_ITEMS.map((item) => (
          <SidebarItem
            key={item.name}
            item={item}
            focused={activeName === item.name}
            onPress={() => onNavigate(item)}
          />
        ))}
      </View>

      <View style={sidebarStyles.shortcutHint}>
        <Ionicons name="search-outline" size={12} color="#555" />
        <Text style={sidebarStyles.shortcutText}>Cmd/Ctrl+K to search</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Mobile tab bar (mirrors _layout.tsx visually — used for < 1024 px)
// ---------------------------------------------------------------------------
function MobileTabs() {
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
            <View style={[mobileStyles.iconWrapper, focused && mobileStyles.activeWrapper]}>
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
            <View style={[mobileStyles.iconWrapper, focused && mobileStyles.activeWrapper]}>
              <Ionicons name={focused ? 'list' : 'list-outline'} color={color} size={22} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ focused }) => (
            <View style={[mobileStyles.searchWrapper, focused && mobileStyles.searchActive]}>
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
            <View style={[mobileStyles.iconWrapper, focused && mobileStyles.activeWrapper]}>
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
            <View style={[mobileStyles.iconWrapper, focused && mobileStyles.activeWrapper]}>
              <Ionicons name={focused ? 'person' : 'person-outline'} color={color} size={22} />
            </View>
          ),
        }}
      />
      <Tabs.Screen name="profile-settings" options={{ href: null }} />
    </Tabs>
  );
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

/**
 * Resolve the currently active tab name from the segment array.
 * Segments look like ['(tabs)'] for / or ['(tabs)', 'lists'] for /lists.
 */
function activeTabFromSegments(segments: string[]): string {
  // First segment after '(tabs)' (if any) is the tab name.  No second segment
  // means we're on the index tab.
  const tabsIndex = segments.indexOf('(tabs)');
  const next = tabsIndex >= 0 ? segments[tabsIndex + 1] : undefined;
  return next ?? 'index';
}

export default function TabLayoutWeb() {
  const router = useRouter();
  const segments = useSegments() as string[];
  const { width, isDesktop, isWide } = useResponsive();

  // -------------------------------------------------------------------
  // Hydration gate
  //
  // During SSR `useWindowDimensions()` returns { width: 0 }.  Rendering the
  // mobile branch at build time and the desktop branch post-hydration causes
  // React to either flash the mobile layout or — worse, with reactCompiler
  // enabled — keep the SSR tree because React thinks nothing changed.
  //
  // Solution: don't decide which branch to render until after mount.  We
  // also read `window.innerWidth` directly here because useResponsive() may
  // still return a stale value during the first useEffect tick on some
  // browsers.
  // -------------------------------------------------------------------
  const [hasMounted, setHasMounted] = useState(false);
  const [postMountWidth, setPostMountWidth] = useState(0);

  useEffect(() => {
    setHasMounted(true);
    if (typeof window !== 'undefined') {
      setPostMountWidth(window.innerWidth);
      const onResize = () => setPostMountWidth(window.innerWidth);
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }
  }, []);

  // Use the most reliable signal we have for "desktop".
  const effectiveWidth = hasMounted ? Math.max(postMountWidth, width) : 0;
  const showSidebar = hasMounted && effectiveWidth >= 1024;

  // Diagnostic — surfaces in the browser console so we can verify behaviour
  // on the deployed Vercel site.
  useEffect(() => {
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-console
      console.log('[layout]', {
        hasMounted,
        width,
        postMountWidth,
        effectiveWidth,
        isDesktop,
        isWide,
        showSidebar,
      });
    }
  }, [hasMounted, width, postMountWidth, effectiveWidth, isDesktop, isWide, showSidebar]);

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

  // -------------------------------------------------------------------
  // Branch 1 — SSR / first render before mount.  Render a minimal shell
  // that matches the eventual mobile tree shape so hydration succeeds
  // without warnings, then immediately re-render once hasMounted flips.
  // -------------------------------------------------------------------
  if (!hasMounted) {
    return <MobileTabs />;
  }

  // -------------------------------------------------------------------
  // Branch 2 — Desktop: bypass <Tabs /> entirely.  Render a sidebar +
  // <Slot /> for the active route.  This avoids the issue where the
  // <Tabs /> bottom-bar layout was being committed at SSR time and
  // refusing to give way after hydration.
  // -------------------------------------------------------------------
  if (showSidebar) {
    const activeName = activeTabFromSegments(segments);
    return (
      <View style={shellStyles.desktopShell}>
        <Sidebar
          activeName={activeName}
          onNavigate={(item) => router.push(item.href as any)}
        />
        <View style={shellStyles.contentColumn}>
          <Slot />
        </View>
      </View>
    );
  }

  // -------------------------------------------------------------------
  // Branch 3 — Mobile / tablet: keep the original bottom-tab layout.
  // -------------------------------------------------------------------
  return <MobileTabs />;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const shellStyles = StyleSheet.create({
  desktopShell: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#0f0f13',
    minHeight: '100%' as any,
  },
  contentColumn: {
    flex: 1,
    backgroundColor: '#0f0f13',
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

const mobileStyles = StyleSheet.create({
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
});
