import { useEffect, useState } from 'react';
import { AppState, Image, type ImageStyle, type StyleProp, View } from 'react-native';
import { resolvePhoto } from '@/lib/photoUpload';
import { PHOTO_TTL_SECONDS } from '@/lib/photoReferences';
import { supabase } from '@/lib/supabase';

/** Expiring URLs stay in memory, renew while mounted, and clear on auth changes. */
export function UserPhoto({ reference, style, label }: { reference: string; style: StyleProp<ImageStyle>; label: string }) {
  const [source, setSource] = useState<{ reference: string; uri: string } | null>(null);
  useEffect(() => {
    let disposed = false;
    let generation = 0;
    const refresh = async () => {
      const current = ++generation;
      try {
        const uri = await resolvePhoto(reference);
        if (!disposed && current === generation) setSource(uri ? { reference, uri } : null);
      } catch { if (!disposed && current === generation) setSource(null); }
    };
    void refresh();
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, (PHOTO_TTL_SECONDS - 20) * 1000);
    const app = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh();
      else { generation++; setSource(null); }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      generation++; setSource(null);
      // Auth callbacks must not await another Supabase operation.
      setTimeout(() => { if (!disposed) void refresh(); }, 0);
    });
    return () => { disposed = true; clearInterval(timer); app.remove(); subscription.unsubscribe(); };
  }, [reference]);
  if (!source || source.reference !== reference) return <View style={style} accessibilityLabel={`${label}: unavailable`} accessible />;
  return <Image source={{ uri: source.uri, cache: 'reload' }} style={style} accessibilityLabel={label} onError={() => setSource(null)} />;
}
