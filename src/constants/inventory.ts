/**
 * Inventory System Constants
 */

// Z-Index values for consistent stacking
export const Z_INDEX = {
  MODAL_OVERLAY: 10000,
  MODAL: 10001,
  NESTED_MODAL_OVERLAY: 20000,
  NESTED_MODAL: 20001,
  DROPDOWN: 1000,
  TOOLTIP: 30000,
} as const;

// Unit conversion constants
export const OZ_TO_ML = 29.5735;

export const UNIT_TO_ML: Record<string, number> = {
  'oz': 29.5735,
  'ml': 1,
  'dash': 0.92, // ~1/32 oz
  'splash': 3.7, // ~1/8 oz
  'barspoon': 5,
  'each': 0, // Cannot calculate
  'slice': 0,
  'sprig': 0,
  'wheel': 0,
  'drop': 0.05,
} as const;

// UI timing constants
export const DROPDOWN_CLOSE_DELAY_MS = 200;
export const SEARCH_DEBOUNCE_MS = 300;

// Form field limits
export const MAX_DESCRIPTOR_LENGTH = 20;
export const MAX_RECIPE_NAME_LENGTH = 255;
export const MAX_DESCRIPTION_LENGTH = 1000;
export const DEFAULT_VOLUME_ML = 750;

// Default categories
export const DEFAULT_INVENTORY_CATEGORIES = [
  'spirits',
  'wine',
  'beer',
  'mixers',
  'garnishes',
  'supplies',
  'other',
] as const;

export const DEFAULT_SUBCATEGORY_OPTIONS: Record<string, string[]> = {
  spirits: ['Vodka', 'Gin', 'Rum', 'Tequila', 'Whiskey', 'Bourbon', 'Scotch', 'Brandy', 'Cognac', 'Mezcal', 'Liqueur', 'Other'],
  wine: ['Red', 'White', 'Rosé', 'Sparkling', 'Champagne', 'Other'],
  beer: ['Lager', 'IPA', 'Stout', 'Pilsner', 'Wheat', 'Sour', 'Craft', 'Import', 'Other'],
  mixers: ['Juice', 'Soda', 'Tonic', 'Syrup', 'Bitters', 'Cream', 'Other'],
  garnishes: ['Citrus', 'Olives', 'Cherries', 'Herbs', 'Other'],
  supplies: ['Glassware', 'Ice', 'Straws', 'Napkins', 'Other'],
  other: ['Other'],
} as const;
