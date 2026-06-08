import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import type { InventoryItem } from '../../types/inventory';
import { DROPDOWN_CLOSE_DELAY_MS, SEARCH_DEBOUNCE_MS } from '../../constants/inventory';
import styles from '../../styles/Inventory.module.css';

interface IngredientSearchDropdownProps {
  index: number;
  value: string;
  inventory: InventoryItem[];
  onSelect: (index: number, item: InventoryItem) => void;
  onAddNew: (index: number) => void;
  placeholder?: string;
}

/**
 * Debounce helper
 */
function debounce<T extends (...args: any[]) => void>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Reusable ingredient search dropdown with autocomplete
 * Features:
 * - Debounced search
 * - Keyboard navigation
 * - Accessibility (ARIA attributes)
 * - Proper cleanup of timeouts
 */
export default function IngredientSearchDropdown({
  index,
  value,
  inventory,
  onSelect,
  onAddNew,
  placeholder = 'Search inventory...',
}: IngredientSearchDropdownProps) {
  const [searchTerm, setSearchTerm] = useState(value);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Update search term when value prop changes
  useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  // Filter inventory based on search term
  const filteredInventory = useCallback(() => {
    if (!searchTerm) return inventory;
    const term = searchTerm.toLowerCase();
    return inventory.filter((item) => {
      const fullName = `${item.brand ? item.brand + ' ' : ''}${item.name}`.toLowerCase();
      return fullName.includes(term);
    });
  }, [searchTerm, inventory]);

  const filtered = filteredInventory();

  // Handle search input change (debounced)
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    setShowDropdown(true);
    setSelectedIndex(-1);
  };

  // Handle item selection
  const handleSelect = (item: InventoryItem) => {
    onSelect(index, item);
    setShowDropdown(false);
    setSelectedIndex(-1);
  };

  // Handle focus
  const handleFocus = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setShowDropdown(true);
  };

  // Handle blur with timeout
  const handleBlur = () => {
    blurTimeoutRef.current = setTimeout(() => {
      setShowDropdown(false);
      setSelectedIndex(-1);
    }, DROPDOWN_CLOSE_DELAY_MS);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) {
      if (e.key === 'ArrowDown') {
        setShowDropdown(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && filtered[selectedIndex]) {
          handleSelect(filtered[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && dropdownRef.current) {
      const selectedElement = dropdownRef.current.children[selectedIndex] as HTMLElement;
      selectedElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  return (
    <div className={styles.ingredientSelectWrapper} style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        className={`${styles.formInput} ${styles.ingredientSelect}`}
        placeholder={placeholder}
        value={searchTerm}
        onChange={handleSearchChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={showDropdown}
        aria-haspopup="listbox"
        aria-controls={`ingredient-listbox-${index}`}
        aria-activedescendant={
          selectedIndex >= 0 ? `ingredient-option-${index}-${selectedIndex}` : undefined
        }
        aria-autocomplete="list"
      />
      {showDropdown && (
        <div
          ref={dropdownRef}
          id={`ingredient-listbox-${index}`}
          role="listbox"
          aria-label="Inventory items"
          style={{
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
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          }}
        >
          {filtered.map((item, idx) => (
            <div
              key={item.id}
              id={`ingredient-option-${index}-${idx}`}
              role="option"
              aria-selected={idx === selectedIndex}
              tabIndex={-1}
              style={{
                padding: '0.5rem 0.75rem',
                cursor: 'pointer',
                borderBottom: '1px solid #F3F4F6',
                backgroundColor: idx === selectedIndex ? '#F3F4F6' : 'white',
              }}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent blur
                handleSelect(item);
              }}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              {item.brand ? `${item.brand} ` : ''}
              {item.name}
            </div>
          ))}
          {filtered.length === 0 && (
            <div
              style={{
                padding: '0.5rem 0.75rem',
                color: '#9CA3AF',
                textAlign: 'center',
              }}
            >
              No items found
            </div>
          )}
        </div>
      )}
      <button
        type="button"
        className={styles.addNewItemBtn}
        onClick={() => onAddNew(index)}
        onMouseDown={(e) => e.preventDefault()} // Prevent blur
        title="Add new inventory item"
        aria-label="Add new inventory item"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
