import { z } from 'zod';

// Inventory Item Validation
export const InventoryCategorySchema = z.enum([
  'spirits', 'wine', 'beer', 'mixers', 'garnishes', 'supplies', 'other'
]);

export const InventoryUnitSchema = z.enum([
  'bottle', 'can', 'keg', 'case', 'each', 'liter', 'oz'
]);

export const LocationSlugSchema = z.enum(['noirkc', 'rooftopkc', 'noirop']);

export const InventoryItemSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  category: InventoryCategorySchema,
  subcategory: z.string().max(100).default(''),
  brand: z.string().max(100).default(''),
  quantity: z.number().min(0).finite(),
  unit: InventoryUnitSchema,
  volume_ml: z.number().min(0).finite().optional(),
  cost_per_unit: z.number().min(0).finite().default(0),
  price_per_serving: z.number().min(0).finite().default(0),
  par_level: z.number().min(0).finite().default(0),
  notes: z.string().max(500).default(''),
  image_url: z.string().url().optional().or(z.literal('')),
  location_id: z.string().uuid().optional(),
  location_slug: LocationSlugSchema.optional(),
});

export const UpdateInventoryItemSchema = InventoryItemSchema.partial().extend({
  id: z.string().uuid()
});

export const TransactionTypeSchema = z.enum([
  'add', 'remove', 'adjust', 'count', 'sales', 'waste', 'receive', 'transfer_in', 'transfer_out'
]);

export const TransactionSchema = z.object({
  item_id: z.string().uuid(),
  transaction_type: TransactionTypeSchema,
  quantity_change: z.number().refine(val => val !== 0, 'Quantity change cannot be zero'),
  notes: z.string().max(500).default('')
});

export const TransferSchema = z.object({
  item_id: z.string().uuid(),
  from_location_id: z.string().uuid(),
  to_location_id: z.string().uuid(),
  quantity: z.number().min(1).finite(),
  notes: z.string().max(500).default('')
}).refine(
  data => data.from_location_id !== data.to_location_id,
  { message: 'Source and destination locations must be different', path: ['to_location_id'] }
);

export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, errors: result.error };
  }
}

export function formatZodErrors(errors: z.ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};
  errors.issues.forEach(error => {
    const path = error.path.join('.');
    if (!formatted[path]) formatted[path] = [];
    formatted[path].push(error.message);
  });
  return formatted;
}