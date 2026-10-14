import { ingredientItemIds, validateLocationPicks } from '../inventory-utils';
import type { RecipeIngredient } from '../../types/inventory';

const ing = (id: string, location_items?: Record<string, string | null>): RecipeIngredient =>
  ({ inventory_item_id: id, name: id, quantity: 1, unit: 'oz', ...(location_items ? { location_items } : {}) }) as RecipeIngredient;

describe('ingredientItemIds', () => {
  it('collects each bottle once, including picked bottles and skipping not-tracked', () => {
    const ids = ingredientItemIds([ing('a', { bar1: 'b', bar2: null }), ing('b'), ing('c', { bar1: 'a' })]);
    expect(ids.sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('validateLocationPicks', () => {
  const where = new Map([
    ['b', 'bar1'],
    ['c', 'bar2'],
  ]);

  it('accepts no picks, not-tracked picks, and a bottle stocked at that bar', () => {
    expect(validateLocationPicks([ing('a'), ing('a', { bar1: null }), ing('a', { bar1: 'b', bar2: 'c' })], where)).toBe(true);
  });

  it('rejects a bottle stocked at a different bar', () => {
    expect(validateLocationPicks([ing('a', { bar2: 'b' })], where)).toBe(false);
  });

  it('rejects a bottle that no longer exists', () => {
    expect(validateLocationPicks([ing('a', { bar1: 'gone' })], where)).toBe(false);
  });
});
