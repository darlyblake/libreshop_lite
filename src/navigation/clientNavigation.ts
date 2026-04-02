import type { ClientTabParamList } from './types';

/** Onglets client : évite les doublons stack / tabs. */
export function navigateToClientTab(
  navigation: { navigate: (name: string, params?: object) => void },
  screen: keyof ClientTabParamList
) {
  navigation.navigate('ClientTabs', { screen });
}
