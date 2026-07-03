import React, { useState, useEffect, useCallback, useMemo } from 'react';
import AdminLayout from '../../components/layouts/AdminLayout';
import InventoryList from '../../components/inventory/InventoryList';
import InventoryItemModal from '../../components/inventory/InventoryItemModal';
import InventoryPhotoScanner from '../../components/inventory/InventoryPhotoScanner';
import InventoryTransferModal from '../../components/inventory/InventoryTransferModal';
import RecipeBuilder from '../../components/inventory/RecipeBuilder';
import RecipeDrawer from '../../components/inventory/RecipeDrawer';
import EnhancedSalesUpload from '../../components/inventory/EnhancedSalesUpload';
import InventorySettings from '../../components/inventory/InventorySettings';
import { supabase } from '../../lib/supabase';
import {
  Package,
  ChefHat,
  TrendingDown,
  Plus,
  Camera,
  AlertTriangle,
  DollarSign,
  Layers,
  Download,
  History,
  Settings,
  MapPin,
  ArrowRightLeft,
} from 'lucide-react';
import type {
  InventoryItem,
  InventoryItemFormData,
  InventoryCategory,
  InventoryTab,
  Recipe,
  RecipeFormData,
  RecipeCategory,
  SalesRecord,
  ScannedItem,
  LocationSlug,
  UILocationSlug,
} from '../../types/inventory';
import styles from '../../styles/Inventory.module.css';
import { getAuthHeaders as getBaseAuthHeaders } from '../../lib/client-auth';

// Helper to get auth headers with Content-Type for API requests
async function getAuthHeaders(): Promise<HeadersInit> {
  const baseHeaders = await getBaseAuthHeaders();
  return {
    'Content-Type': 'application/json',
    ...baseHeaders,
  };
}

