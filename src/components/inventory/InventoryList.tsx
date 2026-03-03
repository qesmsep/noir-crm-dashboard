import React from 'react';
import {
  Package,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
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

function formatCurrency(val: number): string {
  return '$' + val.toFixed(2);
}

function getParStatus(item: InventoryItem): 'good' | 'warning' | 'critical' {
  if (item.par_level <= 0) return 'good';
  const ratio = item.quantity / item.par_level;
  if (ratio <= 0.5) return 'critical';
  if (ratio <= 1) return 'warning';
  return 'good';
}

const PAR_STYLE_MAP = {
  good: styles.parGood,
  warning: styles.parWarning,
  critical: styles.parCritical,
};

export default function InventoryList({
  items,
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryFilterChange,
  onEdit,
  onDelete,
}: InventoryListProps) {
  const filtered = items.filter((item) => {
    const matchesSearch =
      !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.subcategory.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

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
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Cost</th>
                  <th>Price/Serving</th>
                  <th>Par Level</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const par = getParStatus(item);
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className={styles.itemName}>{item.name}</div>
                        {item.brand && (
                          <div className={styles.itemBrand}>{item.brand}</div>
                        )}
                      </td>
                      <td>
                        <span
                          className={`${styles.categoryBadge} ${CATEGORY_STYLE_MAP[item.category] || ''}`}
                        >
                          {item.subcategory || item.category}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`${styles.quantityCell} ${par === 'critical' ? styles.quantityLow : styles.quantityOk}`}
                        >
                          {item.quantity}
                        </span>
                      </td>
                      <td style={{ textTransform: 'capitalize' }}>
                        {item.unit}
                      </td>
                      <td className={styles.costCell}>
                        {formatCurrency(item.cost_per_unit)}
                      </td>
                      <td className={styles.costCell}>
                        {formatCurrency(item.price_per_serving)}
                      </td>
                      <td>
                        <div className={styles.parIndicator}>
                          <span
                            className={`${styles.parDot} ${PAR_STYLE_MAP[par]}`}
                          />
                          {item.par_level}
                        </div>
                      </td>
                      <td>
                        <div className={styles.rowActions}>
                          <button
                            className={styles.rowActionBtn}
                            title="Edit"
                            onClick={() => onEdit(item)}
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            className={styles.rowActionBtn}
                            title="Delete"
                            onClick={() => onDelete(item.id)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className={styles.cardList}>
            {filtered.map((item) => {
              const par = getParStatus(item);
              return (
                <div key={item.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <div>
                      <h4 className={styles.cardTitle}>{item.name}</h4>
                      {item.brand && (
                        <p className={styles.cardBrand}>{item.brand}</p>
                      )}
                    </div>
                    <span
                      className={`${styles.categoryBadge} ${CATEGORY_STYLE_MAP[item.category] || ''}`}
                    >
                      {item.subcategory || item.category}
                    </span>
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.cardField}>
                      <span className={styles.cardFieldLabel}>Quantity</span>
                      <span className={styles.cardFieldValue}>
                        {par === 'critical' && (
                          <AlertTriangle
                            size={12}
                            style={{
                              color: '#DC2626',
                              marginRight: 4,
                              verticalAlign: 'middle',
                            }}
                          />
                        )}
                        {item.quantity} {item.unit}
                        {item.quantity !== 1 && item.unit !== 'oz' ? 's' : ''}
                      </span>
                    </div>
                    <div className={styles.cardField}>
                      <span className={styles.cardFieldLabel}>Cost</span>
                      <span className={styles.cardFieldValue}>
                        {formatCurrency(item.cost_per_unit)}
                      </span>
                    </div>
                    <div className={styles.cardField}>
                      <span className={styles.cardFieldLabel}>Price/Serve</span>
                      <span className={styles.cardFieldValue}>
                        {formatCurrency(item.price_per_serving)}
                      </span>
                    </div>
                    <div className={styles.cardField}>
                      <span className={styles.cardFieldLabel}>Par Level</span>
                      <span className={styles.cardFieldValue}>
                        <span
                          className={`${styles.parDot} ${PAR_STYLE_MAP[par]}`}
                          style={{
                            display: 'inline-block',
                            marginRight: 6,
                            verticalAlign: 'middle',
                          }}
                        />
                        {item.par_level}
                      </span>
                    </div>
                  </div>
                  <div className={styles.cardFooter}>
                    <button
                      className={`${styles.btnTertiary} ${styles.btnSmall}`}
                      onClick={() => onEdit(item)}
                    >
                      <Edit2 size={14} /> Edit
                    </button>
                    <button
                      className={`${styles.btnDanger}`}
                      onClick={() => onDelete(item.id)}
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
