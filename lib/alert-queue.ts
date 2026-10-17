// The logic behind web dialogs: a queue of pending alerts and what each action does.
// (Kept free of React Native so it can be tested on its own. See web-alert.tsx.)
//
// It mirrors React Native's Alert.alert(title, message?, buttons?, options?) as it
// behaves on iOS/Android:
//  - no buttons means a single OK button
//  - alerts shown while another is open wait their turn
//  - pressing a button closes the alert first, then runs that button's onPress
//  - the cancel button is what Escape / the back button triggers

export type AlertButton = {
  text?: string;
  onPress?: (value?: string) => void;
  style?: 'default' | 'cancel' | 'destructive';
};

export type AlertOptions = {
  cancelable?: boolean;
  onDismiss?: () => void;
};

export type AlertEntry = {
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
  options?: AlertOptions;
};

export function createAlertQueue() {
  let items: AlertEntry[] = [];
  let nextId = 1;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((fn) => fn());

  // Takes the current alert off the queue; returns it.
  const closeCurrent = (): AlertEntry | undefined => {
    const [current, ...rest] = items;
    items = rest;
    emit();
    return current;
  };

  return {
    enqueue(
      title: string,
      message?: string,
      buttons?: AlertButton[],
      options?: AlertOptions
    ): void {
      items = [
        ...items,
        {
          id: nextId++,
          title,
          message,
          buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }],
          options,
        },
      ];
      emit();
    },

    current: (): AlertEntry | undefined => items[0],
    size: () => items.length,

    subscribe(fn: () => void): () => void {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },

    // A button was pressed: close, then run its handler (which may open another alert).
    press(button: AlertButton): void {
      if (!closeCurrent()) return;
      button.onPress?.();
    },

    // Dismissed without choosing a button (backdrop tap on a cancelable alert).
    dismiss(): void {
      const closed = closeCurrent();
      closed?.options?.onDismiss?.();
    },

    // Escape / back: the cancel button if there is one, otherwise only if cancelable.
    escape(): void {
      const current = items[0];
      if (!current) return;
      const cancel = current.buttons.find((b) => b.style === 'cancel');
      if (cancel) this.press(cancel);
      else if (current.options?.cancelable) this.dismiss();
    },
  };
}

export type AlertQueue = ReturnType<typeof createAlertQueue>;