export default function InventoryPage() {
  // Location state (UILocationSlug includes 'all' for filtering)
  const [currentLocation, setCurrentLocation] = useState<UILocationSlug>('all');

  // Tab state
  const [activeTab, setActiveTab] = useState<InventoryTab>('inventory');

  // Inventory state
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [allInventory, setAllInventory] = useState<InventoryItem[]>([]); // All items for recipe creation
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryCategory, setInventoryCategory] = useState<InventoryCategory | 'all'>('all');
  const [isItemDrawerOpen, setIsItemDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [loading, setLoading] = useState(true);

  // Recipe state
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeSearch, setRecipeSearch] = useState('');
  const [recipeCategory, setRecipeCategory] = useState<RecipeCategory | 'all'>('all');
  const [isRecipeDrawerOpen, setIsRecipeDrawerOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [savingRecipe, setSavingRecipe] = useState(false);

  // Settings state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Sales state
  const [salesHistory, setSalesHistory] = useState<SalesRecord[]>([]);

  // Locations data for badges
  const [locationsData, setLocationsData] = useState<Array<{ id: string; slug: string; name: string }>>([]);

  // Build location tabs: "All Locations" synthetic tab + real locations from API
  const locationTabs = useMemo<{ slug: UILocationSlug; name: string }[]>(() => {
    const realLocations = locationsData.map(loc => ({
      slug: loc.slug as LocationSlug,
      name: loc.name
    }));
    return [
      { slug: 'all' as UILocationSlug, name: 'All Locations' },
      ...realLocations
    ];
  }, [locationsData]);

  // Fetch locations for badges
  useEffect(() => {
    async function fetchLocations() {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/locations', { headers });
        if (res.ok) {
          const data = await res.json();
          setLocationsData(data || []);
        }
      } catch (err) {
        console.error('Failed to fetch locations:', err);
      }
    }
    fetchLocations();
  }, []);

  // Load data
  const fetchInventory = useCallback(async () => {
    try {
      const url = currentLocation === 'all'
        ? '/api/inventory' // Fetch all locations
        : `/api/inventory?location_slug=${currentLocation}`;
      const headers = await getAuthHeaders();
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        setInventory(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch inventory:', err);
    }
  }, [currentLocation]);

  // Fetch all inventory items for recipe creation (location agnostic)
  const fetchAllInventory = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/inventory', { headers }); // Always fetch all
      if (res.ok) {
        const data = await res.json();
        setAllInventory(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch all inventory:', err);
    }
  }, []);

  const fetchRecipes = useCallback(async () => {
    try {
      const url = currentLocation === 'all'
        ? '/api/inventory/recipes' // Fetch all locations
        : `/api/inventory/recipes?location_slug=${currentLocation}`;
      const headers = await getAuthHeaders();
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        setRecipes(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch recipes:', err);
    }
  }, [currentLocation]);

  const fetchSalesHistory = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/inventory/sales', { headers });
      if (res.ok) {
        const data = await res.json();
        setSalesHistory(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch sales history:', err);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchInventory(), fetchAllInventory(), fetchRecipes(), fetchSalesHistory()]).finally(
      () => setLoading(false)
    );
  }, [fetchInventory, fetchAllInventory, fetchRecipes, fetchSalesHistory]);

  // Computed stats
  const totalItems = inventory.length;
  const totalValue = inventory.reduce(
    (sum, item) => sum + item.cost_per_unit * item.quantity,
    0
  );
  const lowStockCount = inventory.filter(
    (item) => item.par_level > 0 && item.quantity <= item.par_level
  ).length;
  const recipeCount = recipes.length;

  // Inventory CRUD
  const handleSaveItem = async (data: InventoryItemFormData): Promise<InventoryItem | null> => {
    setSavingItem(true);
    try {
      const method = editingItem ? 'PUT' : 'POST';
      const { location_id, ...dataWithoutLocationId } = data;
      const body = editingItem
        ? { ...data, id: editingItem.id }
        : { ...dataWithoutLocationId, location_slug: currentLocation === 'all' ? 'noirkc' : currentLocation };
      const headers = await getAuthHeaders();
      const res = await fetch('/api/inventory', {
        method,
        headers,
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const result = await res.json();
        await fetchInventory();
        await fetchAllInventory();
        setIsItemDrawerOpen(false);
        setEditingItem(null);
        return result.data; // Return the newly created/updated item
      }
      return null;
    } catch (err) {
      console.error('Failed to save item:', err);
      return null;
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Delete this inventory item?')) return;
    try {
      const headers = await getAuthHeaders();
      await fetch('/api/inventory', {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ id }),
      });
      await fetchInventory();
      await fetchAllInventory();
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  };

  const handleAdjustStock = async (id: string, newQuantity: number) => {
    if (newQuantity < 0) return;

    // Find the current item to calculate the change
    const currentItem = inventory.find(item => item.id === id);
    if (!currentItem) return;

    const quantityChange = newQuantity - currentItem.quantity;
    const transactionType = quantityChange > 0 ? 'add' : 'remove';

    try {
      // Log the transaction and update quantity
      const headers = await getAuthHeaders();
      const res = await fetch('/api/inventory/transactions', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          item_id: id,
          transaction_type: transactionType,
          quantity_change: Math.abs(quantityChange),
          notes: 'Quick adjustment from inventory list'
        }),
      });

      if (res.ok) {
        await fetchInventory();
        await fetchAllInventory();
      }
    } catch (err) {
      console.error('Failed to adjust stock:', err);
    }
  };

  const handleExportCSV = () => {
    // Generate CSV content
    const headers = ['Name', 'Brand', 'Category', 'Subcategory', 'Quantity', 'Unit', 'Volume (ml)', 'Cost per Unit', 'Price per Serving', 'Par Level', 'Status', 'Notes'];

    const rows = inventory.map(item => [
      item.name,
      item.brand || '',
      item.category,
      item.subcategory || '',
      item.quantity.toString(),
      item.unit,
      item.volume_ml?.toString() || '',
      item.cost_per_unit?.toString() || '',
      item.price_per_serving?.toString() || '',
      item.par_level?.toString() || '',
      item.quantity < item.par_level ? 'LOW STOCK' : 'OK',
      item.notes || ''
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `inventory_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setIsItemDrawerOpen(true);
  };

  const handleAddItem = () => {
    setEditingItem(null);
    setIsItemDrawerOpen(true);
  };

  // AI Scan handler - supports multi-location assignment with per-location quantities
  const handleScanConfirm = async (scannedItems: ScannedItem[]) => {
    const failures: string[] = [];

    for (const scanned of scannedItems) {
      const locationQuantities = scanned.location_quantities || {};
      const allocatedLocations = Object.entries(locationQuantities).filter(([_, qty]) => qty > 0);

      // Skip items with no locations allocated
      if (allocatedLocations.length === 0) {
        continue;
      }

      // Calculate cost per unit from receipt data
      let costPerUnit = 0;
      if (scanned.unit_price) {
        costPerUnit = scanned.unit_price;
      } else if (scanned.total_price && scanned.estimated_quantity > 0) {
        costPerUnit = scanned.total_price / scanned.estimated_quantity;
      }

      if (!scanned.create_new && scanned.matched_inventory_id) {
        // Match to existing: add quantity and update price to the existing item
        const totalQuantity = allocatedLocations.reduce((sum, [_, qty]) => sum + qty, 0);

        try {
          const headers = await getAuthHeaders();
          const res = await fetch('/api/inventory/transactions', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              item_id: scanned.matched_inventory_id,
              transaction_type: 'add',
              quantity_change: totalQuantity,
              cost_per_unit: costPerUnit > 0 ? costPerUnit : undefined, // Track price in transaction history
              notes: costPerUnit > 0
                ? `Added from receipt scan ($${costPerUnit.toFixed(2)}/unit)`
                : 'Added from receipt scan'
            }),
          });

          if (!res.ok) {
            const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
            failures.push(`Failed to update ${scanned.name}: ${errorData.error || res.statusText}`);
          }
        } catch (err) {
          failures.push(`Failed to update ${scanned.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      } else {
        // Create new: create inventory item at each allocated location with specific quantity
        const headers = await getAuthHeaders();
        for (const [locationSlug, quantity] of allocatedLocations) {
          try {
            const res = await fetch('/api/inventory', {
              method: 'POST',
              headers,
              body: JSON.stringify({
                name: scanned.name,
                brand: scanned.brand,
                category: scanned.category,
                quantity: quantity,
                unit: scanned.unit || 'bottle',
                subcategory: '',
                volume_ml: 750,
                cost_per_unit: costPerUnit,
                price_per_serving: 0,
                par_level: 0,
                notes: 'Added from receipt scan',
                location_slug: locationSlug,
              }),
            });

            if (!res.ok) {
              const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
              const errorMsg = errorData.details
                ? `${errorData.error} - ${JSON.stringify(errorData.details)}`
                : (errorData.error || res.statusText);
              failures.push(`Failed to create ${scanned.name} (${quantity} units) at ${locationSlug}: ${errorMsg}`);
              console.error('Inventory creation error:', errorData);
            }
          } catch (err) {
            failures.push(`Failed to create ${scanned.name} at ${locationSlug}: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        }
      }
    }

    await fetchInventory();
    await fetchAllInventory();
    setIsScannerOpen(false);

    // Show failures to user if any occurred
    if (failures.length > 0) {
      alert(`Scan completed with errors:\n\n${failures.join('\n')}`);
    }
  };

  // Recipe CRUD
  const handleSaveRecipe = async (data: RecipeFormData) => {
    setSavingRecipe(true);
    try {
      const method = editingRecipe ? 'PUT' : 'POST';
      const body = editingRecipe ? { ...data, id: editingRecipe.id } : data;
      const headers = await getAuthHeaders();
      const res = await fetch('/api/inventory/recipes', {
        method,
        headers,
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await fetchRecipes();
        setIsRecipeDrawerOpen(false);
        setEditingRecipe(null);
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Recipe save failed:', errorData);
        alert(`Failed to save recipe: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Failed to save recipe:', err);
    } finally {
      setSavingRecipe(false);
    }
  };

  const handleDeleteRecipe = async (id: string) => {
    // No confirm needed - double confirmation is in the drawer
    try {
      const headers = await getAuthHeaders();
      await fetch('/api/inventory/recipes', {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ id }),
      });
      await fetchRecipes();
      setIsRecipeDrawerOpen(false);
      setEditingRecipe(null);
    } catch (err) {
      console.error('Failed to delete recipe:', err);
      alert('Failed to delete recipe. Please try again.');
    }
  };

  const handleArchiveRecipe = async (id: string) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/inventory/recipes', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ id, is_active: false }),
      });
      if (res.ok) {
        await fetchRecipes();
        setIsRecipeDrawerOpen(false);
        setEditingRecipe(null);
        alert('Recipe has been archived successfully.');
      }
    } catch (err) {
      console.error('Failed to archive recipe:', err);
      alert('Failed to archive recipe. Please try again.');
    }
  };

  const handleEditRecipe = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setIsRecipeDrawerOpen(true);
  };

  const handleAddRecipe = () => {
    setEditingRecipe(null);
    setIsRecipeDrawerOpen(true);
  };

  // Sales processing
  const handleProcessSales = async (record: SalesRecord) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/inventory/sales', {
        method: 'PUT',
        headers,
        body: JSON.stringify(record),
      });
      if (res.ok) {
        await Promise.all([fetchInventory(), fetchSalesHistory()]);
      }
    } catch (err) {
      console.error('Failed to process sales:', err);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className={styles.processingOverlay}>
          <div className={styles.spinner} />
          <p className={styles.processingText}>Loading inventory...</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Inventory</h1>
        {activeTab === 'inventory' && (
          <div className={styles.pageActions}>
            <button
              className={styles.btnIcon}
              onClick={() => setIsSettingsOpen(true)}
              title="Settings"
            >
              <Settings size={20} />
            </button>
            <button className={styles.btnTertiary} onClick={handleExportCSV}>
              <Download size={16} /> Export
            </button>
            <button className={styles.btnTertiary} onClick={() => setIsTransferModalOpen(true)}>
              <ArrowRightLeft size={16} /> Transfer
            </button>
            <button className={styles.btnTertiary} onClick={() => setIsScannerOpen(true)}>
              <Camera size={16} /> Scan
            </button>
            <button className={styles.btnPrimary} onClick={handleAddItem}>
              <Plus size={16} /> Add Item
            </button>
          </div>
        )}
        {activeTab === 'recipes' && (
          <div className={styles.pageActions}>
            <button className={styles.btnPrimary} onClick={handleAddRecipe}>
              <Plus size={16} /> New Recipe
            </button>
          </div>
        )}
      </div>

      {/* Location Tabs */}
      <div className={styles.locationTabs}>
        {locationTabs.map((location) => (
          <button
            key={location.slug}
            className={`${styles.locationTab} ${currentLocation === location.slug ? styles.locationTabActive : ''}`}
            onClick={() => setCurrentLocation(location.slug)}
          >
            {location.name}
          </button>
        ))}
      </div>

      {/* Stats Bar */}
      <div className={styles.statsBar}>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Total Items</p>
          <p className={styles.statValue}>{totalItems}</p>
          <p className={styles.statSubtext}>
            <Layers size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />
            In inventory
          </p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Inventory Value</p>
          <p className={styles.statValue}>
            ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
          <p className={styles.statSubtext}>
            <DollarSign size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />
            Total cost
          </p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Low Stock</p>
          <p className={`${styles.statValue} ${lowStockCount > 0 ? styles.statWarning : ''}`}>
            {lowStockCount}
          </p>
          <p className={styles.statSubtext}>
            <AlertTriangle size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />
            Below par level
          </p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Recipes</p>
          <p className={styles.statValue}>{recipeCount}</p>
          <p className={styles.statSubtext}>
            <ChefHat size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />
            Cocktails & drinks
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tab} ${activeTab === 'inventory' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          <Package size={16} />
          Inventory
          <span className={styles.tabBadge}>{totalItems}</span>
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'recipes' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('recipes')}
        >
          <ChefHat size={16} />
          Recipes
          <span className={styles.tabBadge}>{recipeCount}</span>
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'sales' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('sales')}
        >
          <TrendingDown size={16} />
          Sales
          <span className={styles.tabBadge}>{salesHistory.length}</span>
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'history' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <History size={16} />
          History
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'inventory' && (
        <InventoryList
          items={inventory}
          searchQuery={inventorySearch}
          onSearchChange={setInventorySearch}
          categoryFilter={inventoryCategory}
          onCategoryFilterChange={setInventoryCategory}
          onEdit={handleEditItem}
          onDelete={handleDeleteItem}
          onAdjustStock={handleAdjustStock}
          showLocationBadges={currentLocation === 'all'}
          locations={locationsData}
        />
      )}

      {activeTab === 'recipes' && (
        <RecipeBuilder
          recipes={recipes}
          inventory={allInventory}  // Use all inventory for recipe creation
          searchQuery={recipeSearch}
          onSearchChange={setRecipeSearch}
          categoryFilter={recipeCategory}
          onCategoryFilterChange={setRecipeCategory}
          onEdit={handleEditRecipe}
          onAdd={handleAddRecipe}
        />
      )}

      {activeTab === 'sales' && (
        <EnhancedSalesUpload
          currentLocation={currentLocation}
          onUploadComplete={() => {
            fetchInventory();
            fetchAllInventory();
            fetchRecipes();
          }}
        />
      )}

      {/* Modals */}
      <InventoryItemModal
        isOpen={isItemDrawerOpen}
        onClose={() => {
          setIsItemDrawerOpen(false);
          setEditingItem(null);
        }}
        onSave={handleSaveItem}
        onDelete={handleDeleteItem}
        editItem={editingItem}
        saving={savingItem}
        currentLocation={currentLocation}
        onRefresh={async () => {
          await fetchInventory();
          await fetchAllInventory();
        }}
        locations={locationsData}
      />

      <InventoryPhotoScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onConfirm={handleScanConfirm}
        existingItems={inventory}
        locations={locationsData.map(loc => ({ slug: loc.slug as LocationSlug, name: loc.name }))}
      />

      <InventoryTransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        onTransferComplete={() => {
          fetchInventory();
          fetchAllInventory();
          setIsTransferModalOpen(false);
        }}
        items={inventory}
        locations={locationsData.map(loc => ({
          id: loc.id,
          slug: loc.slug as LocationSlug,
          name: loc.name
        }))}
        currentLocation={currentLocation}
      />

      <RecipeDrawer
        isOpen={isRecipeDrawerOpen}
        onClose={() => {
          setIsRecipeDrawerOpen(false);
          setEditingRecipe(null);
        }}
        onSave={handleSaveRecipe}
        onDelete={handleDeleteRecipe}
        onArchive={handleArchiveRecipe}
        editRecipe={editingRecipe}
        inventory={allInventory}  // Use all inventory for recipe creation
        saving={savingRecipe}
        onSaveNewItem={handleSaveItem}
        currentLocation={currentLocation}
        locations={locationsData.map(loc => ({
          id: loc.id,
          slug: loc.slug as LocationSlug,
          name: loc.name
        }))}
      />

      {/* Settings Drawer */}
      <InventorySettings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </AdminLayout>
  );
}
