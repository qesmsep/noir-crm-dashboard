import React from 'react';
import {
  Search,
  Plus,
  ChefHat,
  CheckCircle,
  AlertCircle,
  MinusCircle,
} from 'lucide-react';
import type { Recipe, RecipeCategory, InventoryItem } from '../../types/inventory';
import styles from '../../styles/Inventory.module.css';

interface RecipeBuilderProps {
  recipes: Recipe[];
  inventory: InventoryItem[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  categoryFilter: RecipeCategory | 'all';
  onCategoryFilterChange: (cat: RecipeCategory | 'all') => void;
  onEdit: (recipe: Recipe) => void;
  onAdd: () => void;
}

function formatCurrency(val: number): string {
  return '$' + val.toFixed(2);
}

function getAvailability(
  recipe: Recipe,
  inventory: InventoryItem[]
): 'available' | 'partial' | 'unavailable' {
  if (recipe.ingredients.length === 0) return 'available';

  let available = 0;
  let total = recipe.ingredients.length;

  for (const ingredient of recipe.ingredients) {
    const item = inventory.find(
      (i) => i.id === ingredient.inventory_item_id
    );
    if (item && item.quantity > 0) {
      available++;
    }
  }

  if (available === total) return 'available';
  if (available > 0) return 'partial';
  return 'unavailable';
}

function getMarginClass(recipe: Recipe): string {
  if (recipe.menu_price <= 0 || recipe.estimated_cost <= 0) return styles.marginOk;
  const margin =
    ((recipe.menu_price - recipe.estimated_cost) / recipe.menu_price) * 100;
  if (margin >= 70) return styles.marginGood;
  if (margin >= 50) return styles.marginOk;
  return styles.marginLow;
}

function getMarginPercent(recipe: Recipe): string {
  if (recipe.menu_price <= 0 || recipe.estimated_cost <= 0) return '—';
  const margin =
    ((recipe.menu_price - recipe.estimated_cost) / recipe.menu_price) * 100;
  return margin.toFixed(0) + '%';
}

const AVAILABILITY_MAP = {
  available: {
    icon: CheckCircle,
    label: 'In Stock',
    className: styles.availabilityAvailable,
  },
  partial: {
    icon: AlertCircle,
    label: 'Partial Stock',
    className: styles.availabilityPartial,
  },
  unavailable: {
    icon: MinusCircle,
    label: 'Out of Stock',
    className: styles.availabilityUnavailable,
  },
};

export default function RecipeBuilder({
  recipes,
  inventory,
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryFilterChange,
  onEdit,
  onAdd,
}: RecipeBuilderProps) {
  const filtered = recipes.filter((recipe) => {
    const matchesSearch =
      !searchQuery ||
      recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      recipe.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      categoryFilter === 'all' || recipe.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search recipes..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <select
          className={styles.filterSelect}
          value={categoryFilter}
          onChange={(e) =>
            onCategoryFilterChange(e.target.value as RecipeCategory | 'all')
          }
        >
          <option value="all">All Types</option>
          <option value="cocktail">Cocktails</option>
          <option value="mocktail">Mocktails</option>
          <option value="shot">Shots</option>
          <option value="beer">Beer</option>
          <option value="wine">Wine</option>
          <option value="other">Other</option>
        </select>
        <button className={styles.btnPrimary} onClick={onAdd}>
          <Plus size={16} /> New Recipe
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <ChefHat size={48} className={styles.emptyIcon} />
          <h3 className={styles.emptyTitle}>No recipes yet</h3>
          <p className={styles.emptyText}>
            {recipes.length === 0
              ? 'Create your first cocktail recipe and check it against your inventory.'
              : 'Try adjusting your search or filter.'}
          </p>
          {recipes.length === 0 && (
            <button className={styles.btnPrimary} onClick={onAdd}>
              <Plus size={16} /> Create Recipe
            </button>
          )}
        </div>
      ) : (
        <div className={styles.recipeGrid}>
          {filtered.map((recipe) => {
            const availability = getAvailability(recipe, inventory);
            const AvailIcon = AVAILABILITY_MAP[availability].icon;
            return (
              <div
                key={recipe.id}
                className={styles.recipeCard}
                onClick={() => onEdit(recipe)}
              >
                <div className={styles.recipeCardHeader}>
                  <h3 className={styles.recipeName}>{recipe.name}</h3>
                  <span className={styles.recipeCategory}>
                    {recipe.category}
                  </span>
                </div>

                {recipe.ingredients.length > 0 && (
                  <ul className={styles.recipeIngredients}>
                    {recipe.ingredients.slice(0, 5).map((ing, idx) => (
                      <li key={idx} className={styles.recipeIngredient}>
                        <span>{ing.name}</span>
                        <span className={styles.recipeIngredientAmount}>
                          {ing.quantity} {ing.unit}
                        </span>
                      </li>
                    ))}
                    {recipe.ingredients.length > 5 && (
                      <li
                        className={styles.recipeIngredient}
                        style={{ color: '#868686', fontStyle: 'italic' }}
                      >
                        +{recipe.ingredients.length - 5} more
                      </li>
                    )}
                  </ul>
                )}

                <div className={styles.recipeCostRow}>
                  <span className={styles.recipeCost}>
                    Cost{' '}
                    <span className={styles.recipeCostValue}>
                      {formatCurrency(recipe.estimated_cost)}
                    </span>
                    {' / '}
                    Price{' '}
                    <span className={styles.recipeCostValue}>
                      {formatCurrency(recipe.menu_price)}
                    </span>
                  </span>
                  <span
                    className={`${styles.recipeMargin} ${getMarginClass(recipe)}`}
                  >
                    {getMarginPercent(recipe)} margin
                  </span>
                </div>

                <div
                  className={`${styles.recipeAvailability} ${AVAILABILITY_MAP[availability].className}`}
                >
                  <AvailIcon size={14} />
                  {AVAILABILITY_MAP[availability].label}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
