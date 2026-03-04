import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save } from 'lucide-react';
import styles from '../../styles/Inventory.module.css';

interface InventorySettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CategorySettings {
  inventoryCategories: string[];
  inventorySubcategories: Record<string, string[]>;
  recipeCategories: string[];
}

const DEFAULT_SETTINGS: CategorySettings = {
  inventoryCategories: ['spirits', 'wine', 'beer', 'mixers', 'garnishes', 'supplies', 'other'],
  inventorySubcategories: {
    spirits: ['Vodka', 'Gin', 'Rum', 'Tequila', 'Whiskey', 'Bourbon', 'Scotch', 'Brandy', 'Cognac', 'Mezcal', 'Liqueur', 'Other'],
    wine: ['Red', 'White', 'Rosé', 'Sparkling', 'Champagne', 'Other'],
    beer: ['Lager', 'IPA', 'Stout', 'Pilsner', 'Wheat', 'Sour', 'Craft', 'Import', 'Other'],
    mixers: ['Juice', 'Soda', 'Tonic', 'Syrup', 'Bitters', 'Cream', 'Other'],
    garnishes: ['Citrus', 'Olives', 'Cherries', 'Herbs', 'Other'],
    supplies: ['Glassware', 'Ice', 'Straws', 'Napkins', 'Other'],
    other: ['Other'],
  },
  recipeCategories: ['Classic Cocktails', 'Signature Cocktails', 'Mocktails', 'Shots', 'Wine', 'Beer', 'Other'],
};

