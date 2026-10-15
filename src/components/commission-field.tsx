import { FormField, FormInput } from '@/components/form';
import { formatCommissionPercent, lineCommission, parseCommissionPercent } from '@/lib/domain/commission';
import { formatCOP } from '@/lib/format';

/** Stored basis points → what the field shows ("15", "12,5"). */
export function commissionToText(bps: number): string {
  return formatCommissionPercent(bps).replace('%', '');
}

// The sellers' commission on a product, typed as a percentage ("15", "12,5").
// Shared by "Nuevo producto" (both modes) and "Editar producto"; the screen
// keeps the text and parses it with domain/commission.ts#parseCommissionPercent
// (null = can't save: the commission is required).
export function CommissionField({ value, onChange, salePrice }: { value: string; onChange: (text: string) => void; salePrice: number | null }) {
  const bps = parseCommissionPercent(value);
  const hint =
    value.trim() === ''
      ? 'Obligatoria. Porcentaje del precio de venta que gana cualquier vendedor con este producto.'
      : bps === null
        ? 'Escribe un porcentaje entre 0 y 100, ej. 15 o 12,5.'
        : salePrice
          ? `Todo vendedor gana ${formatCOP(lineCommission({ quantity: 1, unitPrice: salePrice, commissionBps: bps }))} por unidad vendida a ${formatCOP(salePrice)}.`
          : 'Porcentaje del precio de venta que gana cualquier vendedor con este producto.';
  return (
    <FormField label="Comisión del vendedor" hint={hint}>
      <FormInput value={value} onChangeText={onChange} keyboardType="decimal-pad" suffix="%" placeholder="Ej. 15" />
    </FormField>
  );
}
