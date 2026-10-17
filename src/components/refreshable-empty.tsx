import { ReactElement, ReactNode } from 'react';
import { RefreshControlProps, ScrollView } from 'react-native';

// An empty state ("No messages yet") that still supports pull-to-refresh. A plain View
// can't be pulled, so without this the gesture would only work once the list had items.
export function RefreshableEmpty({
  refreshControl,
  children,
}: {
  refreshControl: ReactElement<RefreshControlProps>;
  children: ReactNode;
}) {
  return (
    <ScrollView
      refreshControl={refreshControl}
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}
