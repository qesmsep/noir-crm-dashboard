import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, X, MapPin } from 'lucide-react';
import type {
  InventoryItem,
  InventoryItemFormData,
  InventoryCategory,
  InventoryUnit,
  UILocationSlug,
} from '../../types/inventory';
import { Z_INDEX, OZ_TO_ML, DEFAULT_SUBCATEGORY_OPTIONS as DEFAULTS } from '../../constants/inventory';
import styles from '../../styles/Inventory.module.css';
import { getAuthHeaders } from '../../lib/client-auth';

interface InventoryItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: InventoryItemFormData) => void;
  onDelete?: (id: string) => void;
  editItem: InventoryItem | null;
  saving: boolean;
  currentLocation: UILocationSlug;
  locations?: Array<{ id: string; slug: string; name: string }>;
}

// Location quantities interface
interface LocationQuantities {
  [locationId: string]: number;
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
  location_id: '',
};

export default function InventoryItemModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  editItem,
  saving,
  currentLocation,
  locations = [],
}: InventoryItemModalProps) {
  const [form, setForm] = useState<InventoryItemFormData>(EMPTY_FORM);
  const [locationQuantities, setLocationQuantities] = useState<LocationQuantities>({});
  const [existingItemsByLocation, setExistingItemsByLocation] = useState<{ [locationId: string]: string }>({});
  const [categories, setCategories] = useState<string[]>(['spirits', 'wine', 'beer', 'mixers', 'garnishes', 'supplies', 'other']);
  const [subcategoryOptions, setSubcategoryOptions] = useState<Record<string, string[]>>(DEFAULTS);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [volumeOzInput, setVolumeOzInput] = useState<string>('');
  const [loadError, setLoadError] = useState<string | null>(null);

  // Initialize location quantities
  useEffect(() => {
    if (isOpen) {
      const initialQuantities: LocationQuantities = {};
      locations.forEach(loc => {
        initialQuantities[loc.id] = 0;
      });
      setLocationQuantities(initialQuantities);
    }
  }, [isOpen, locations]);

  // Fetch existing items at all locations when editing
  useEffect(() => {
    if (editItem && isOpen) {
      fetchAllLocationQuantities();
    }
  }, [editItem, isOpen]);

  const fetchAllLocationQuantities = async () => {
    if (!editItem) return;

    try {
      const headers = await getAuthHeaders();

      // Fetch all items with the same name and brand
      const res = await fetch('/api/inventory', { headers });
      if (res.ok) {
        const data = await res.json();
        const allItems: InventoryItem[] = data.data || [];

        // Find items with same name and brand
        const relatedItems = allItems.filter(
          item => item.name === editItem.name && item.brand === editItem.brand
        );

        const quantities: LocationQuantities = {};
        const itemsByLocation: { [locationId: string]: string } = {};

        // Initialize all locations with 0
        locations.forEach(loc => {
          quantities[loc.id] = 0;
        });

        // Set quantities for locations where this item exists
        relatedItems.forEach(item => {
          if (item.location_id) {
            quantities[item.location_id] = item.quantity;
            itemsByLocation[item.location_id] = item.id;
          }
        });

        setLocationQuantities(quantities);
        setExistingItemsByLocation(itemsByLocation);
      }
    } catch (err) {
      console.error('Failed to fetch location quantities:', err);
    }
  };

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
        location_id: editItem.location_id,
      });
      setVolumeOzInput(editItem.volume_ml ? (editItem.volume_ml / OZ_TO_ML).toFixed(1) : '');
    } else {
      setForm({ ...EMPTY_FORM });
      setVolumeOzInput('');
      setExistingItemsByLocation({});
    }
  }, [editItem, isOpen]);

  // Load settings with error handling
  useEffect(() => {
    const loadSettings = () => {
      const stored = localStorage.getItem(`inventory_settings_${currentLocation}`);
      if (stored) {
        try {
          const settings = JSON.parse(stored);
          if (settings.inventoryCategories) {
            setCategories(settings.inventoryCategories);
          }
          if (settings.inventorySubcategories) {
            setSubcategoryOptions(settings.inventorySubcategories);
          }
          setLoadError(null);
        } catch (err) {
          console.error('Failed to load settings from localStorage:', err);
          setLoadError('Failed to load custom categories. Using defaults.');
          setCategories(['spirits', 'wine', 'beer', 'mixers', 'garnishes', 'supplies', 'other']);
          setSubcategoryOptions(DEFAULTS);
        }
      }
    };

    if (isOpen) {
      loadSettings();
    }
  }, [isOpen, currentLocation]);

  const handleChange = (
    field: keyof InventoryItemFormData,
    value: string | number
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleLocationQuantityChange = (locationId: string, quantity: number) => {
    setLocationQuantities(prev => ({
      ...prev,
      [locationId]: Math.max(0, quantity)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Save items to each location with quantity > 0
    const locationsToSave = Object.entries(locationQuantities)
      .filter(([_, quantity]) => quantity > 0);

    if (locationsToSave.length === 0) {
      alert('Please enter a quantity for at least one location');
      return;
    }

    try {
      const headers = await getAuthHeaders();

      for (const [locationId, quantity] of locationsToSave) {
        const existingItemId = existingItemsByLocation[locationId];

        if (existingItemId) {
          // Update existing item at this location
          await fetch('/api/inventory', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              ...headers,
            },
            body: JSON.stringify({
              ...form,
              id: existingItemId,
              quantity,
              location_id: locationId,
            }),
          });
        } else {
          // Create new item at this location
          await fetch('/api/inventory', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...headers,
            },
            body: JSON.stringify({
              ...form,
              quantity,
              location_id: locationId,
            }),
          });
        }
      }

      // Handle items that need to be deleted (quantity set to 0)
      if (editItem) {
        const locationsToDelete = Object.entries(locationQuantities)
          .filter(([locationId, quantity]) => quantity === 0 && existingItemsByLocation[locationId]);

        for (const [locationId, _] of locationsToDelete) {
          const itemId = existingItemsByLocation[locationId];
          await fetch('/api/inventory', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              ...headers,
            },
            body: JSON.stringify({ id: itemId }),
          });
        }
      }

      // Call the original onSave to refresh the inventory list
      onSave(form);
    } catch (err) {
      console.error('Failed to save inventory items:', err);
      alert('Failed to save inventory items. Please try again.');
    }
  };

  const handleDelete = async () => {
    if (editItem && onDelete) {
      // Delete all instances of this item across all locations
      try {
        const headers = await getAuthHeaders();

        for (const itemId of Object.values(existingItemsByLocation)) {
          await fetch('/api/inventory', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              ...headers,
            },
            body: JSON.stringify({ id: itemId }),
          });
        }

        setShowDeleteConfirm(false);
        onClose();
        // Refresh the inventory list
        window.location.reload();
      } catch (err) {
        console.error('Failed to delete items:', err);
        alert('Failed to delete items. Please try again.');
      }
    }
  };

  const getTotalQuantity = () => {
    return Object.values(locationQuantities).reduce((sum, qty) => sum + qty, 0);
  };

  if (!isOpen) return null;

  return (
    <>
      {typeof document !== 'undefined' && createPortal(
        <>
          <div
            className={styles.modalOverlay}
            onClick={onClose}
            style={{ zIndex: Z_INDEX.NESTED_MODAL_OVERLAY }}
          />
          <div
            className={styles.modal}
            style={{ maxWidth: '800px', zIndex: Z_INDEX.NESTED_MODAL }}
          >
            {/* Loading Overlay */}
            {saving && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1,
                  borderRadius: '1rem',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.125rem', fontWeight: 600, color: '#374151' }}>
                    Saving...
                  </div>
                </div>
              </div>
            )}

            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {editItem ? 'Edit Inventory Item' : 'Add Inventory Item'}
              </h2>
              <button className={styles.modalClose} onClick={onClose}>
                <X size={20} />
              </button>
            </div>

            {/* Error Message */}
            {loadError && (
              <div
                style={{
                  margin: '1rem 1.5rem 0',
                  padding: '0.75rem',
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  borderRadius: '0.5rem',
                  color: '#991B1B',
                  fontSize: '0.875rem',
                }}
              >
                {loadError}
              </div>
            )}

            <form onSubmit={handleSubmit} className={styles.modalBody}>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cork-500"
                    type="text"
                    placeholder="e.g., Grey Goose Vodka"
                    value={form.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Brand
                  </label>
                  <input
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cork-500"
                    type="text"
                    placeholder="e.g., Grey Goose"
                    value={form.brand}
                    onChange={(e) => handleChange('brand', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cork-500"
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

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Subcategory
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cork-500"
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cork-500"
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

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Volume (oz)
                    </label>
                    <input
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cork-500"
                      type="number"
                      min="0"
                      step="any"
                      placeholder="25.4"
                      value={volumeOzInput}
                      onChange={(e) => setVolumeOzInput(e.target.value)}
                      onBlur={() => {
                        const oz = parseFloat(volumeOzInput) || 0;
                        const ml = oz * OZ_TO_ML;
                        handleChange('volume_ml', Math.round(ml));
                      }}
                    />
                  </div>
                </div>

                {/* Location Quantities Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <MapPin size={16} className="inline mr-1" />
                    Quantities by Location *
                  </label>
                  <div style={{
                    backgroundColor: '#F9FAFB',
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    border: '1px solid #E5E7EB'
                  }}>
                    <div className="grid grid-cols-1 gap-3">
                      {locations.map((location) => (
                        <div key={location.id} className="flex items-center justify-between">
                          <label className="text-sm font-medium text-gray-700" style={{ minWidth: '120px' }}>
                            {location.name}
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cork-500 text-center"
                              type="number"
                              min="0"
                              step="1"
                              value={locationQuantities[location.id] || 0}
                              onChange={(e) =>
                                handleLocationQuantityChange(location.id, parseInt(e.target.value) || 0)
                              }
                            />
                            <span className="text-sm text-gray-500">
                              {form.unit || 'units'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{
                      marginTop: '0.75rem',
                      paddingTop: '0.75rem',
                      borderTop: '1px solid #E5E7EB',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span className="text-sm font-semibold text-gray-700">Total</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {getTotalQuantity()} {form.unit || 'units'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cost per Unit ($)
                    </label>
                    <input
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cork-500"
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

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Price per Serving ($)
                    </label>
                    <input
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cork-500"
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Par Level
                  </label>
                  <input
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cork-500"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Minimum stock level"
                    value={form.par_level || ''}
                    onChange={(e) =>
                      handleChange('par_level', parseFloat(e.target.value) || 0)
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cork-500"
                    rows={3}
                    placeholder="Any additional notes..."
                    value={form.notes}
                    onChange={(e) => handleChange('notes', e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                {editItem && onDelete && (
                  <div style={{ marginRight: 'auto' }}>
                    {!showDeleteConfirm ? (
                      <button
                        className={styles.btnDanger}
                        onClick={() => setShowDeleteConfirm(true)}
                        type="button"
                      >
                        <Trash2 size={14} /> Delete Item
                      </button>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.875rem', color: '#DC2626' }}>
                          Delete from all locations?
                        </span>
                        <button
                          className={styles.btnDanger}
                          onClick={handleDelete}
                          type="button"
                        >
                          Yes, Delete
                        </button>
                        <button
                          className={styles.btnTertiary}
                          onClick={() => setShowDeleteConfirm(false)}
                          type="button"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <button
                  className={styles.btnTertiary}
                  onClick={onClose}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className={styles.btnPrimary}
                  disabled={saving || !form.name.trim() || getTotalQuantity() === 0}
                  type="submit"
                >
                  {saving
                    ? 'Saving...'
                    : editItem
                      ? 'Update Item'
                      : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </>,
        document.body
      )}
    </>
  );
}