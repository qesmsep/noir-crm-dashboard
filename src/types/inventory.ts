/**
 * Inventory Management System Types
 * Covers inventory items, recipes, sales processing, and AI scanning
 */

// ========================================
// Inventory Item Types
// ========================================

export type InventoryCategory =
  | 'spirits'
  | 'wine'
  | 'beer'
  | 'mixers'
  | 'garnishes'
  | 'supplies'
  | 'other';

export type InventoryUnit =
  | 'bottle'
  | 'can'
  | 'keg'
  | 'each'
  | 'liter'
  | 'oz'
  | 'case';

export type RecipeIngredientUnit =
  | 'oz'
  | 'ml'
  | 'dash'
  | 'splash'
  | 'barspoon'
  | 'each'
  | 'slice'
  | 'sprig'
  | 'wheel'
  | 'drop';

export interface InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  subcategory: string;
  brand: string;
  quantity: number;
  unit: InventoryUnit;
  volume_ml: number;
  cost_per_unit: number;
  price_per_serving: number;
  par_level: number;
  notes: string;
  image_url: string;
  last_counted: string;
  location_id: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryItemFormData {
  name: string;
  category: InventoryCategory;
  subcategory: string;
  brand: string;
  quantity: number;
  unit: InventoryUnit;
  volume_ml: number;
  cost_per_unit: number;
  price_per_serving: number;
  par_level: number;
  notes: string;
  location_id?: string;
}

// ========================================
// Recipe Types
// ========================================

export type RecipeCategory =
  | 'cocktail'
  | 'mocktail'
  | 'shot'
  | 'beer'
  | 'wine'
  | 'other';

export interface RecipeIngredient {
  inventory_item_id: string;
  name: string;
  quantity: number;
  unit: RecipeIngredientUnit;
}

export interface Recipe {
  id: string;
  name: string;
  category: RecipeCategory;
  descriptors?: string[]; // 3 descriptor words
  description: string;
  instructions: string;
  ingredients: RecipeIngredient[];
  estimated_cost?: number;
  menu_price: number;
  margin?: number;
  image_url: string;
  glass_type?: string;
  garnish?: string;
  location_id?: string | null; // Primary location (nullable, deprecated)
  location_ids?: string[]; // Multi-location support (recommended)
  batch_ingredients?: RecipeIngredient[]; // Saved batch quantities
  batch_yield?: number; // How many cocktails the batch makes
  batch_instructions?: string; // Batch-specific instructions
  created_at: string;
  updated_at: string;
}

// Database types for API layer (more specific than client types)
export interface DBRecipe {
  id: string;
  name: string;
  category: string;
  descriptors?: string[] | null;
  description: string;
  instructions: string;
  ingredients: string | RecipeIngredient[]; // Can be JSON string from DB
  estimated_cost?: number | null;
  menu_price: number;
  margin?: number | null;
  image_url: string;
  glass_type?: string | null;
  garnish?: string | null;
  location_id?: string | null;
  location_ids?: string[] | null;
  batch_ingredients?: string | RecipeIngredient[] | null;
  batch_yield?: number | null;
  batch_instructions?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DBInventoryItem {
  id: string;
  name: string;
  cost_per_unit: number;
  volume_ml: number;
}

export interface RecipeFormData {
  name: string;
  category: RecipeCategory;
  descriptors?: string[]; // 3 descriptor words
  description: string;
  instructions: string;
  ingredients: RecipeIngredient[];
  menu_price: number;
  glass_type?: string;
  garnish?: string;
  location_id?: string; // For backward compatibility
  location_ids?: string[]; // Multi-location assignment
  batch_ingredients?: RecipeIngredient[]; // Saved batch quantities
  batch_yield?: number; // How many cocktails the batch makes
  batch_instructions?: string; // Batch-specific instructions
}

// ========================================
// Sales Types
// ========================================

export interface SalesItem {
  name: string;
  quantity_sold: number;
  revenue: number;
  matched_recipe_id: string;
  matched_inventory_items: {
    id: string;
    name: string;
    quantity_deducted: number;
  }[];
}

export interface SalesRecord {
  id: string;
  upload_date: string;
  period_start: string;
  period_end: string;
  source_filename: string;
  items: SalesItem[];
  total_revenue: number;
  total_cost: number;
  status: 'pending' | 'reviewing' | 'processed' | 'error';
  created_at: string;
}

// ========================================
// AI Scan Types
// ========================================

export interface ScanResult {
  items: ScannedItem[];
  confidence: number;
  raw_response: string;
}

export interface ScannedItem {
  name: string;
  brand: string;
  category: InventoryCategory;
  estimated_quantity: number;
  unit: InventoryUnit;
  confidence: number;
  matched_inventory_id?: string;
  selected_locations?: LocationSlug[];
}

// ========================================
// Tab & UI Types
// ========================================

export type InventoryTab = 'inventory' | 'recipes' | 'sales' | 'history';

export interface InventoryStats {
  total_items: number;
  total_value: number;
  low_stock_count: number;
  categories: { category: InventoryCategory; count: number }[];
}

// ========================================
// Location Types
// ========================================

export type LocationSlug = 'noirkc' | 'rooftopkc' | 'noirop' | 'all';

export interface InventoryLocation {
  id: string;
  slug: LocationSlug;
  name: string;
  is_active: boolean;
}

export interface SalesReportItem {
  item_name: string;
  quantity_sold: number;
  unit_price?: number;
  total_revenue?: number;
}

export interface SalesReport {
  location_id: string;
  report_date: string;
  items: SalesReportItem[];
  total_revenue: number;
  processed: boolean;
  verification_notes?: string;
}
