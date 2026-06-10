import React, { useMemo } from 'react';
import {
  Package,
  Search,
  Edit2,
  AlertTriangle,
  MapPin,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import type { InventoryItem, InventoryCategory } from '../../types/inventory';
import styles from '../../styles/Inventory.module.css';

interface InventoryListProps {
  items: InventoryItem[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  categoryFilter: InventoryCategory | 'all';
  onCategoryFilterChange: (cat: InventoryCategory | 'all') => void;
  onEdit: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
  onAdjustStock?: (id: string, newQuantity: number) => void;
  showLocationBadges?: boolean;
  locations?: Array<{ id: string; slug: string; name: string }>;
}

const CATEGORY_STYLE_MAP: Record<string, string> = {
  spirits: styles.categorySpirits,
  wine: styles.categoryWine,
  beer: styles.categoryBeer,
  mixers: styles.categoryMixers,
  garnishes: styles.categoryGarnishes,
  supplies: styles.categorySupplies,
  other: styles.categoryOther,
};

function formatCurrency(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) {
    return '$0.00';
  }
  return '$' + val.toFixed(2);
}

// Group items by name and brand
interface GroupedItem {
  name: string;
  brand: string;
  category: InventoryCategory;
  subcategory: string;
  unit: string;
  locations: Array<{
    id: string;
    locationId: string;
    locationName: string;
    quantity: number;
    parLevel: number;
    costPerUnit: number;
  }>;
  totalQuantity: number;
  avgCostPerUnit: number;
}

export default function InventoryList({
  items,
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryFilterChange,
  onEdit,
  onDelete,
  onAdjustStock,
  showLocationBadges = false,
  locations = [],
}: InventoryListProps) {
  const getLocationName = (locationId: string): string => {
    const location = locations.find((loc) => loc.id === locationId);
    return location?.name || 'Unknown';
  };

  // Group items by name and brand
  const groupedItems = useMemo(() => {
    const groups = new Map<string, GroupedItem>();

    items.forEach((item) => {
      const key = `${item.name}_${item.brand}`;

      if (!groups.has(key)) {
        groups.set(key, {
          name: item.name,
          brand: item.brand,
          category: item.category,
          subcategory: item.subcategory,
          unit: item.unit,
          locations: [],
          totalQuantity: 0,
          avgCostPerUnit: 0,
        });
      }

      const group = groups.get(key)!;
      const location = locations.find((loc) => loc.id === item.location_id);
      group.locations.push({
        id: item.id,
        locationId: item.location_id || '',
        locationName: location?.name || 'Unknown',
        quantity: item.quantity,
        parLevel: item.par_level || 0,
        costPerUnit: item.cost_per_unit || 0,
      });
      group.totalQuantity += item.quantity;
    });

    // Calculate average cost
    groups.forEach((group) => {
      const totalCost = group.locations.reduce((sum, loc) => sum + loc.costPerUnit, 0);
      group.avgCostPerUnit = totalCost / group.locations.length;
    });

    return Array.from(groups.values());
  }, [items, locations]);

  const filtered = groupedItems.filter((group) => {
    const matchesSearch =
      !searchQuery ||
      group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.subcategory.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      categoryFilter === 'all' || group.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Get par status for a location
  const getParStatus = (quantity: number, parLevel: number): 'good' | 'warning' | 'critical' => {
    if (parLevel <= 0) return 'good';
    const ratio = quantity / parLevel;
    if (ratio <= 0.5) return 'critical';
    if (ratio <= 1) return 'warning';
    return 'good';
  };

  const PAR_STYLE_MAP = {
    good: styles.parGood,
    warning: styles.parWarning,
    critical: styles.parCritical,
  };

  return (
    <>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search inventory..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <select
          className={styles.filterSelect}
          value={categoryFilter}
          onChange={(e) =>
            onCategoryFilterChange(e.target.value as InventoryCategory | 'all')
          }
        >
          <option value="all">All Categories</option>
          <option value="spirits">Spirits</option>
          <option value="wine">Wine</option>
          <option value="beer">Beer</option>
          <option value="mixers">Mixers</option>
          <option value="garnishes">Garnishes</option>
          <option value="supplies">Supplies</option>
          <option value="other">Other</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <Package size={48} className={styles.emptyIcon} />
          <h3 className={styles.emptyTitle}>No items found</h3>
          <p className={styles.emptyText}>
            {items.length === 0
              ? 'Start by adding items to your inventory or scanning a photo of your bar.'
              : 'Try adjusting your search or filter.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th style={{ minWidth: '200px' }}>Quantity & Par Levels</th>
                  <th>Unit</th>
                  <th>Avg Cost</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((group) => (
                  <tr key={`${group.name}_${group.brand}`}>
                    <td>
                      <div className={styles.itemName}>{group.name}</div>
                      {group.brand && (
                        <div className={styles.itemBrand}>{group.brand}</div>
                      )}
                    </td>
                    <td>
                      <span
                        className={`${styles.categoryBadge} ${CATEGORY_STYLE_MAP[group.category] || ''}`}
                      >
                        {group.subcategory || group.category}
                      </span>
                    </td>
                    <td>
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        fontSize: '0.875rem'
                      }}>
                        {/* Total Quantity */}
                        <div style={{
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '4px'
                        }}>
                          <span>Total: {group.totalQuantity.toFixed(2)}</span>
                        </div>

                        {/* Location Breakdowns */}
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          paddingLeft: '12px',
                          borderLeft: '2px solid #E5E7EB'
                        }}>
                          {group.locations.map((loc) => {
                            const parStatus = getParStatus(loc.quantity, loc.parLevel);
                            return (
                              <div
                                key={loc.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  fontSize: '0.813rem'
                                }}
                              >
                                <MapPin size={12} style={{ color: '#9CA3AF', flexShrink: 0 }} />
                                <span style={{ minWidth: '70px', color: '#6B7280' }}>
                                  {loc.locationName}:
                                </span>
                                <span style={{ fontWeight: '500', minWidth: '40px' }}>
                                  {loc.quantity.toFixed(2)}
                                </span>

                                {/* Par Level Indicator */}
                                {loc.parLevel > 0 && (
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}>
                                    <span style={{ color: '#9CA3AF', fontSize: '0.75rem' }}>
                                      (Par: {loc.parLevel})
                                    </span>
                                    {parStatus === 'critical' && (
                                      <AlertTriangle size={12} style={{ color: '#DC2626' }} />
                                    )}
                                    {parStatus === 'warning' && (
                                      <TrendingDown size={12} style={{ color: '#F59E0B' }} />
                                    )}
                                    {parStatus === 'good' && loc.quantity > loc.parLevel && (
                                      <TrendingUp size={12} style={{ color: '#10B981' }} />
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>
                      {group.unit}
                    </td>
                    <td className={styles.costCell}>
                      {formatCurrency(group.avgCostPerUnit)}
                    </td>
                    <td>
                      <button
                        className={styles.editBtn}
                        title="Edit"
                        onClick={() => onEdit(items.find(i => i.name === group.name && i.brand === group.brand)!)}
                      >
                        <Edit2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className={styles.cardList}>
            {filtered.map((group) => (
              <div key={`${group.name}_${group.brand}`} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h4 className={styles.cardTitle}>{group.name}</h4>
                    {group.brand && (
                      <p className={styles.cardBrand}>{group.brand}</p>
                    )}
                  </div>
                  <span
                    className={`${styles.categoryBadge} ${CATEGORY_STYLE_MAP[group.category] || ''}`}
                  >
                    {group.subcategory || group.category}
                  </span>
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.cardField}>
                    <span className={styles.cardFieldLabel}>Total Quantity</span>
                    <span className={styles.cardFieldValue}>
                      {group.totalQuantity.toFixed(2)} {group.unit}
                      {group.totalQuantity !== 1 && group.unit !== 'oz' ? 's' : ''}
                    </span>
                  </div>

                  {/* Location Breakdown */}
                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #E5E7EB' }}>
                    {group.locations.map((loc) => {
                      const parStatus = getParStatus(loc.quantity, loc.parLevel);
                      return (
                        <div key={loc.id} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '4px',
                          fontSize: '0.875rem'
                        }}>
                          <span style={{ color: '#6B7280' }}>
                            <MapPin size={10} style={{ display: 'inline', marginRight: '4px' }} />
                            {loc.locationName}
                          </span>
                          <span style={{ fontWeight: '500' }}>
                            {loc.quantity.toFixed(2)}
                            {parStatus === 'critical' && (
                              <AlertTriangle size={10} style={{
                                color: '#DC2626',
                                marginLeft: '4px',
                                display: 'inline'
                              }} />
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className={styles.cardField}>
                    <span className={styles.cardFieldLabel}>Avg Cost</span>
                    <span className={styles.cardFieldValue}>
                      {formatCurrency(group.avgCostPerUnit)}
                    </span>
                  </div>

                  <div style={{ marginTop: '8px' }}>
                    <button
                      className={styles.editBtnCard}
                      onClick={() => onEdit(items.find(i => i.name === group.name && i.brand === group.brand)!)}
                      title="Edit"
                    >
                      <Edit2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}