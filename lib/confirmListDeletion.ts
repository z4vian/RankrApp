import { Alert, Platform } from 'react-native';

/** React Native Alert has no web implementation; use the browser's dialog. */
export function confirmListDeletion(title: string, onConfirm: () => void): void {
  const message = `Delete “${title}” and all the items in it? This cannot be undone.`;
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(message)) onConfirm();
    return;
  }
  Alert.alert('Delete list?', message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete list', style: 'destructive', onPress: onConfirm },
  ]);
}
