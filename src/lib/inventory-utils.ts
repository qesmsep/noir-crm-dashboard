/**
 * Inventory Utility Functions
 */

import { UNIT_TO_ML } from '../constants/inventory';
import type { RecipeIngredient } from '../types/inventory';

/**
 * Safely parses JSON string with fallback value
 * @param str - String to parse or already parsed value
 * @param fallback - Fallback value if parsing fails
 * @returns Parsed value or fallback
 */
export function safeJSONParse<T>(str: string | T, fallback: T): T {
  if (typeof str !== 'string') return str;
  // Empty/null-ish strings are a normal initial state, not a parse failure.
  if (str === '' || str === 'null') return fallback;
  try {
    const parsed = JSON.parse(str);
    return parsed;
  } catch (err) {
    // Only log in development to avoid noisy production logs.
    if (process.env.NODE_ENV === 'development') {
      console.error('JSON parse error:', err);
    }
    return fallback;
  }
}

/**
 * Converts ingredient quantity to milliliters
 * @param quantity - Amount of ingredient
 * @param unit - Unit of measurement
 * @returns Quantity in milliliters, or 0 if unit cannot be converted
 */
export function convertToMilliliters(quantity: number, unit: string): number {
  const conversionFactor = UNIT_TO_ML[unit];
  if (conversionFactor === undefined || conversionFactor === 0) {
    return 0;
  }
  return quantity * conversionFactor;
}

/**
 * Calculates the cost of an ingredient based on inventory item pricing
 * @param ingredient - Recipe ingredient with quantity and unit
 * @param itemCostPerUnit - Cost per unit of the inventory item
 * @param itemVolumeML - Volume in mL of the inventory item
 * @returns Cost of the ingredient, or 0 if cannot be calculated
 */
export function calculateIngredientCost(
  ingredient: { quantity: number; unit: string },
  itemCostPerUnit: number,
  itemVolumeML: number
): number {
  if (!itemCostPerUnit || !itemVolumeML) return 0;

  const mlPerUnit = convertToMilliliters(ingredient.quantity, ingredient.unit);
  // Non-volumetric units (each, slice, sprig, ...) have a 0 conversion factor
  // by design, so they contribute no volumetric cost. This is expected, not an
  // error, so return 0 quietly.
  if (mlPerUnit === 0) {
    return 0;
  }

  const costPerMl = itemCostPerUnit / itemVolumeML;
  return costPerMl * mlPerUnit;
}

/**
 * Validates that all ingredients have valid inventory item references
 * @param ingredients - Array of recipe ingredients
 * @param validItemIds - Set of valid inventory item IDs
 * @returns True if all ingredients are valid
 */
export function validateIngredients(
  ingredients: RecipeIngredient[],
  validItemIds: Set<string>
): boolean {
  return ingredients.every(ing =>
    ing.inventory_item_id &&
    ing.quantity > 0 &&
    validItemIds.has(ing.inventory_item_id)
  );
}

/**
 * Sanitizes user input by trimming and limiting length
 * @param input - User input string
 * @param maxLength - Maximum allowed length
 * @returns Sanitized string
 */
export function sanitizeInput(input: string | null | undefined, maxLength: number): string {
  if (!input) return '';
  return input.trim().substring(0, maxLength);
}
