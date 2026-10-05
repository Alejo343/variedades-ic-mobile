import { useCallback, useState } from 'react';

import { useSyncSession } from '@/hooks/use-sync-session';
import { sellersRepo, type Seller } from '@/lib/data';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';

// Role of the logged-in user plus, for a seller, their own local `sellers`
// row (arrives with the first pull, so it can be null right after login).
export function useMySeller(): { isSeller: boolean; seller: Seller | null; loading: boolean } {
  const session = useSyncSession();
  const sellerUuid = session.status === 'authenticated' && session.session.user.role === 'seller' ? session.session.seller?.uuid : undefined;
  const [seller, setSeller] = useState<Seller | null>(null);
  const [loading, setLoading] = useState(Boolean(sellerUuid));

  useDataFocusEffect(
    useCallback(() => {
      if (!sellerUuid) return;
      let cancelled = false;
      sellersRepo.getByUuid(sellerUuid).then((found) => {
        if (cancelled) return;
        setSeller(found);
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, [sellerUuid]),
  );

  return { isSeller: Boolean(sellerUuid), seller, loading };
}
