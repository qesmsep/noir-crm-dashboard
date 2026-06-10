import React, { useMemo, useState, useEffect } from 'react';
import {
  Package,
  Search,
  Edit2,
  AlertTriangle,
  MapPin,
  ChevronDown,
  ChevronRight,
  Circle,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import type { InventoryItem, InventoryCategory } from '../../types/inventory';
import styles from '../../styles/Inventory.module.css';

// Color constants
const COLORS = {
  status: {
    good: '#10B981',
    warning: '#F59E0B',
    critical: '#DC2626',
  },
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    400: '#9CA3AF',
    600: '#6B7280',
    700: '#374151',
    800: '#1F2937',
  },
} as const;

// Size constants
const ICON_SIZES = {
  small: 10,
  medium: 14,
  large: 16,
  xlarge: 20,
} as const;

const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

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

type StockFilter = 'all' | 'low-stock' | 'out-of-stock';

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
  totalParLevel: number;
  avgCostPerUnit: number;
}

type SortColumn = 'name' | 'category' | 'subcategory' | 'cost' | 'status';
type SortDirection = 'asc' | 'desc';

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
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = useState<SortColumn>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [subcategoryFilter, setSubcategoryFilter] = useState<string>('all');

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
          totalParLevel: 0,
          avgCostPerUnit: 0,
        });
      }

      const group = groups.get(key)!;
      const location = locations.find((loc) => loc.id === item.location_id);

      // Only include this location if it has quantity > 0 OR par_level > 0
      // This filters out "unavailable" items (items with 0 qty and 0 par)
      if (item.quantity > 0 || (item.par_level && item.par_level > 0)) {
        group.locations.push({
          id: item.id,
          locationId: item.location_id || '',
          locationName: location?.name || 'Unknown',
          quantity: item.quantity,
          parLevel: item.par_level || 0,
          costPerUnit: item.cost_per_unit || 0,
        });
        group.totalQuantity += item.quantity;
        group.totalParLevel += item.par_level || 0;
      }
    });

    // Calculate average cost and filter out groups with no locations
    const result: GroupedItem[] = [];
    groups.forEach((group) => {
      // Only include groups that have at least one location
      if (group.locations.length > 0) {
        const totalCost = group.locations.reduce((sum, loc) => sum + loc.costPerUnit, 0);
        group.avgCostPerUnit = totalCost / group.locations.length;
        result.push(group);
      }
    });

    return result;
  }, [items, locations]);

  // Get available subcategories for the selected category
  const availableSubcategories = useMemo(() => {
    if (categoryFilter === 'all') return [];

    const subcats = new Set<string>();
    groupedItems
      .filter(item => item.category === categoryFilter)
      .forEach(item => {
        if (item.subcategory) {
          subcats.add(item.subcategory);
        }
      });

    return Array.from(subcats).sort();
  }, [groupedItems, categoryFilter]);

  // Reset subcategory filter when category changes
  useEffect(() => {
    setSubcategoryFilter('all');
  }, [categoryFilter]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortAriaLabel = (column: SortColumn, label: string) => {
    if (sortColumn === column) {
      return `Sort by ${label} ${sortDirection === 'asc' ? 'descending' : 'ascending'}`;
    }
    return `Sort by ${label}`;
  };

  const handleSortKeyDown = (e: React.KeyboardEvent, column: SortColumn) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSort(column);
    }
  };

  const filtered = useMemo(() => {
    const items = groupedItems.filter((group) => {
      const matchesSearch =
        !searchQuery ||
        group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        group.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
        group.subcategory.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        categoryFilter === 'all' || group.category === categoryFilter;
      const matchesSubcategory =
        subcategoryFilter === 'all' || group.subcategory === subcategoryFilter;

      // Stock level filter
      let matchesStock = true;
      if (stockFilter === 'low-stock') {
        // Show items below par level (but not at 0)
        // Only consider items that have a par level set (> 0)
        // Items with no par level set (0) won't appear in low-stock filter
        matchesStock = group.totalParLevel > 0 &&
                       group.totalQuantity < group.totalParLevel &&
                       group.totalQuantity > 0;
      } else if (stockFilter === 'out-of-stock') {
        // Show items at 0 quantity (regardless of par level)
        matchesStock = group.totalQuantity === 0;
      }

      return matchesSearch && matchesCategory && matchesSubcategory && matchesStock;
    });

    // Apply sorting
    const sorted = [...items].sort((a, b) => {
      let comparison = 0;

      if (sortColumn === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortColumn === 'category') {
        comparison = a.category.localeCompare(b.category);
      } else if (sortColumn === 'subcategory') {
        comparison = (a.subcategory || '').localeCompare(b.subcategory || '');
      } else if (sortColumn === 'cost') {
        comparison = a.avgCostPerUnit - b.avgCostPerUnit;
      } else if (sortColumn === 'status') {
        // Sort by stock status (critical -> warning -> good)
        const statusA = getGroupStatus(a);
        const statusB = getGroupStatus(b);
        const statusOrder = { critical: 0, warning: 1, good: 2 };
        comparison = statusOrder[statusA] - statusOrder[statusB];
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [groupedItems, searchQuery, categoryFilter, subcategoryFilter, stockFilter, sortColumn, sortDirection]);

  // Get overall status for a group (collapsed view)
  const getGroupStatus = (group: GroupedItem): 'good' | 'warning' | 'critical' => {
    const allLocationsAtOrAbovePar = group.locations.every(loc =>
      loc.parLevel <= 0 || loc.quantity >= loc.parLevel
    );

    if (allLocationsAtOrAbovePar) {
      return 'good'; // Green - all locations at or above par
    }

    if (group.totalQuantity >= group.totalParLevel) {
      return 'warning'; // Yellow - total above par but some locations below
    }

    return 'critical'; // Red - total below par
  };

  // Get status for individual location (expanded view)
  const getLocationStatus = (quantity: number, parLevel: number): 'good' | 'critical' => {
    if (parLevel <= 0 || quantity >= parLevel) {
      return 'good'; // Green - at or above par
    }
    return 'critical'; // Red - below par
  };

  const toggleRowExpansion = (key: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedRows(newExpanded);
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
        {categoryFilter !== 'all' && availableSubcategories.length > 0 && (
          <select
            className={styles.filterSelect}
            value={subcategoryFilter}
            onChange={(e) => setSubcategoryFilter(e.target.value)}
            style={{ minWidth: '160px' }}
          >
            <option value="all">All Subcategories</option>
            {availableSubcategories.map((subcat) => (
              <option key={subcat} value={subcat}>
                {subcat.charAt(0).toUpperCase() + subcat.slice(1)}
              </option>
            ))}
          </select>
        )}
        <select
          className={styles.filterSelect}
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value as StockFilter)}
          style={{ minWidth: '140px' }}
        >
          <option value="all">All Stock Levels</option>
          <option value="low-stock">Low Stock</option>
          <option value="out-of-stock">Out of Stock</option>
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
                  <th
                    onClick={() => handleSort('name')}
                    onKeyDown={(e) => handleSortKeyDown(e, 'name')}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    role="button"
                    tabIndex={0}
                    aria-label={getSortAriaLabel('name', 'item name')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Item
                      {sortColumn === 'name' && (
                        sortDirection === 'asc' ? <ArrowUp size={14} aria-hidden="true" /> : <ArrowDown size={14} aria-hidden="true" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('category')}
                    onKeyDown={(e) => handleSortKeyDown(e, 'category')}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    role="button"
                    tabIndex={0}
                    aria-label={getSortAriaLabel('category', 'category')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Category
                      {sortColumn === 'category' && (
                        sortDirection === 'asc' ? <ArrowUp size={14} aria-hidden="true" /> : <ArrowDown size={14} aria-hidden="true" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('subcategory')}
                    onKeyDown={(e) => handleSortKeyDown(e, 'subcategory')}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    role="button"
                    tabIndex={0}
                    aria-label={getSortAriaLabel('subcategory', 'subcategory')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Subcategory
                      {sortColumn === 'subcategory' && (
                        sortDirection === 'asc' ? <ArrowUp size={14} aria-hidden="true" /> : <ArrowDown size={14} aria-hidden="true" />
                      )}
                    </div>
                  </th>
                  <th style={{ minWidth: '150px' }}>Qty</th>
                  <th style={{ minWidth: '100px' }}>Par</th>
                  <th
                    onClick={() => handleSort('status')}
                    onKeyDown={(e) => handleSortKeyDown(e, 'status')}
                    style={{ cursor: 'pointer', userSelect: 'none', minWidth: '80px' }}
                    role="button"
                    tabIndex={0}
                    aria-label={getSortAriaLabel('status', 'status')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Status
                      {sortColumn === 'status' && (
                        sortDirection === 'asc' ? <ArrowUp size={14} aria-hidden="true" /> : <ArrowDown size={14} aria-hidden="true" />
                      )}
                    </div>
                  </th>
                  <th>Unit</th>
                  <th
                    onClick={() => handleSort('cost')}
                    onKeyDown={(e) => handleSortKeyDown(e, 'cost')}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    role="button"
                    tabIndex={0}
                    aria-label={getSortAriaLabel('cost', 'cost')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Avg Cost
                      {sortColumn === 'cost' && (
                        sortDirection === 'asc' ? <ArrowUp size={14} aria-hidden="true" /> : <ArrowDown size={14} aria-hidden="true" />
                      )}
                    </div>
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((group) => {
                  const key = `${group.name}_${group.brand}`;
                  const isExpanded = expandedRows.has(key);
                  const groupStatus = getGroupStatus(group);

                  return (
                    <tr key={key}>
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
                          {group.category.charAt(0).toUpperCase() + group.category.slice(1)}
                        </span>
                      </td>
                      <td style={{ textTransform: 'capitalize' }}>
                        {group.subcategory || '-'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {/* Collapsible Header */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              cursor: 'pointer',
                              padding: '4px',
                              borderRadius: '4px',
                              transition: 'background-color 0.2s',
                            }}
                            onClick={() => toggleRowExpansion(key)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                toggleRowExpansion(key);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                            aria-expanded={isExpanded}
                            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} location details for ${group.name}`}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#F3F4F6';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            {isExpanded ? (
                              <ChevronDown size={16} style={{ color: '#6B7280' }} />
                            ) : (
                              <ChevronRight size={16} style={{ color: '#6B7280' }} />
                            )}

                            <Circle
                              size={8}
                              style={{
                                color: groupStatus === 'good' ? COLORS.status.good :
                                       groupStatus === 'warning' ? COLORS.status.warning : COLORS.status.critical,
                                fill: groupStatus === 'good' ? COLORS.status.good :
                                      groupStatus === 'warning' ? COLORS.status.warning : COLORS.status.critical,
                              }}
                            />

                            <span style={{ fontWeight: '600', fontSize: '0.875rem' }}>
                              {group.totalQuantity.toFixed(2)}
                            </span>
                          </div>

                          {/* Expandable Location Details */}
                          {isExpanded && (
                            <div style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px',
                              paddingLeft: '28px',
                              borderLeft: '2px solid #E5E7EB',
                              marginLeft: '8px',
                              animation: 'slideDown 0.2s ease-out'
                            }}>
                              {group.locations.map((loc) => {
                                const locStatus = getLocationStatus(loc.quantity, loc.parLevel);
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
                                    <span style={{ color: '#6B7280' }}>
                                      {loc.locationName}:
                                    </span>
                                    <span style={{ fontWeight: '500' }}>
                                      {loc.quantity.toFixed(2)}
                                    </span>
                                    <Circle
                                      size={6}
                                      style={{
                                        color: locStatus === 'good' ? '#10B981' : '#DC2626',
                                        fill: locStatus === 'good' ? '#10B981' : '#DC2626',
                                      }}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {/* Total Par Level */}
                          <div style={{ padding: '4px', fontSize: '0.875rem', fontWeight: '500' }}>
                            {group.totalParLevel.toFixed(2)}
                          </div>

                          {/* Expandable Location Par Details */}
                          {isExpanded && (
                            <div style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px',
                              paddingLeft: '4px',
                              animation: 'slideDown 0.2s ease-out'
                            }}>
                              {group.locations.map((loc) => (
                                <div
                                  key={loc.id}
                                  style={{
                                    fontSize: '0.813rem',
                                    padding: '2px 0',
                                    color: '#6B7280'
                                  }}
                                >
                                  {loc.parLevel.toFixed(2)}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <Circle
                          size={12}
                          style={{
                            color: groupStatus === 'good' ? COLORS.status.good :
                                   groupStatus === 'warning' ? COLORS.status.warning : COLORS.status.critical,
                            fill: groupStatus === 'good' ? COLORS.status.good :
                                  groupStatus === 'warning' ? COLORS.status.warning : COLORS.status.critical,
                          }}
                        />
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
                          onClick={() => {
                            const item = items.find(i => i.name === group.name && i.brand === group.brand);
                            if (item) {
                              onEdit(item);
                            } else if (process.env.NODE_ENV !== 'production') {
                              console.error('Item not found for editing:', group.name, group.brand);
                            }
                          }}
                        >
                          <Edit2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className={styles.cardList}>
            {filtered.map((group) => {
              const key = `${group.name}_${group.brand}`;
              const isExpanded = expandedRows.has(key);
              const groupStatus = getGroupStatus(group);

              return (
                <div key={key} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <div>
                      <h4 className={styles.cardTitle}>{group.name}</h4>
                      {group.brand && (
                        <p className={styles.cardBrand}>{group.brand}</p>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                      <span
                        className={`${styles.categoryBadge} ${CATEGORY_STYLE_MAP[group.category] || ''}`}
                      >
                        {group.category.charAt(0).toUpperCase() + group.category.slice(1)}
                      </span>
                      {group.subcategory && (
                        <span style={{ fontSize: '0.75rem', color: '#6B7280', textTransform: 'capitalize' }}>
                          {group.subcategory}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={styles.cardBody}>
                    {/* Expandable Quantity Section */}
                    <div
                      onClick={() => toggleRowExpansion(key)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleRowExpansion(key);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      aria-label={`${isExpanded ? 'Collapse' : 'Expand'} quantity details for ${group.name}`}
                      style={{
                        cursor: 'pointer',
                        padding: '8px',
                        margin: '-8px',
                        borderRadius: '4px',
                        transition: 'background-color 0.2s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        {isExpanded ? (
                          <ChevronDown size={16} style={{ color: '#6B7280' }} />
                        ) : (
                          <ChevronRight size={16} style={{ color: '#6B7280' }} />
                        )}
                        <Circle
                          size={8}
                          style={{
                            color: groupStatus === 'good' ? '#10B981' :
                                   groupStatus === 'warning' ? '#F59E0B' : '#DC2626',
                            fill: groupStatus === 'good' ? '#10B981' :
                                  groupStatus === 'warning' ? '#F59E0B' : '#DC2626',
                          }}
                        />
                        <span className={styles.cardFieldLabel}>Qty / Par</span>
                      </div>
                      <div style={{ display: 'flex', gap: '16px', paddingLeft: '32px' }}>
                        <div>
                          <span className={styles.cardFieldValue}>
                            {group.totalQuantity.toFixed(2)} {group.unit}
                          </span>
                        </div>
                        <div>
                          <span className={styles.cardFieldValue} style={{ color: '#6B7280' }}>
                            {group.totalParLevel.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Location Breakdown */}
                    {isExpanded && (
                      <div style={{
                        marginTop: '8px',
                        paddingTop: '8px',
                        borderTop: '1px solid #E5E7EB',
                        paddingLeft: '24px'
                      }}>
                        {group.locations.map((loc) => {
                          const locStatus = getLocationStatus(loc.quantity, loc.parLevel);
                          return (
                            <div key={loc.id} style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '4px',
                              fontSize: '0.875rem'
                            }}>
                              <span style={{ color: '#6B7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <MapPin size={10} />
                                {loc.locationName}
                              </span>
                              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <span style={{ fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Circle
                                    size={6}
                                    style={{
                                      color: locStatus === 'good' ? '#10B981' : '#DC2626',
                                      fill: locStatus === 'good' ? '#10B981' : '#DC2626',
                                    }}
                                  />
                                  {loc.quantity.toFixed(2)}
                                </span>
                                <span style={{ color: '#9CA3AF', fontSize: '0.813rem' }}>
                                  {loc.parLevel.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className={styles.cardField}>
                      <span className={styles.cardFieldLabel}>Avg Cost</span>
                      <span className={styles.cardFieldValue}>
                        {formatCurrency(group.avgCostPerUnit)}
                      </span>
                    </div>

                    <div style={{ marginTop: '8px' }}>
                      <button
                        className={styles.editBtnCard}
                        onClick={() => {
                          const item = items.find(i => i.name === group.name && i.brand === group.brand);
                          if (item) {
                            onEdit(item);
                          } else if (process.env.NODE_ENV !== 'production') {
                            console.error('Item not found for editing:', group.name, group.brand);
                          }
                        }}
                        title="Edit"
                      >
                        <Edit2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}