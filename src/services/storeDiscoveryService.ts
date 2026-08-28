import { useSupabase } from '../lib/supabase';
import { locationService } from './locationService';

export type DiscoveryGroup = 'bar' | 'restaurant' | 'general' | 'other';

export interface StoreDiscoveryLocation {
  cityId: string | null;
  countryId: string | null;
  cityName: string | null;
  countryName: string | null;
}

export interface StoreDiscoveryGroups {
  bar: any[];
  restaurant: any[];
  general: any[];
  other: any[];
}

export interface StoreDiscoveryResult {
  stores: any[];
  groups: StoreDiscoveryGroups;
  location: StoreDiscoveryLocation;
}

const EMPTY_LOCATION: StoreDiscoveryLocation = {
  cityId: null,
  countryId: null,
  cityName: null,
  countryName: null,
};

async function resolveCurrentLocation(): Promise<StoreDiscoveryLocation> {
  try {
    const coords = await locationService.getCurrentPosition();
    if (!coords) return EMPTY_LOCATION;

    const address = await locationService.reverseGeocode(coords.latitude, coords.longitude);
    if (!address?.country && !address?.city) return EMPTY_LOCATION;

    const client = useSupabase();
    let countryId: string | null = null;
    let cityId: string | null = null;
    let countryName = address.country || null;
    let cityName = address.city || null;

    if (countryName) {
      const { data: country } = await client
        .from('countries')
        .select('id, name')
        .ilike('name', countryName)
        .maybeSingle();
      countryId = country?.id || null;
      countryName = country?.name || countryName;
    }

    if (cityName) {
      let cityQuery = client.from('cities').select('id, name, country_id').ilike('name', cityName);
      if (countryId) cityQuery = cityQuery.eq('country_id', countryId);
      const { data: city } = await cityQuery.maybeSingle();
      cityId = city?.id || null;
      cityName = city?.name || cityName;
    }

    return { cityId, countryId, cityName, countryName };
  } catch (error) {
    console.warn('[storeDiscoveryService] Unable to resolve location:', error);
    return EMPTY_LOCATION;
  }
}

export const storeDiscoveryService = {
  async getHomeTopStores(): Promise<StoreDiscoveryResult> {
    const location = await resolveCurrentLocation();
    const client = useSupabase();

    const { data, error } = await client.rpc('get_popular_stores', {
      p_limit: 20,
      p_city_id: location.cityId,
      p_country_id: location.countryId,
    });

    if (error) throw error;

    // The backend is responsible for selecting, ranking and grouping the home Tops.
    // The client only normalizes the response shape and never calculates groups.
    const payload = (data || {}) as {
      stores?: any[];
      groups?: Partial<StoreDiscoveryGroups>;
    };

    const groups: StoreDiscoveryGroups = {
      bar: Array.isArray(payload.groups?.bar) ? payload.groups!.bar : [],
      restaurant: Array.isArray(payload.groups?.restaurant) ? payload.groups!.restaurant : [],
      general: Array.isArray(payload.groups?.general) ? payload.groups!.general : [],
      other: Array.isArray(payload.groups?.other) ? payload.groups!.other : [],
    };

    const stores = Array.isArray(payload.stores) ? payload.stores : [];

    return { stores, groups, location };
  },
};
