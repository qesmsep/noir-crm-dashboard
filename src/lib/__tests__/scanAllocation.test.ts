import { planMatchedAllocation } from '../inventory/scanAllocation';

const LOCS = [
  { id: 'noir', slug: 'noirkc' },
  { id: 'roof', slug: 'rooftopkc' },
  { id: 'op', slug: 'noirop' },
];
const row = (id: string, location_id: string, extra = {}) => ({ id, name: "Tito's Handmade Vodka", brand: "Tito's", location_id, volume_ml: 750, ...extra });

describe('planMatchedAllocation', () => {
  const titosNoir = row('t-n', 'noir');
  const titosRoof = row('t-r', 'roof', { brand: '' }); // brand left blank at the roof: same label
  const items = [titosNoir, titosRoof, row('x', 'roof', { name: 'Ketel One', brand: 'Ketel One' })];

  it('puts each bar’s share on that bar’s own row', () => {
    const steps = planMatchedAllocation(titosNoir, [['noirkc', 4], ['rooftopkc', 2]], items, LOCS);
    expect(steps.map(s => [s.kind, 'item' in s ? s.item.id : null, s.quantity])).toEqual([
      ['add', 't-n', 4],
      ['add', 't-r', 2],
    ]);
  });

  it('works the same whichever bar’s row the scan matched', () => {
    const steps = planMatchedAllocation(titosRoof, [['noirkc', 3]], items, LOCS);
    expect(steps).toEqual([expect.objectContaining({ kind: 'add', item: titosNoir, quantity: 3 })]);
  });

  it('creates the item at a bar that does not stock it yet', () => {
    const steps = planMatchedAllocation(titosNoir, [['noirop', 1]], items, LOCS);
    expect(steps).toEqual([{ kind: 'create', from: titosNoir, location_id: 'op', location_slug: 'noirop', quantity: 1 }]);
  });

  it('prefers the same bottle size when a bar has two rows for the product', () => {
    const liter = row('t-r1', 'roof', { volume_ml: 1000 });
    const steps = planMatchedAllocation(titosNoir, [['rooftopkc', 1]], [titosNoir, liter, titosRoof], LOCS);
    expect(steps[0]).toEqual(expect.objectContaining({ kind: 'add', item: titosRoof }));
  });

  it('skips zero shares and reports an unknown bar', () => {
    const steps = planMatchedAllocation(titosNoir, [['noirkc', 0], ['nowhere', 2]], items, LOCS);
    expect(steps).toEqual([{ kind: 'error', location_slug: 'nowhere', quantity: 2, reason: 'unknown location' }]);
  });
});
