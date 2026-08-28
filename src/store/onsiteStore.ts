import { create } from 'zustand';
import { OnsiteTableContext } from '../features/onsite/types';

interface OnsiteState {
  context: OnsiteTableContext | null;
  setContext: (context: OnsiteTableContext | null) => void;
  clearContext: () => void;
}

export const useOnsiteStore = create<OnsiteState>((set) => ({
  context: null,
  setContext: (context) => set({ context }),
  clearContext: () => set({ context: null }),
}));
