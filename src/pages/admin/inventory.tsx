import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../components/layouts/AdminLayout';
import InventoryList from '../../components/inventory/InventoryList';
import InventoryItemDrawer from '../../components/inventory/InventoryItemDrawer';
import InventoryPhotoScanner from '../../components/inventory/InventoryPhotoScanner';
import RecipeBuilder from '../../components/inventory/RecipeBuilder';
import RecipeDrawer from '../../components/inventory/RecipeDrawer';
import SalesUpload from '../../components/inventory/SalesUpload';
import {
  Package,
  ChefHat,
  TrendingDown,
  Plus,
  Camera,
  AlertTriangle,
  DollarSign,
  Layers,
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
} from '../../types/inventory';
import styles from '../../styles/Inventory.module.css';

export default function InventoryPage() {
  // Tab state
  const [activeTab, setActiveTab] = useState<InventoryTab>('inventory');

  // Inventory state
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryCategory, setInventoryCategory] = useState<InventoryCategory | 'all'>('all');
  const [isItemDrawerOpen, setIsItemDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [loading, setLoading] = useState(true);

  // Recipe state
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeSearch, setRecipeSearch] = useState('');
  const [recipeCategory, setRecipeCategory] = useState<RecipeCategory | 'all'>('all');
  const [isRecipeDrawerOpen, setIsRecipeDrawerOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [savingRecipe, setSavingRecipe] = useState(false);

  // Sales state
  const [salesHistory, setSalesHistory] = useState<SalesRecord[]>([]);

  // Load data
  const fetchInventory = useCallback(async () => {
    try {
      const res = await fetch('/api/inventory');
      if (res.ok) {
        const data = await res.json();
        setInventory(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch inventory:', err);
    }
  }, []);

  const fetchRecipes = useCallback(async () => {
    try {
      const res = await fetch('/api/inventory/recipes');
      if (res.ok) {
        const data = await res.json();
        setRecipes(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch recipes:', err);
    }
  }, []);

  const fetchSalesHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/inventory/sales');
      if (res.ok) {
        const data = await res.json();
        setSalesHistory(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch sales history:', err);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchInventory(), fetchRecipes(), fetchSalesHistory()]).finally(
      () => setLoading(false)
    );
  }, [fetchInventory, fetchRecipes, fetchSalesHistory]);

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
  const handleSaveItem = async (data: InventoryItemFormData) => {
    setSavingItem(true);
    try {
      const method = editingItem ? 'PUT' : 'POST';
      const body = editingItem ? { ...data, id: editingItem.id } : data;
      const res = await fetch('/api/inventory', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await fetchInventory();
        setIsItemDrawerOpen(false);
        setEditingItem(null);
      }
    } catch (err) {
      console.error('Failed to save item:', err);
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Delete this inventory item?')) return;
    try {
      await fetch('/api/inventory', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      await fetchInventory();
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  };

  const handleEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setIsItemDrawerOpen(true);
  };

  const handleAddItem = () => {
    setEditingItem(null);
    setIsItemDrawerOpen(true);
  };

  // AI Scan handler
  const handleScanConfirm = async (scannedItems: ScannedItem[]) => {
    // For each scanned item, either update existing or create new
    for (const scanned of scannedItems) {
      if (scanned.matched_inventory_id) {
        // Update existing item quantity
        const existing = inventory.find(
          (i) => i.id === scanned.matched_inventory_id
        );
        if (existing) {
          await fetch('/api/inventory', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: existing.id,
              quantity: scanned.estimated_quantity,
            }),
          });
        }
      } else {
        // Create new inventory item
        await fetch('/api/inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: scanned.name,
            brand: scanned.brand,
            category: scanned.category,
            quantity: scanned.estimated_quantity,
            unit: scanned.unit || 'bottle',
            subcategory: '',
            volume_ml: 750,
            cost_per_unit: 0,
            price_per_serving: 0,
            par_level: 0,
            notes: 'Added from AI scan',
          }),
        });
      }
    }
    await fetchInventory();
    setIsScannerOpen(false);
  };

  // Recipe CRUD
  const handleSaveRecipe = async (data: RecipeFormData) => {
    setSavingRecipe(true);
    try {
      const method = editingRecipe ? 'PUT' : 'POST';
      const body = editingRecipe ? { ...data, id: editingRecipe.id } : data;
      const res = await fetch('/api/inventory/recipes', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await fetchRecipes();
        setIsRecipeDrawerOpen(false);
        setEditingRecipe(null);
      }
    } catch (err) {
      console.error('Failed to save recipe:', err);
    } finally {
      setSavingRecipe(false);
    }
  };

  const handleDeleteRecipe = async (id: string) => {
    if (!confirm('Delete this recipe?')) return;
    try {
      await fetch('/api/inventory/recipes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      await fetchRecipes();
      setIsRecipeDrawerOpen(false);
      setEditingRecipe(null);
    } catch (err) {
      console.error('Failed to delete recipe:', err);
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
      const res = await fetch('/api/inventory/sales', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
        <div className={styles.pageActions}>
          {activeTab === 'inventory' && (
            <>
              <button className={styles.btnTertiary} onClick={() => setIsScannerOpen(true)}>
                <Camera size={16} /> Scan
              </button>
              <button className={styles.btnPrimary} onClick={handleAddItem}>
                <Plus size={16} /> Add Item
              </button>
            </>
          )}
          {activeTab === 'recipes' && (
            <button className={styles.btnPrimary} onClick={handleAddRecipe}>
              <Plus size={16} /> New Recipe
            </button>
          )}
        </div>
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
        />
      )}

      {activeTab === 'recipes' && (
        <RecipeBuilder
          recipes={recipes}
          inventory={inventory}
          searchQuery={recipeSearch}
          onSearchChange={setRecipeSearch}
          categoryFilter={recipeCategory}
          onCategoryFilterChange={setRecipeCategory}
          onEdit={handleEditRecipe}
          onAdd={handleAddRecipe}
        />
      )}

      {activeTab === 'sales' && (
        <SalesUpload
          inventory={inventory}
          recipes={recipes}
          salesHistory={salesHistory}
          onProcessSales={handleProcessSales}
        />
      )}

      {/* Drawers */}
      <InventoryItemDrawer
        isOpen={isItemDrawerOpen}
        onClose={() => {
          setIsItemDrawerOpen(false);
          setEditingItem(null);
        }}
        onSave={handleSaveItem}
        editItem={editingItem}
        saving={savingItem}
      />

      <InventoryPhotoScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onConfirm={handleScanConfirm}
        existingItems={inventory}
      />

      <RecipeDrawer
        isOpen={isRecipeDrawerOpen}
        onClose={() => {
          setIsRecipeDrawerOpen(false);
          setEditingRecipe(null);
        }}
        onSave={handleSaveRecipe}
        onDelete={handleDeleteRecipe}
        editRecipe={editingRecipe}
        inventory={inventory}
        saving={savingRecipe}
      />
    </AdminLayout>
  );
}
