import { findSimilarItems, itemLabel, matchKey, similarity, LIKELY_DUPLICATE, SIMILAR } from '../inventory/itemNames';

const it_ = (name: string, brand = '', id = name) => ({ id, name, brand });

describe('itemLabel', () => {
  it('puts the brand in front of the name', () => {
    expect(itemLabel({ name: 'Reposado Tequila', brand: 'Espolon' })).toBe('Espolon Reposado Tequila');
  });
  it('never says the brand twice', () => {
    expect(itemLabel({ name: "Tito's", brand: "Tito's" })).toBe("Tito's");
    expect(itemLabel({ name: 'Buffalo Trace', brand: 'Buffalo Trace' })).toBe('Buffalo Trace');
    expect(itemLabel({ name: 'St. George Spiced Pear Liqueur', brand: 'St. George' })).toBe('St. George Spiced Pear Liqueur');
  });
  it('leaves out "House-made" and a blank brand', () => {
    expect(itemLabel({ name: 'Simple Syrup', brand: 'House-made' })).toBe('Simple Syrup');
    expect(itemLabel({ name: 'Limes', brand: '' })).toBe('Limes');
    expect(itemLabel({ name: 'Limes', brand: null })).toBe('Limes');
  });
});

describe('matchKey', () => {
  it('is the same for one bottle entered with and without its brand', () => {
    expect(matchKey({ name: 'Buffalo Trace', brand: '' })).toBe(matchKey({ name: 'Buffalo Trace', brand: 'Buffalo Trace' }));
  });
  it('ignores accents, case, punctuation and trailing spaces', () => {
    expect(matchKey({ name: 'Rosé', brand: 'Sex ' })).toBe(matchKey({ name: 'rose', brand: 'Sex' }));
    expect(matchKey({ name: 'Espolòn' })).toBe(matchKey({ name: 'espolon' }));
  });
});

describe('similarity', () => {
  // Real duplicates found in the 2026-10 inventory audit.
  const likely: Array<[string, string, string, string]> = [
    ['St George Spiced Pear', '', 'St. George Spiced Pear Liqueur', ''],
    ['Passion Fruit Syrup', 'Simply Squeeze', 'Passionfruit Syrup', ''],
    ['Luxardo Maraschino', '', 'Maraschino', 'Luxardo'],
    ['Cimarron Blanco Tequila', '', 'Cimmaron Blanco', 'Cimmaron'],
    ['Rose Petals', '', 'RosesPetals', ''],
    ['Free State Yakimaniac', 'Free State', 'Yakamaniac IPA', 'Free State'],
    ['Buffalo Trace', '', 'Buffalo Trace', 'Buffalo Trace'],
  ];
  it.each(likely)('%s / %s is a likely duplicate of %s / %s', (an, ab, bn, bb) => {
    expect(similarity({ name: an, brand: ab }, { name: bn, brand: bb })).toBeGreaterThanOrEqual(LIKELY_DUPLICATE);
  });

  // Worth showing, but plausibly a different bottle.
  const worthALook: Array<[string, string]> = [
    ['St Germain', 'St. Germain Elderflower Liqueur'],
    ["Blanton's Single Barrel", "Blanton's Gold Single Barrel"],
    ['Cristalino', 'Komos Anejo Cristalino'],
    ['Woodford Reserve', 'Woodford Reserved Double Oaked'],
  ];
  it.each(worthALook)('%s / %s is similar but not a likely duplicate', (a, b) => {
    const s = similarity({ name: a }, { name: b });
    expect(s).toBeGreaterThanOrEqual(SIMILAR);
    expect(s).toBeLessThan(LIKELY_DUPLICATE);
  });

  const different: Array<[string, string, string, string]> = [
    ['Lime Juice', '', 'Lemon Juice', ''],
    ['Lime Juice', '', 'Limes', ''],
    ['Grapefruit Juice', 'Simply', 'Grapefruit Vodka', 'Ketel One'],
    ['Rosé', 'Sex', 'Rose Gin', 'Glendalough'],
    ['Ocho Blanco', '', 'Ocho Reposado', ''],
    ['Ocho Reposado', '', 'Reposado Tequila', 'Espolon'],
    ["Augusta Buckner's 10 Year", '', "Augusta Buckner's 15 Year", ''],
    ['Weller 12 Year', '', 'Weller Special Reserve', ''],
  ];
  it.each(different)('%s / %s is not flagged as %s / %s', (an, ab, bn, bb) => {
    expect(similarity({ name: an, brand: ab }, { name: bn, brand: bb })).toBeLessThan(LIKELY_DUPLICATE);
  });
  it('does not match on style words alone', () => {
    expect(similarity({ name: 'Ocho Reposado' }, { name: 'Fortaleza Reposado' })).toBeLessThan(SIMILAR);
    expect(similarity({ name: 'Four Roses' }, { name: 'Rosé', brand: 'Sex' })).toBeLessThan(SIMILAR);
  });
});

describe('findSimilarItems', () => {
  const items = [
    { ...it_('St. George Spiced Pear Liqueur', 'St. George', 'a'), location_id: 'noir' },
    { ...it_('St. George Spiced Pear Liqueur', 'St. George', 'b'), location_id: 'roof' },
    { ...it_('Lemon Juice', 'House-made', 'c'), location_id: 'noir' },
    { ...it_("Blanton's Single Barrel", '', 'd'), location_id: 'noir' },
  ];

  it('finds the existing bottle once, even when every bar has it', () => {
    const hits = findSimilarItems({ name: 'St George Spiced Pear', brand: '' }, items);
    expect(hits).toHaveLength(1);
    expect(hits[0].likely).toBe(true);
  });
  it('returns nothing for a new product', () => {
    expect(findSimilarItems({ name: 'Lime Juice', brand: '' }, items)).toEqual([]);
  });
  it('skips the item being edited', () => {
    expect(findSimilarItems({ name: 'Lemon Juice' }, items, { excludeId: 'c' })).toEqual([]);
  });
  it('marks a near match as similar, not likely', () => {
    const hits = findSimilarItems({ name: "Blanton's Gold Single Barrel" }, items);
    expect(hits.map(h => [h.item.id, h.likely])).toEqual([['d', false]]);
  });
  it('ignores an empty name', () => {
    expect(findSimilarItems({ name: '  ' }, items)).toEqual([]);
  });
});
