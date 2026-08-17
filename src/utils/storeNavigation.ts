/**
 * navigateToStore
 * 
 * Centralise la logique de navigation vers un store.
 * Si le store est de type 'bar' ou 'restaurant', redirige vers BarDetail.
 * Sinon, redirige vers StoreDetail (comportement par défaut).
 */
export function navigateToStore(navigation: any, store: { id: string; store_type?: string; slug?: string }) {
  const isBar = store.store_type === 'bar' || store.store_type === 'restaurant';
  if (isBar) {
    navigation.navigate('BarDetail', { storeId: store.id, slug: store.slug });
  } else {
    navigation.navigate('StoreDetail', { storeId: store.id, slug: store.slug });
  }
}
