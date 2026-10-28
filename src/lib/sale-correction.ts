import { Alert } from 'react-native';

// "Corregir" (components/sale-detail.tsx) voids the sale first and then opens
// the form to register it again: leaving that form without saving leaves the
// sale voided and nothing registered in its place. These are the warnings.

/** Asked before leaving a correction unsaved; `onLeave` runs only if confirmed. */
export function confirmLeaveCorrection(saleId: number, onLeave: () => void) {
  Alert.alert(
    '¿Salir sin corregir?',
    `La venta #${saleId} ya quedó anulada. Si sales ahora, se queda anulada y no se registra la venta corregida.`,
    [
      { text: 'Seguir corrigiendo', style: 'cancel' },
      { text: 'Salir sin corregir', style: 'destructive', onPress: onLeave },
    ],
  );
}

/**
 * Shown after leaving a correction by switching tabs (a tab change can't be
 * stopped): the cart is kept, so it can still be finished.
 */
export function remindPendingCorrection(saleId: number, onGoBack: () => void, onDrop: () => void) {
  Alert.alert(
    `La venta #${saleId} sigue anulada`,
    'Saliste de Vender sin registrar la venta corregida. Los productos siguen en el carrito.',
    [
      { text: 'Dejarla anulada', style: 'destructive', onPress: onDrop },
      { text: 'Volver a Vender', onPress: onGoBack },
    ],
  );
}
