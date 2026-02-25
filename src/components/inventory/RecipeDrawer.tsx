import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import type {
  Recipe,
  RecipeFormData,
  RecipeIngredient,
  InventoryItem,
} from '../../types/inventory';
import styles from '../../styles/Inventory.module.css';

interface RecipeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: RecipeFormData) => void;
  onDelete?: (id: string) => void;
  editRecipe: Recipe | null;
  inventory: InventoryItem[];
  saving: boolean;
}

const EMPTY_FORM: RecipeFormData = {
  name: '',
  category: 'cocktail',
  description: '',
  instructions: '',
  ingredients: [],
  menu_price: 0,
};

const EMPTY_INGREDIENT: RecipeIngredient = {
  inventory_item_id: '',
  name: '',
  quantity: 0,
  unit: 'oz',
};

const UNIT_OPTIONS = ['oz', 'ml', 'dash', 'splash', 'barspoon', 'each', 'slice', 'sprig', 'wheel', 'drop'];

export default function RecipeDrawer({
  isOpen,
  onClose,
  onSave,
  onDelete,
  editRecipe,
  inventory,
  saving,
}: RecipeDrawerProps) {
  const [form, setForm] = useState<RecipeFormData>(EMPTY_FORM);

  useEffect(() => {
    if (editRecipe) {
      setForm({
        name: editRecipe.name,
        category: editRecipe.category,
        description: editRecipe.description,
        instructions: editRecipe.instructions,
        ingredients: [...editRecipe.ingredients],
        menu_price: editRecipe.menu_price,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [editRecipe, isOpen]);

  const handleChange = (
    field: keyof RecipeFormData,
    value: string | number
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addIngredient = () => {
    setForm((prev) => ({
      ...prev,
      ingredients: [...prev.ingredients, { ...EMPTY_INGREDIENT }],
    }));
  };

  const updateIngredient = (
    index: number,
    field: keyof RecipeIngredient,
    value: string | number
  ) => {
    setForm((prev) => {
      const updated = [...prev.ingredients];
      updated[index] = { ...updated[index], [field]: value };

      // Auto-fill name when inventory item is selected
      if (field === 'inventory_item_id' && typeof value === 'string') {
        const item = inventory.find((i) => i.id === value);
        if (item) {
          updated[index].name = item.brand ? `${item.brand} ${item.name}` : item.name;
        }
      }

      return { ...prev, ingredients: updated };
    });
  };

  const removeIngredient = (index: number) => {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index),
    }));
  };

  const estimatedCost = form.ingredients.reduce((total, ing) => {
    const item = inventory.find((i) => i.id === ing.inventory_item_id);
    if (!item || !item.cost_per_unit || !item.volume_ml) return total;
    // Rough cost estimation: (cost / volume_ml) * ingredient_quantity_in_ml
    const mlPerUnit = ing.unit === 'oz' ? ing.quantity * 29.5735 : ing.quantity;
    const costPerMl = item.cost_per_unit / item.volume_ml;
    return total + costPerMl * mlPerUnit;
  }, 0);

  const margin =
    form.menu_price > 0 && estimatedCost > 0
      ? ((form.menu_price - estimatedCost) / form.menu_price) * 100
      : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <>
      {isOpen && (
        <div
          className={`${styles.drawerOverlay} ${styles.drawerOverlayVisible}`}
          onClick={onClose}
        />
      )}
      <div className={`${styles.drawer} ${isOpen ? styles.drawerVisible : ''}`} role="dialog" aria-modal="true" aria-label={editRecipe ? 'Edit Recipe' : 'New Recipe'}>
        <div className={styles.drawerHeader}>
          <h2 className={styles.drawerTitle}>
            {editRecipe ? 'Edit Recipe' : 'New Recipe'}
          </h2>
          <button className={styles.drawerClose} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.drawerBody}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Name</label>
            <input
              className={styles.formInput}
              type="text"
              placeholder="e.g., Old Fashioned"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              required
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Category</label>
              <select
                className={styles.formSelect}
                value={form.category}
                onChange={(e) => handleChange('category', e.target.value)}
              >
                <option value="cocktail">Cocktail</option>
                <option value="mocktail">Mocktail</option>
                <option value="shot">Shot</option>
                <option value="beer">Beer</option>
                <option value="wine">Wine</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Menu Price ($)</label>
              <input
                className={styles.formInput}
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.menu_price || ''}
                onChange={(e) =>
                  handleChange('menu_price', parseFloat(e.target.value) || 0)
                }
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Description</label>
            <input
              className={styles.formInput}
              type="text"
              placeholder="A brief description..."
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
            />
          </div>

          {/* Ingredients */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Ingredients</label>
            <ul className={styles.ingredientsList}>
              {form.ingredients.map((ing, idx) => (
                <li key={idx} className={styles.ingredientRow}>
                  <select
                    className={`${styles.formSelect} ${styles.ingredientSelect}`}
                    value={ing.inventory_item_id}
                    onChange={(e) =>
                      updateIngredient(idx, 'inventory_item_id', e.target.value)
                    }
                  >
                    <option value="">Select item...</option>
                    {inventory.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.brand ? `${item.brand} ` : ''}
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.25"
                    placeholder="Qty"
                    className={styles.ingredientQuantityInput}
                    value={ing.quantity || ''}
                    onChange={(e) =>
                      updateIngredient(
                        idx,
                        'quantity',
                        parseFloat(e.target.value) || 0
                      )
                    }
                  />
                  <select
                    className={styles.ingredientUnitSelect}
                    value={ing.unit}
                    onChange={(e) =>
                      updateIngredient(idx, 'unit', e.target.value)
                    }
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={styles.ingredientRemoveBtn}
                    onClick={() => removeIngredient(idx)}
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className={styles.addIngredientBtn}
              onClick={addIngredient}
            >
              <Plus size={14} /> Add Ingredient
            </button>
          </div>

          {/* Cost Summary */}
          {form.ingredients.length > 0 && (
            <div
              style={{
                background: '#F7F6F2',
                borderRadius: 12,
                padding: '1rem',
                marginBottom: '1.25rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '0.375rem',
                }}
              >
                <span style={{ fontSize: '0.8125rem', color: '#5A5A5A' }}>
                  Est. Cost
                </span>
                <span
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: '#1F1F1F',
                  }}
                >
                  ${estimatedCost.toFixed(2)}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '0.375rem',
                }}
              >
                <span style={{ fontSize: '0.8125rem', color: '#5A5A5A' }}>
                  Menu Price
                </span>
                <span
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: '#1F1F1F',
                  }}
                >
                  ${(form.menu_price || 0).toFixed(2)}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: '0.375rem',
                  borderTop: '1px solid #ECEAE5',
                }}
              >
                <span
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: '#5A5A5A',
                  }}
                >
                  Margin
                </span>
                <span
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    color:
                      margin >= 70
                        ? '#059669'
                        : margin >= 50
                          ? '#D97706'
                          : '#DC2626',
                  }}
                >
                  {margin > 0 ? margin.toFixed(0) + '%' : '—'}
                </span>
              </div>
            </div>
          )}

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Instructions</label>
            <textarea
              className={styles.formTextarea}
              placeholder="Step by step preparation..."
              value={form.instructions}
              onChange={(e) => handleChange('instructions', e.target.value)}
              style={{ minHeight: 100 }}
            />
          </div>
        </form>

        <div className={styles.drawerFooter}>
          {editRecipe && onDelete && (
            <button
              className={styles.btnDanger}
              onClick={() => onDelete(editRecipe.id)}
              type="button"
              style={{ marginRight: 'auto' }}
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
          <button className={styles.btnTertiary} onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className={styles.btnPrimary}
            onClick={handleSubmit}
            disabled={saving || !form.name.trim()}
          >
            {saving
              ? 'Saving...'
              : editRecipe
                ? 'Update Recipe'
                : 'Create Recipe'}
          </button>
        </div>
      </div>
    </>
  );
}
