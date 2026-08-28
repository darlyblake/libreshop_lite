/**
 * src/features/onsite/hooks/useOnsiteTable.ts
 * Hook pour valider un token QR et charger le contexte de la table.
 * Utilisé par OnsiteMenuScreen.
 */

import { useState, useEffect } from 'react';
import { onsiteService } from '../services/onsiteService';
import { OnsiteTableContext } from '../types';

type OnsiteTableState =
  | { status: 'loading' }
  | { status: 'valid'; context: OnsiteTableContext }
  | { status: 'error'; message: string };

export function useOnsiteTable(token: string | undefined): OnsiteTableState {
  const [state, setState] = useState<OnsiteTableState>({ status: 'loading' });

  useEffect(() => {
    if (!token) {
      setState({ status: 'error', message: 'QR invalide ou expiré.' });
      return;
    }

    setState({ status: 'loading' });

    onsiteService
      .validateQrToken(token)
      .then(context => {
        setState({ status: 'valid', context });
      })
      .catch(err => {
        setState({
          status: 'error',
          message: err?.message || 'QR invalide ou expiré.',
        });
      });
  }, [token]);

  return state;
}
