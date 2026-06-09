import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2 } from 'lucide-react';
import InventoryItemModal from './InventoryItemModal';
import type {
  Recipe,
  RecipeFormData,
  RecipeIngredient,
  InventoryItem,
  InventoryItemFormData,
  LocationSlug,
  UILocationSlug,
} from '../../types/inventory';
import { Z_INDEX } from '../../constants/inventory';
import { convertToMilliliters } from '../../lib/inventory-utils';
import styles from '../../styles/Inventory.module.css';

interface RecipeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: RecipeFormData) => void;
  onDelete?: (id: string) => void;
  editRecipe: Recipe | null;
  inventory: InventoryItem[];
  saving: boolean;
  onSaveNewItem?: (data: InventoryItemFormData) => Promise<InventoryItem | null>;
  currentLocation?: UILocationSlug;
  locations?: Array<{ id: string; slug: LocationSlug; name: string }>;
}

const EMPTY_FORM: RecipeFormData = {
  name: '',
  category: 'cocktail',
  descriptors: ['', '', ''],
  description: '',
  instructions: '',
  ingredients: [],
  menu_price: 0,
  glass_type: '',
  garnish: '',
  location_ids: [],
  batch_ingredients: undefined,
  batch_yield: undefined,
  batch_instructions: undefined,
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
  onSaveNewItem,
  currentLocation = 'noirkc',
  locations = [],
}: RecipeDrawerProps) {
  const [form, setForm] = useState<RecipeFormData>(EMPTY_FORM);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [pendingIngredientIndex, setPendingIngredientIndex] = useState<number | null>(null);
  const [pendingBatchIngredientIndex, setPendingBatchIngredientIndex] = useState<number | null>(null);
  const [savingNewItem, setSavingNewItem] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchIngredients, setBatchIngredients] = useState<RecipeIngredient[]>([]);
  const [batchYield, setBatchYield] = useState<number>(1);
  const [batchInstructions, setBatchInstructions] = useState<string>('');

  // Ingredient search values for dropdowns
  const [searchTerms, setSearchTerms] = useState<Record<number, string>>({});
  // Per-ingredient dropdown visibility
  const [showDropdown, setShowDropdown] = useState<Record<number, boolean>>({});
  const [batchSearchTerms, setBatchSearchTerms] = useState<Record<number, string>>({});
  // Per-batch-ingredient dropdown visibility
  const [showBatchDropdown, setShowBatchDropdown] = useState<Record<number, boolean>>({});

  // Portal container for batch modal (for proper cleanup)
  const [batchPortalContainer] = useState(() => {
    if (typeof document === 'undefined') return null;
    const container = document.createElement('div');
    container.setAttribute('id', 'batch-modal-portal');
    return container;
  });

  // Locations are already real (no synthetic 'all').
  const availableLocations = locations;

  // Portal cleanup effect
  useEffect(() => {
    if (batchPortalContainer) {
      document.body.appendChild(batchPortalContainer);
      return () => {
        document.body.removeChild(batchPortalContainer);
      };
    }
  }, [batchPortalContainer]);

  // Initialize form when modal opens (FIX: removed inventory from deps to prevent reset)
  useEffect(() => {
    if (!isOpen) return;

    if (editRecipe) {
      setForm({
        name: editRecipe.name,
        category: editRecipe.category,
        descriptors: editRecipe.descriptors || ['', '', ''],
        description: editRecipe.description,
        instructions: editRecipe.instructions,
        ingredients: [...editRecipe.ingredients],
        menu_price: editRecipe.menu_price,
        glass_type: editRecipe.glass_type || '',
        garnish: editRecipe.garnish || '',
        location_ids: editRecipe.location_ids || [],
        batch_ingredients: editRecipe.batch_ingredients,
        batch_yield: editRecipe.batch_yield,
        batch_instructions: editRecipe.batch_instructions,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [editRecipe, isOpen]);

  // Separate effect for search terms that depends on inventory
  useEffect(() => {
    if (!isOpen || !editRecipe) return;

    const terms: Record<number, string> = {};
    editRecipe.ingredients.forEach((ing, idx) => {
      const item = inventory.find(i => i.id === ing.inventory_item_id);
      if (item) {
        terms[idx] = `${item.brand ? item.brand + ' ' : ''}${item.name}`;
      }
    });
    setSearchTerms(terms);
  }, [inventory, editRecipe?.ingredients, isOpen]);

  const handleChange = (
    field: keyof RecipeFormData,
    value: string | number
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleLocation = (locationId: string) => {
    setForm((prev) => {
      const currentLocations = prev.location_ids || [];
      const newLocations = currentLocations.includes(locationId)
        ? currentLocations.filter(id => id !== locationId)
        : [...currentLocations, locationId];
      return { ...prev, location_ids: newLocations };
    });
  };

  const updateDescriptor = (index: number, value: string) => {
    setForm((prev) => {
      const descriptors = [...(prev.descriptors || ['', '', ''])];
      descriptors[index] = value;
      return { ...prev, descriptors };
    });
  };

  const addIngredient = () => {
    const newIndex = form.ingredients.length;
    setForm((prev) => ({
      ...prev,
      ingredients: [...prev.ingredients, { ...EMPTY_INGREDIENT }],
    }));
    // Initialize empty search term for new ingredient
    setSearchTerms(prev => ({ ...prev, [newIndex]: '' }));
  };

  const updateIngredient = (
    index: number,
    field: keyof RecipeIngredient,
    value: string | number
  ) => {
    setForm((prev) => {
      const updated = [...prev.ingredients];
      updated[index] = { ...updated[index], [field]: value };

      return { ...prev, ingredients: updated };
    });
  };

  const removeIngredient = (index: number) => {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index),
    }));
    // Clean up search state
    setSearchTerms(prev => {
      const newTerms = { ...prev };
      delete newTerms[index];
      return newTerms;
    });
    setShowDropdown(prev => {
      const newDropdown = { ...prev };
      delete newDropdown[index];
      return newDropdown;
    });
  };

  const getFilteredInventory = (searchTerm: string) => {
    if (!searchTerm) return inventory;
    const term = searchTerm.toLowerCase();
    return inventory.filter(item => {
      const fullName = `${item.brand ? item.brand + ' ' : ''}${item.name}`.toLowerCase();
      return fullName.includes(term);
    });
  };

  const handleIngredientSearch = (index: number, value: string) => {
    setSearchTerms(prev => ({ ...prev, [index]: value }));
    setShowDropdown(prev => ({ ...prev, [index]: true }));
  };

  const handleSelectInventoryItem = (index: number, item: InventoryItem) => {
    const displayName = `${item.brand ? item.brand + ' ' : ''}${item.name}`;

    setForm((prev) => {
      const updated = [...prev.ingredients];
      updated[index] = {
        ...updated[index],
        inventory_item_id: item.id,
        name: displayName
      };
      return { ...prev, ingredients: updated };
    });

    setSearchTerms(prev => ({ ...prev, [index]: displayName }));
    setShowDropdown(prev => ({ ...prev, [index]: false }));
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

  const handleAddNewItem = (ingredientIndex: number) => {
    setPendingIngredientIndex(ingredientIndex);
    setIsAddItemModalOpen(true);
  };

  const handleAddNewItemFromBatch = (ingredientIndex: number) => {
    setPendingBatchIngredientIndex(ingredientIndex);
    setIsAddItemModalOpen(true);
  };

  const handleSaveNewItemComplete = async (data: InventoryItemFormData) => {
    if (!onSaveNewItem) return;

    setSavingNewItem(true);
    try {
      // Save the new item via parent callback
      const newItem = await onSaveNewItem(data);

      // Auto-populate the ingredient row with the new item
      if (newItem) {
        // Check if we're adding from batch mode
        if (pendingBatchIngredientIndex !== null) {
          updateBatchIngredient(pendingBatchIngredientIndex, 'inventory_item_id', newItem.id);
          setPendingBatchIngredientIndex(null);
        }
        // Check if we're adding from regular mode
        else if (pendingIngredientIndex !== null) {
          updateIngredient(pendingIngredientIndex, 'inventory_item_id', newItem.id);
          setPendingIngredientIndex(null);
        }
      }

      setIsAddItemModalOpen(false);
    } catch (err) {
      console.error('Failed to save new item:', err);
    } finally {
      setSavingNewItem(false);
    }
  };

  const handleOpenBatchEntry = () => {
    // Load saved batch data if it exists, otherwise initialize from current recipe
    if (form.batch_ingredients && form.batch_ingredients.length > 0) {
      setBatchIngredients([...form.batch_ingredients]);
      setBatchYield(form.batch_yield || 1);
      setBatchInstructions(form.batch_instructions || '');

      // Initialize batch search terms
      const terms: Record<number, string> = {};
      form.batch_ingredients.forEach((ing, idx) => {
        const item = inventory.find(i => i.id === ing.inventory_item_id);
        if (item) {
          terms[idx] = `${item.brand ? item.brand + ' ' : ''}${item.name}`;
        }
      });
      setBatchSearchTerms(terms);
    } else {
      setBatchIngredients(form.ingredients.length > 0 ? [...form.ingredients] : [{ ...EMPTY_INGREDIENT }]);
      setBatchYield(1);
      setBatchInstructions(form.instructions || '');

      // Initialize batch search terms from current ingredients
      const terms: Record<number, string> = {};
      form.ingredients.forEach((ing, idx) => {
        const item = inventory.find(i => i.id === ing.inventory_item_id);
        if (item) {
          terms[idx] = `${item.brand ? item.brand + ' ' : ''}${item.name}`;
        }
      });
      setBatchSearchTerms(terms);
    }
    setShowBatchDropdown({});
    setIsBatchModalOpen(true);
  };

  const handleSaveBatchEntry = () => {
    // Validate batch yield
    if (batchYield <= 0) {
      alert('Batch yield must be greater than 0');
      return;
    }

    // Validate all ingredients have valid selections and quantities
    const invalidIngredients = batchIngredients.filter(
      ing => !ing.inventory_item_id || ing.quantity <= 0
    );

    if (invalidIngredients.length > 0) {
      alert('All ingredients must have an item selected and quantity > 0');
      return;
    }

    // Verify all items still exist in inventory
    const allItemsExist = batchIngredients.every(ing =>
      inventory.some(item => item.id === ing.inventory_item_id)
    );

    if (!allItemsExist) {
      alert('Some selected items no longer exist. Please refresh and try again.');
      return;
    }

    // Convert batch quantities to per-cocktail quantities
    const perCocktailIngredients = batchIngredients.map(ing => ({
      ...ing,
      quantity: parseFloat((ing.quantity / batchYield).toFixed(4))
    }));

    // Update the main form with per-cocktail ingredients AND save batch data
    setForm(prev => ({
      ...prev,
      ingredients: perCocktailIngredients,
      instructions: batchInstructions,
      batch_ingredients: [...batchIngredients], // Save batch quantities
      batch_yield: batchYield, // Save batch yield
      batch_instructions: batchInstructions // Save batch instructions
    }));

    // Update search terms for the main recipe ingredients
    const terms: Record<number, string> = {};
    perCocktailIngredients.forEach((ing, idx) => {
      const item = inventory.find(i => i.id === ing.inventory_item_id);
      if (item) {
        terms[idx] = `${item.brand ? item.brand + ' ' : ''}${item.name}`;
      }
    });
    setSearchTerms(terms);

    setIsBatchModalOpen(false);
  };

  const updateBatchIngredient = (
    index: number,
    field: keyof RecipeIngredient,
    value: string | number
  ) => {
    setBatchIngredients(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      return updated;
    });
  };

  const addBatchIngredient = () => {
    const newIndex = batchIngredients.length;
    setBatchIngredients(prev => [...prev, { ...EMPTY_INGREDIENT }]);
    // Initialize empty search term for new batch ingredient
    setBatchSearchTerms(prev => ({ ...prev, [newIndex]: '' }));
  };

  const removeBatchIngredient = (index: number) => {
    setBatchIngredients(prev => prev.filter((_, i) => i !== index));
    // Clean up search state
    setBatchSearchTerms(prev => {
      const newTerms = { ...prev };
      delete newTerms[index];
      return newTerms;
    });
    setShowBatchDropdown(prev => {
      const newDropdown = { ...prev };
      delete newDropdown[index];
      return newDropdown;
    });
  };

  const handleBatchIngredientSearch = (index: number, value: string) => {
    setBatchSearchTerms(prev => ({ ...prev, [index]: value }));
    setShowBatchDropdown(prev => ({ ...prev, [index]: true }));
  };

  const handleSelectBatchInventoryItem = (index: number, item: InventoryItem) => {
    const displayName = `${item.brand ? item.brand + ' ' : ''}${item.name}`;

    setBatchIngredients(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        inventory_item_id: item.id,
        name: displayName
      };
      return updated;
    });

    setBatchSearchTerms(prev => ({ ...prev, [index]: displayName }));
    setShowBatchDropdown(prev => ({ ...prev, [index]: false }));
  };

  if (!isOpen) return null;

  return (
    <>
      <div className={styles.modalOverlay} onClick={onClose} />
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label={editRecipe ? 'Edit Recipe' : 'New Recipe'}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {editRecipe ? 'Edit Recipe' : 'New Recipe'}
          </h2>
          <button className={styles.modalClose} onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalBody}>
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

          {/* Descriptor Words */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Descriptor Words</label>
            <div className={styles.descriptorInputs}>
              <input
                className={styles.descriptorInput}
                type="text"
                placeholder="e.g., Sweet"
                maxLength={20}
                value={(form.descriptors || ['', '', ''])[0]}
                onChange={(e) => updateDescriptor(0, e.target.value)}
              />
              <input
                className={styles.descriptorInput}
                type="text"
                placeholder="e.g., Citrus"
                maxLength={20}
                value={(form.descriptors || ['', '', ''])[1]}
                onChange={(e) => updateDescriptor(1, e.target.value)}
              />
              <input
                className={styles.descriptorInput}
                type="text"
                placeholder="e.g., Refreshing"
                maxLength={20}
                value={(form.descriptors || ['', '', ''])[2]}
                onChange={(e) => updateDescriptor(2, e.target.value)}
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

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Glass Type</label>
              <input
                className={styles.formInput}
                type="text"
                placeholder="e.g., Rocks, Coupe, Highball"
                value={form.glass_type || ''}
                onChange={(e) => handleChange('glass_type', e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Garnish</label>
              <input
                className={styles.formInput}
                type="text"
                placeholder="e.g., Orange peel, Cherry"
                value={form.garnish || ''}
                onChange={(e) => handleChange('garnish', e.target.value)}
              />
            </div>
          </div>

          {/* Location Assignment */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Available At Locations</label>
            <p className={styles.formHint} style={{ marginBottom: '0.75rem' }}>
              Select which locations can serve this recipe
            </p>
            <div className={styles.recipeLocationOptions}>
              {availableLocations.map((location) => (
                <label
                  key={location.id}
                  className={styles.recipeLocationCheckbox}
                >
                  <input
                    type="checkbox"
                    checked={(form.location_ids || []).includes(location.id)}
                    onChange={() => toggleLocation(location.id)}
                  />
                  <span>{location.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Ingredients */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Ingredients</label>
            <ul className={styles.ingredientsList}>
              {form.ingredients.map((ing, idx) => (
                <li key={idx} className={styles.ingredientRow}>
                  <div className={styles.ingredientSelectWrapper} style={{ position: 'relative' }}>
                    <input
                      type="text"
                      className={`${styles.formInput} ${styles.ingredientSelect}`}
                      placeholder="Search inventory..."
                      value={searchTerms[idx] || ''}
                      onChange={(e) => handleIngredientSearch(idx, e.target.value)}
                      onFocus={() => setShowDropdown(prev => ({ ...prev, [idx]: true }))}
                      onBlur={() => setTimeout(() => setShowDropdown(prev => ({ ...prev, [idx]: false })), 200)}
                    />
                    {showDropdown[idx] && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        maxHeight: '200px',
                        overflowY: 'auto',
                        backgroundColor: 'white',
                        border: '1px solid #D1D5DB',
                        borderRadius: '0.5rem',
                        marginTop: '0.25rem',
                        zIndex: 1000,
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}>
                        {getFilteredInventory(searchTerms[idx] || '').map((item) => (
                          <div
                            key={item.id}
                            style={{
                              padding: '0.5rem 0.75rem',
                              cursor: 'pointer',
                              borderBottom: '1px solid #F3F4F6'
                            }}
                            onMouseDown={() => handleSelectInventoryItem(idx, item)}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                          >
                            {item.brand ? `${item.brand} ` : ''}{item.name}
                          </div>
                        ))}
                        {getFilteredInventory(searchTerms[idx] || '').length === 0 && (
                          <div style={{ padding: '0.5rem 0.75rem', color: '#9CA3AF' }}>
                            No items found
                          </div>
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      className={styles.addNewItemBtn}
                      onClick={() => handleAddNewItem(idx)}
                      title="Add new inventory item"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
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
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                type="button"
                className={styles.addIngredientBtn}
                onClick={addIngredient}
              >
                <Plus size={14} /> Add Ingredient
              </button>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: '#1F1F1F',
                }}
              >
                <input
                  type="checkbox"
                  checked={isBatchModalOpen}
                  onChange={(e) => {
                    if (e.target.checked) {
                      handleOpenBatchEntry();
                    } else {
                      setIsBatchModalOpen(false);
                    }
                  }}
                  style={{
                    width: '16px',
                    height: '16px',
                    cursor: 'pointer',
                  }}
                />
                <span>Batch Entry</span>
              </label>
            </div>
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
              value={form.instructions || ''}
              onChange={(e) => handleChange('instructions', e.target.value)}
              style={{ minHeight: 100 }}
            />
          </div>
        </form>

        <div className={styles.modalFooter}>
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

      {/* Batch Entry Modal - Using Portal to escape stacking context */}
      {isBatchModalOpen && batchPortalContainer && createPortal(
        <>
          <div
            className={styles.modalOverlay}
            onClick={() => setIsBatchModalOpen(false)}
            style={{ zIndex: Z_INDEX.NESTED_MODAL_OVERLAY }}
          />
          <div
            className={styles.modal}
            style={{ maxWidth: '800px', zIndex: Z_INDEX.NESTED_MODAL }}
          >
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Batch Entry</h2>
              <button className={styles.modalClose} onClick={() => setIsBatchModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '1rem' }}>
                Enter ingredients at <strong>batch quantities</strong>, then specify how many cocktails the batch makes.
                The app will automatically convert to per-cocktail amounts.
              </p>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>How many cocktails does this batch make?</label>
                <input
                  className={styles.formInput}
                  type="number"
                  min="1"
                  step="1"
                  placeholder="e.g., 15"
                  value={batchYield || ''}
                  onChange={(e) => setBatchYield(parseInt(e.target.value) || 1)}
                  required
                  style={{ maxWidth: '200px' }}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Instructions</label>
                <textarea
                  className={styles.formTextarea}
                  placeholder="Step by step preparation for the batch..."
                  value={batchInstructions}
                  onChange={(e) => setBatchInstructions(e.target.value)}
                  style={{ minHeight: 80 }}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Batch Ingredients</label>
                <ul className={styles.ingredientsList}>
                  {batchIngredients.map((ing, idx) => (
                    <li key={idx} className={styles.ingredientRow}>
                      <div className={styles.ingredientSelectWrapper} style={{ position: 'relative' }}>
                        <input
                          type="text"
                          className={`${styles.formInput} ${styles.ingredientSelect}`}
                          placeholder="Search inventory..."
                          value={batchSearchTerms[idx] || ''}
                          onChange={(e) => handleBatchIngredientSearch(idx, e.target.value)}
                          onFocus={() => setShowBatchDropdown(prev => ({ ...prev, [idx]: true }))}
                          onBlur={() => setTimeout(() => setShowBatchDropdown(prev => ({ ...prev, [idx]: false })), 200)}
                        />
                        {showBatchDropdown[idx] && (
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            maxHeight: '200px',
                            overflowY: 'auto',
                            backgroundColor: 'white',
                            border: '1px solid #D1D5DB',
                            borderRadius: '0.5rem',
                            marginTop: '0.25rem',
                            zIndex: 1000,
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                          }}>
                            {getFilteredInventory(batchSearchTerms[idx] || '').map((item) => (
                              <div
                                key={item.id}
                                style={{
                                  padding: '0.5rem 0.75rem',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid #F3F4F6'
                                }}
                                onMouseDown={() => handleSelectBatchInventoryItem(idx, item)}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                              >
                                {item.brand ? `${item.brand} ` : ''}{item.name}
                              </div>
                            ))}
                            {getFilteredInventory(batchSearchTerms[idx] || '').length === 0 && (
                              <div style={{ padding: '0.5rem 0.75rem', color: '#9CA3AF' }}>
                                No items found
                              </div>
                            )}
                          </div>
                        )}
                        <button
                          type="button"
                          className={styles.addNewItemBtn}
                          onClick={() => handleAddNewItemFromBatch(idx)}
                          title="Add new inventory item"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        placeholder="Qty"
                        className={styles.ingredientQuantityInput}
                        value={ing.quantity || ''}
                        onChange={(e) =>
                          updateBatchIngredient(
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
                          updateBatchIngredient(idx, 'unit', e.target.value)
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
                        onClick={() => removeBatchIngredient(idx)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={styles.addIngredientBtn}
                  onClick={addBatchIngredient}
                >
                  <Plus size={14} /> Add Ingredient
                </button>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                className={styles.btnTertiary}
                onClick={() => setIsBatchModalOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className={styles.btnPrimary}
                onClick={handleSaveBatchEntry}
                disabled={batchYield <= 0 || batchIngredients.length === 0}
              >
                Convert to Per-Cocktail & Save
              </button>
            </div>
          </div>
        </>,
        batchPortalContainer
      )}

      {/* Nested Add Item Modal - Rendered after Batch Modal so it appears on top */}
      <InventoryItemModal
        isOpen={isAddItemModalOpen}
        onClose={() => {
          setIsAddItemModalOpen(false);
          setPendingIngredientIndex(null);
          setPendingBatchIngredientIndex(null);
        }}
        onSave={handleSaveNewItemComplete}
        editItem={null}
        saving={savingNewItem}
        currentLocation={currentLocation}
      />
    </>
  );
}