export default function InventorySettings({ isOpen, onClose }: InventorySettingsProps) {
  const [settings, setSettings] = useState<CategorySettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<'inventory' | 'recipes'>('inventory');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [newCategory, setNewCategory] = useState('');
  const [newSubcategory, setNewSubcategory] = useState('');
  const [newRecipeCategory, setNewRecipeCategory] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/inventory/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setSettings(data.settings);
        }
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/inventory/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });

      if (res.ok) {
        // Store in localStorage as well for quick access
        localStorage.setItem('inventory_settings', JSON.stringify(settings));
        onClose();
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const addInventoryCategory = () => {
    if (newCategory && !settings.inventoryCategories.includes(newCategory.toLowerCase())) {
      setSettings({
        ...settings,
        inventoryCategories: [...settings.inventoryCategories, newCategory.toLowerCase()],
        inventorySubcategories: {
          ...settings.inventorySubcategories,
          [newCategory.toLowerCase()]: ['Other'],
        },
      });
      setNewCategory('');
    }
  };

  const removeInventoryCategory = (category: string) => {
    if (['spirits', 'wine', 'beer', 'mixers', 'garnishes', 'supplies', 'other'].includes(category)) {
      alert('Cannot remove default categories');
      return;
    }

    const { [category]: _, ...rest } = settings.inventorySubcategories;
    setSettings({
      ...settings,
      inventoryCategories: settings.inventoryCategories.filter(c => c !== category),
      inventorySubcategories: rest,
    });

    if (selectedCategory === category) {
      setSelectedCategory('');
    }
  };

  const addSubcategory = () => {
    if (selectedCategory && newSubcategory) {
      const current = settings.inventorySubcategories[selectedCategory] || [];
      if (!current.includes(newSubcategory)) {
        setSettings({
          ...settings,
          inventorySubcategories: {
            ...settings.inventorySubcategories,
            [selectedCategory]: [...current, newSubcategory],
          },
        });
        setNewSubcategory('');
      }
    }
  };

  const removeSubcategory = (category: string, subcategory: string) => {
    setSettings({
      ...settings,
      inventorySubcategories: {
        ...settings.inventorySubcategories,
        [category]: settings.inventorySubcategories[category].filter(s => s !== subcategory),
      },
    });
  };

  const addRecipeCategory = () => {
    if (newRecipeCategory && !settings.recipeCategories.includes(newRecipeCategory)) {
      setSettings({
        ...settings,
        recipeCategories: [...settings.recipeCategories, newRecipeCategory],
      });
      setNewRecipeCategory('');
    }
  };

  const removeRecipeCategory = (category: string) => {
    setSettings({
      ...settings,
      recipeCategories: settings.recipeCategories.filter(c => c !== category),
    });
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

      {/* Settings Drawer */}
      <div
        className={`${styles.drawer} ${styles.settingsDrawer} ${isOpen ? styles.drawerVisible : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Inventory Settings"
      >
        <div className={styles.drawerHeader}>
          <h2 className={styles.drawerTitle}>Inventory Settings</h2>
          <button className={styles.drawerClose} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.settingsTabs}>
          <button
            className={`${styles.settingsTab} ${activeTab === 'inventory' ? styles.settingsTabActive : ''}`}
            onClick={() => setActiveTab('inventory')}
          >
            Inventory Categories
          </button>
          <button
            className={`${styles.settingsTab} ${activeTab === 'recipes' ? styles.settingsTabActive : ''}`}
            onClick={() => setActiveTab('recipes')}
          >
            Recipe Categories
          </button>
        </div>

        <div className={styles.drawerBody}>
          {activeTab === 'inventory' && (
            <div className={styles.settingsSection}>
              <h3 className={styles.settingsSectionTitle}>Inventory Categories</h3>

              <div className={styles.categoryList}>
                {settings.inventoryCategories.map(category => (
                  <div key={category} className={styles.categoryItem}>
                    <button
                      className={`${styles.categoryButton} ${selectedCategory === category ? styles.categoryButtonActive : ''}`}
                      onClick={() => setSelectedCategory(category)}
                    >
                      {category}
                    </button>
                    {!['spirits', 'wine', 'beer', 'mixers', 'garnishes', 'supplies', 'other'].includes(category) && (
                      <button
                        className={styles.removeBtn}
                        onClick={() => removeInventoryCategory(category)}
                        title="Remove category"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className={styles.addCategoryRow}>
                <input
                  className={styles.formInput}
                  type="text"
                  placeholder="New category name"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addInventoryCategory()}
                />
                <button
                  className={styles.btnSecondary}
                  onClick={addInventoryCategory}
                  disabled={!newCategory}
                >
                  <Plus size={16} /> Add Category
                </button>
              </div>

              {selectedCategory && (
                <>
                  <h3 className={styles.settingsSectionTitle}>
                    Subcategories for "{selectedCategory}"
                  </h3>

                  <div className={styles.subcategoryList}>
                    {(settings.inventorySubcategories[selectedCategory] || []).map(subcategory => (
                      <div key={subcategory} className={styles.subcategoryItem}>
                        <span>{subcategory}</span>
                        {subcategory !== 'Other' && (
                          <button
                            className={styles.removeBtn}
                            onClick={() => removeSubcategory(selectedCategory, subcategory)}
                            title="Remove subcategory"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className={styles.addCategoryRow}>
                    <input
                      className={styles.formInput}
                      type="text"
                      placeholder="New subcategory name"
                      value={newSubcategory}
                      onChange={(e) => setNewSubcategory(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addSubcategory()}
                    />
                    <button
                      className={styles.btnSecondary}
                      onClick={addSubcategory}
                      disabled={!newSubcategory}
                    >
                      <Plus size={16} /> Add Subcategory
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'recipes' && (
            <div className={styles.settingsSection}>
              <h3 className={styles.settingsSectionTitle}>Recipe Categories</h3>

              <div className={styles.categoryList}>
                {settings.recipeCategories.map(category => (
                  <div key={category} className={styles.categoryItem}>
                    <span className={styles.categoryName}>{category}</span>
                    <button
                      className={styles.removeBtn}
                      onClick={() => removeRecipeCategory(category)}
                      title="Remove category"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <div className={styles.addCategoryRow}>
                <input
                  className={styles.formInput}
                  type="text"
                  placeholder="New recipe category"
                  value={newRecipeCategory}
                  onChange={(e) => setNewRecipeCategory(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addRecipeCategory()}
                />
                <button
                  className={styles.btnSecondary}
                  onClick={addRecipeCategory}
                  disabled={!newRecipeCategory}
                >
                  <Plus size={16} /> Add Category
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={styles.drawerFooter}>
          <button className={styles.btnTertiary} onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className={styles.btnPrimary}
            onClick={saveSettings}
            disabled={saving}
          >
            {saving ? 'Saving...' : (
              <>
                <Save size={16} /> Save Settings
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}