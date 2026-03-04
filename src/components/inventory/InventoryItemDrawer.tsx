import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type {
  InventoryItem,
  InventoryItemFormData,
  InventoryCategory,
  InventoryUnit,
} from '../../types/inventory';
import styles from '../../styles/Inventory.module.css';

interface InventoryItemDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: InventoryItemFormData) => void;
  onDelete?: (id: string) => void;
  editItem: InventoryItem | null;
  saving: boolean;
}

const EMPTY_FORM: InventoryItemFormData = {
  name: '',
  category: 'spirits',
  subcategory: '',
  brand: '',
  quantity: 0,
  unit: 'bottle',
  volume_ml: 750,
  cost_per_unit: 0,
  price_per_serving: 0,
  par_level: 0,
  notes: '',
};

// Default subcategory options (will be overridden by settings)
const DEFAULT_SUBCATEGORY_OPTIONS: Record<string, string[]> = {
  spirits: ['Vodka', 'Gin', 'Rum', 'Tequila', 'Whiskey', 'Bourbon', 'Scotch', 'Brandy', 'Cognac', 'Mezcal', 'Liqueur', 'Other'],
  wine: ['Red', 'White', 'Rosé', 'Sparkling', 'Champagne', 'Other'],
  beer: ['Lager', 'IPA', 'Stout', 'Pilsner', 'Wheat', 'Sour', 'Craft', 'Import', 'Other'],
  mixers: ['Juice', 'Soda', 'Tonic', 'Syrup', 'Bitters', 'Cream', 'Other'],
  garnishes: ['Citrus', 'Olives', 'Cherries', 'Herbs', 'Other'],
  supplies: ['Glassware', 'Ice', 'Straws', 'Napkins', 'Other'],
  other: ['Other'],
};

export default function InventoryItemDrawer({
  isOpen,
  onClose,
  onSave,
  onDelete,
  editItem,
  saving,
}: InventoryItemDrawerProps) {
  const [form, setForm] = useState<InventoryItemFormData>(EMPTY_FORM);
  const [categories, setCategories] = useState<string[]>(['spirits', 'wine', 'beer', 'mixers', 'garnishes', 'supplies', 'other']);
  const [subcategoryOptions, setSubcategoryOptions] = useState<Record<string, string[]>>(DEFAULT_SUBCATEGORY_OPTIONS);

  useEffect(() => {
    if (editItem) {
      setForm({
        name: editItem.name,
        category: editItem.category,
        subcategory: editItem.subcategory,
        brand: editItem.brand,
        quantity: editItem.quantity,
        unit: editItem.unit,
        volume_ml: editItem.volume_ml,
        cost_per_unit: editItem.cost_per_unit,
        price_per_serving: editItem.price_per_serving,
        par_level: editItem.par_level,
        notes: editItem.notes,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [editItem, isOpen]);

  useEffect(() => {
    // Load categories from localStorage or settings
    const loadSettings = () => {
      const stored = localStorage.getItem('inventory_settings');
      if (stored) {
        try {
          const settings = JSON.parse(stored);
          if (settings.inventoryCategories) {
            setCategories(settings.inventoryCategories);
          }
          if (settings.inventorySubcategories) {
            setSubcategoryOptions(settings.inventorySubcategories);
          }
        } catch (err) {
          console.error('Failed to load settings from localStorage:', err);
        }
      }
    };

    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const handleChange = (
    field: keyof InventoryItemFormData,
    value: string | number
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  const handleDelete = () => {
    if (editItem && onDelete) {
      if (confirm(`Are you sure you want to delete "${editItem.name}"? This action cannot be undone.`)) {
        onDelete(editItem.id);
        onClose();
      }
    }
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className={`${styles.drawerOverlay} ${isOpen ? styles.drawerOverlayVisible : ''}`}
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`${styles.drawer} ${isOpen ? styles.drawerVisible : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={editItem ? 'Edit Inventory Item' : 'Add Inventory Item'}
      >
        <div className={styles.drawerHeader}>
          <h2 className={styles.drawerTitle}>
            {editItem ? 'Edit Item' : 'Add Item'}
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
              placeholder="e.g., Grey Goose Vodka"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Brand</label>
            <input
              className={styles.formInput}
              type="text"
              placeholder="e.g., Grey Goose"
              value={form.brand}
              onChange={(e) => handleChange('brand', e.target.value)}
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Category</label>
              <select
                className={styles.formSelect}
                value={form.category}
                onChange={(e) => {
                  handleChange('category', e.target.value);
                  handleChange('subcategory', '');
                }}
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Subcategory</label>
              <select
                className={styles.formSelect}
                value={form.subcategory}
                onChange={(e) => handleChange('subcategory', e.target.value)}
              >
                <option value="">Select...</option>
                {subcategoryOptions[form.category]?.map((sub) => (
                  <option key={sub} value={sub.toLowerCase()}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Quantity</label>
              <input
                className={styles.formInput}
                type="number"
                min="0"
                step="1"
                value={form.quantity}
                onChange={(e) =>
                  handleChange('quantity', parseFloat(e.target.value) || 0)
                }
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Unit</label>
              <select
                className={styles.formSelect}
                value={form.unit}
                onChange={(e) =>
                  handleChange('unit', e.target.value as InventoryUnit)
                }
              >
                <option value="bottle">Bottle</option>
                <option value="can">Can</option>
                <option value="keg">Keg</option>
                <option value="case">Case</option>
                <option value="each">Each</option>
                <option value="liter">Liter</option>
                <option value="oz">Oz</option>
              </select>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Volume per Unit (ml)</label>
            <input
              className={styles.formInput}
              type="number"
              min="0"
              step="1"
              placeholder="e.g., 750"
              value={form.volume_ml}
              onChange={(e) =>
                handleChange('volume_ml', parseFloat(e.target.value) || 0)
              }
            />
            <p className={styles.formHint}>
              Standard bottle = 750ml, Liter = 1000ml
            </p>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Cost per Unit ($)</label>
              <input
                className={styles.formInput}
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.cost_per_unit || ''}
                onChange={(e) =>
                  handleChange(
                    'cost_per_unit',
                    parseFloat(e.target.value) || 0
                  )
                }
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Price per Serving ($)</label>
              <input
                className={styles.formInput}
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.price_per_serving || ''}
                onChange={(e) =>
                  handleChange(
                    'price_per_serving',
                    parseFloat(e.target.value) || 0
                  )
                }
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Par Level</label>
            <input
              className={styles.formInput}
              type="number"
              min="0"
              step="1"
              placeholder="Minimum stock level"
              value={form.par_level || ''}
              onChange={(e) =>
                handleChange('par_level', parseFloat(e.target.value) || 0)
              }
            />
            <p className={styles.formHint}>
              You'll be alerted when stock drops below this level.
            </p>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Notes</label>
            <textarea
              className={styles.formTextarea}
              placeholder="Any additional notes..."
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
            />
          </div>
        </form>

        <div className={styles.drawerFooter}>
          <div>
            {editItem && onDelete && (
              <button
                className={styles.btnDanger}
                onClick={handleDelete}
                type="button"
              >
                Delete Item
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
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
                : editItem
                  ? 'Update Item'
                  : 'Add Item'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
