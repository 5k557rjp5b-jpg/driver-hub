import { Alert, Platform } from 'react-native';

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

/**
 * Cross-platform confirm. React Native Web's Alert.alert is a no-op
 * (`static alert() {}`), so web must use window.confirm.
 */
export function confirmAction({
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  destructive = false,
}: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === 'web') {
    const text = [title, message].filter(Boolean).join('\n\n');
    return Promise.resolve(typeof window !== 'undefined' ? window.confirm(text) : false);
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      {
        text: cancelLabel,
        style: 'cancel',
        onPress: () => resolve(false),
      },
      {
        text: confirmLabel,
        style: destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}
