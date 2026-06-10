import React, { useState, useEffect, useCallback } from 'react';
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
  onSave: (data: InventoryItemFormData) => void | Promise<void>;
  onDelete?: (id: string) => void;
  editItem: InventoryItem | null;
  saving: boolean;
  currentLocation: UILocationSlug;
  locations?: Array<{ id: string; slug: string; name: string }>;
  onRefresh?: () => Promise<void>;
}

// Location data interfaces
interface LocationQuantities {
  [locationId: string]: number;
}

interface LocationParLevels {
  [locationId: string]: number;
}

interface LocationAvailability {
  [locationId: string]: boolean;
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
  onRefresh,
}: InventoryItemModalProps) {
  const [form, setForm] = useState<InventoryItemFormData>(EMPTY_FORM);
  const [locationQuantities, setLocationQuantities] = useState<LocationQuantities>({});
  const [locationParLevels, setLocationParLevels] = useState<LocationParLevels>({});
  const [locationAvailability, setLocationAvailability] = useState<LocationAvailability>({});
  const [manualAvailabilitySet, setManualAvailabilitySet] = useState<{[key: string]: boolean}>({});
  const [selectedLocationTab, setSelectedLocationTab] = useState<string>('');
  const [existingItemsByLocation, setExistingItemsByLocation] = useState<{ [locationId: string]: string }>({});
  const [categories, setCategories] = useState<string[]>(['spirits', 'wine', 'beer', 'mixers', 'garnishes', 'supplies', 'other']);
  const [subcategoryOptions, setSubcategoryOptions] = useState<Record<string, string[]>>(DEFAULTS);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [volumeOzInput, setVolumeOzInput] = useState<string>('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingLocations, setLoadingLocations] = useState(false);

  // Initialize location data
  useEffect(() => {
    if (isOpen) {
      const initialQuantities: LocationQuantities = {};
      const initialParLevels: LocationParLevels = {};
      const initialAvailability: LocationAvailability = {};
      locations.forEach(loc => {
        initialQuantities[loc.id] = 0;
        initialParLevels[loc.id] = 0;
        initialAvailability[loc.id] = false;
      });
      setLocationQuantities(initialQuantities);
      setLocationParLevels(initialParLevels);
      setLocationAvailability(initialAvailability);
      // Set All Locations as default selected tab
      setSelectedLocationTab('all');
    }
  }, [isOpen, locations]);

  const fetchAllLocationQuantities = useCallback(async () => {
    if (!editItem) return;

    setLoadingLocations(true);
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
        const parLevels: LocationParLevels = {};
        const availability: LocationAvailability = {};
        const itemsByLocation: { [locationId: string]: string } = {};

        // Initialize all locations with defaults
        locations.forEach(loc => {
          quantities[loc.id] = 0;
          parLevels[loc.id] = 0;
          availability[loc.id] = false;
        });

        // Set data for locations where this item exists
        relatedItems.forEach(item => {
          if (item.location_id) {
            quantities[item.location_id] = item.quantity;
            parLevels[item.location_id] = item.par_level || 0;
            availability[item.location_id] = true;
            itemsByLocation[item.location_id] = item.id;
          }
        });

        setLocationQuantities(quantities);
        setLocationParLevels(parLevels);
        setLocationAvailability(availability);
        setExistingItemsByLocation(itemsByLocation);
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to fetch location quantities:', err);
      }
    } finally {
      setLoadingLocations(false);
    }
  }, [editItem, locations]);

  // Fetch existing items at all locations when editing
  useEffect(() => {
    if (editItem && isOpen) {
      fetchAllLocationQuantities();
    }
  }, [editItem, isOpen, fetchAllLocationQuantities]);

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
    const newQuantity = Math.max(0, quantity);
    setLocationQuantities(prev => ({
      ...prev,
      [locationId]: newQuantity
    }));
    // Only auto-enable availability if user hasn't manually set it
    if (newQuantity > 0 && !manualAvailabilitySet[locationId]) {
      setLocationAvailability(prev => ({
        ...prev,
        [locationId]: true
      }));
    }
  };

  const handleLocationAvailabilityChange = (locationId: string, isAvailable: boolean) => {
    setLocationAvailability(prev => ({
      ...prev,
      [locationId]: isAvailable
    }));
    // Mark that user has manually set availability
    setManualAvailabilitySet(prev => ({
      ...prev,
      [locationId]: true
    }));
    // If disabling, reset qty and par to 0
    if (!isAvailable) {
      setLocationQuantities(prev => ({
        ...prev,
        [locationId]: 0
      }));
      setLocationParLevels(prev => ({
        ...prev,
        [locationId]: 0
      }));
    }
  };

  const handleLocationParLevelChange = (locationId: string, parLevel: number) => {
    const newParLevel = Math.max(0, parLevel);
    setLocationParLevels(prev => ({
      ...prev,
      [locationId]: newParLevel
    }));
    // Only auto-enable availability if user hasn't manually set it
    if (newParLevel > 0 && !manualAvailabilitySet[locationId]) {
      setLocationAvailability(prev => ({
        ...prev,
        [locationId]: true
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Save items only to locations where availability is checked
    const locationsToSave = Object.entries(locationAvailability)
      .filter(([_, isAvailable]) => isAvailable)
      .map(([locationId]) => locationId);

    if (locationsToSave.length === 0) {
      alert('Please select at least one location where this item is available');
      return;
    }

    const failures: string[] = [];
    const successes: string[] = [];

    try {
      const headers = await getAuthHeaders();

      for (const locationId of locationsToSave) {
        const locationName = locations.find(l => l.id === locationId)?.name || locationId;
        const existingItemId = existingItemsByLocation[locationId];
        const quantity = locationQuantities[locationId] || 0;
        const parLevel = locationParLevels[locationId] || 0;

        try {
          if (existingItemId) {
            // Update existing item at this location
            const response = await fetch('/api/inventory', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                ...headers,
              },
              body: JSON.stringify({
                ...form,
                id: existingItemId,
                quantity,
                par_level: parLevel,
                location_id: locationId,
              }),
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(errorText || 'Update failed');
            }
            successes.push(locationName);
          } else {
            // Create new item at this location
            const response = await fetch('/api/inventory', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...headers,
              },
              body: JSON.stringify({
                ...form,
                quantity,
                par_level: parLevel,
                location_id: locationId,
              }),
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(errorText || 'Create failed');
            }
            successes.push(locationName);
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          failures.push(`${locationName}: ${errorMsg}`);
        }
      }

      // Handle items that need to be deleted (unchecked locations)
      if (editItem) {
        const locationsToDelete = Object.entries(locationAvailability)
          .filter(([locationId, isAvailable]) => !isAvailable && existingItemsByLocation[locationId]);

        for (const [locationId, _] of locationsToDelete) {
          const locationName = locations.find(l => l.id === locationId)?.name || locationId;
          const itemId = existingItemsByLocation[locationId];
          try {
            const response = await fetch('/api/inventory', {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
                ...headers,
              },
              body: JSON.stringify({ id: itemId }),
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(errorText || 'Delete failed');
            }
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error';
            failures.push(`Failed to remove from ${locationName}: ${errorMsg}`);
          }
        }
      }

      // Refresh the inventory list
      if (onRefresh) {
        await onRefresh();
      } else {
        await onSave(form);
      }

      // Show result to user
      if (failures.length > 0 && successes.length === 0) {
        alert(`Failed to save:\n\n${failures.join('\n')}`);
        return; // Don't close modal if everything failed
      } else if (failures.length > 0) {
        alert(`Partially saved:\n\nSucceeded: ${successes.join(', ')}\n\nFailed:\n${failures.join('\n')}`);
      }

      onClose();
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
        // Refresh the inventory list
        if (onRefresh) {
          await onRefresh();
        }
        onClose();
      } catch (err) {
        console.error('Failed to delete items:', err);
        alert('Failed to delete items. Please try again.');
      }
    }
  };

  const getTotalQuantity = () => {
    return Object.entries(locationQuantities)
      .filter(([locationId]) => locationAvailability[locationId])
      .reduce((sum, [_, qty]) => sum + qty, 0);
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
            style={{ maxWidth: '550px', zIndex: Z_INDEX.NESTED_MODAL }}
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
                <div className="grid grid-cols-2 gap-4">
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

                <div className="grid grid-cols-3 gap-4">
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

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cost ($)
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
                </div>

                {/* Location Inventory - Tabbed Interface */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <MapPin size={14} className="inline mr-1" />
                    Location Inventory On-Hand
                  </label>

                  {/* Tab Headers */}
                  <div style={{
                    display: 'flex',
                    borderBottom: '1px solid #E5E7EB',
                    marginBottom: '0.75rem'
                  }}>
                    {/* All Locations Tab */}
                    <button
                      type="button"
                      onClick={() => setSelectedLocationTab('all')}
                      style={{
                        padding: '0.5rem 1rem',
                        fontSize: '0.875rem',
                        fontWeight: selectedLocationTab === 'all' ? '600' : '400',
                        color: selectedLocationTab === 'all' ? '#92400E' : '#6B7280',
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderBottom: selectedLocationTab === 'all' ? '2px solid #92400E' : '2px solid transparent',
                        cursor: 'pointer',
                        marginBottom: '-1px'
                      }}
                    >
                      All Locations
                    </button>

                    {locations.map((location) => (
                      <button
                        key={location.id}
                        type="button"
                        onClick={() => setSelectedLocationTab(location.id)}
                        style={{
                          padding: '0.5rem 1rem',
                          fontSize: '0.875rem',
                          fontWeight: selectedLocationTab === location.id ? '600' : '400',
                          color: selectedLocationTab === location.id ? '#92400E' : '#6B7280',
                          backgroundColor: 'transparent',
                          border: 'none',
                          borderBottom: selectedLocationTab === location.id ? '2px solid #92400E' : '2px solid transparent',
                          cursor: 'pointer',
                          marginBottom: '-1px'
                        }}
                      >
                        {location.name}
                      </button>
                    ))}
                  </div>

                  {/* Tab Content */}
                  {loadingLocations ? (
                    <div style={{
                      padding: '2rem',
                      backgroundColor: '#F9FAFB',
                      borderRadius: '0.375rem',
                      border: '1px solid #E5E7EB',
                      textAlign: 'center',
                      color: '#6B7280'
                    }}>
                      <div style={{ fontSize: '0.875rem' }}>Loading location data...</div>
                    </div>
                  ) : selectedLocationTab === 'all' ? (
                    /* All Locations Total Summary */
                    <div style={{
                      padding: '0.75rem',
                      backgroundColor: '#F9FAFB',
                      borderRadius: '0.375rem',
                      border: '1px solid #E5E7EB',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '0.875rem', color: '#6B7280' }}>
                        Total Quantity
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#111827', marginTop: '0.25rem' }}>
                        {getTotalQuantity()} {form.unit || 'units'}
                      </div>
                    </div>
                  ) : selectedLocationTab && (
                    <div style={{
                      padding: '0.75rem',
                      backgroundColor: '#F9FAFB',
                      borderRadius: '0.375rem',
                      border: '1px solid #E5E7EB'
                    }}>
                      <div style={{
                        display: 'flex',
                        gap: '1rem',
                        alignItems: 'flex-end'
                      }}>
                        {/* Available Toggle */}
                        <div style={{ flex: '0 0 auto' }}>
                          <label className="block text-xs text-gray-600 mb-1">
                            Available
                          </label>
                          <label style={{
                            position: 'relative',
                            display: 'inline-block',
                            width: '44px',
                            height: '24px',
                            cursor: 'pointer'
                          }}>
                            <input
                              type="checkbox"
                              checked={locationAvailability[selectedLocationTab] || false}
                              onChange={(e) => handleLocationAvailabilityChange(selectedLocationTab, e.target.checked)}
                              style={{
                                opacity: 0,
                                width: 0,
                                height: 0
                              }}
                            />
                            <span style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              backgroundColor: locationAvailability[selectedLocationTab] ? '#10B981' : '#D1D5DB',
                              borderRadius: '24px',
                              transition: 'background-color 0.2s',
                              cursor: 'pointer'
                            }}>
                              <span style={{
                                position: 'absolute',
                                content: '',
                                height: '18px',
                                width: '18px',
                                left: locationAvailability[selectedLocationTab] ? '23px' : '3px',
                                bottom: '3px',
                                backgroundColor: 'white',
                                borderRadius: '50%',
                                transition: 'left 0.2s'
                              }} />
                            </span>
                          </label>
                        </div>

                        {/* Quantity and Par Level inputs (only show if available) */}
                        {locationAvailability[selectedLocationTab] && (
                          <>
                            <div style={{ flex: 1 }}>
                              <label className="block text-xs text-gray-600 mb-1">
                                Quantity
                              </label>
                              <input
                                className="w-full px-3 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cork-500 text-sm"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0"
                                value={locationQuantities[selectedLocationTab] || 0}
                                onChange={(e) =>
                                  handleLocationQuantityChange(selectedLocationTab, parseFloat(e.target.value) || 0)
                                }
                              />
                            </div>

                            <div style={{ flex: 1 }}>
                              <label className="block text-xs text-gray-600 mb-1">
                                Minimum Stock Level
                              </label>
                              <input
                                className="w-full px-3 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cork-500 text-sm"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0"
                                value={locationParLevels[selectedLocationTab] || 0}
                                onChange={(e) =>
                                  handleLocationParLevelChange(selectedLocationTab, parseFloat(e.target.value) || 0)
                                }
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
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
                  disabled={saving || !form.name.trim() || Object.values(locationAvailability).every(v => !v)}
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