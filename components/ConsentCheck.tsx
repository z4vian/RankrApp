import { Pressable, Text } from 'react-native';
import { colors } from '@/lib/theme';
export function ConsentCheck({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={label} onPress={() => onChange(!checked)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, minHeight: 48 }}>
    <Text accessible={false} style={{ color: colors.purpleLight, fontSize: 22, lineHeight: 24 }}>{checked ? '☑' : '☐'}</Text>
    <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 22, flex: 1 }}>{label}</Text>
  </Pressable>;
}
