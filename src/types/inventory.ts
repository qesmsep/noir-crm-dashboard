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
  unit: string;
}

export interface Recipe {
  id: string;
  name: string;
  category: RecipeCategory;
  description: string;
  instructions: string;
  ingredients: RecipeIngredient[];
  estimated_cost: number;
  menu_price: number;
  margin: number;
  image_url: string;
  created_at: string;
  updated_at: string;
}

export interface RecipeFormData {
  name: string;
  category: RecipeCategory;
  description: string;
  instructions: string;
  ingredients: RecipeIngredient[];
  menu_price: number;
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
}

// ========================================
// Tab & UI Types
// ========================================

export type InventoryTab = 'inventory' | 'recipes' | 'sales';

export interface InventoryStats {
  total_items: number;
  total_value: number;
  low_stock_count: number;
  categories: { category: InventoryCategory; count: number }[];
}
