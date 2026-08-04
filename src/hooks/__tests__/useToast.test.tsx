import { renderHook, act } from '@testing-library/react';

import { useToast } from '../useToast';

/**
 * Guards the variant resolution in useToast, which has now broken twice in
 * opposite directions:
 *
 *  1. A caller-supplied `variant` was dropped entirely, because it rode along
 *     in `...rest` which is spread before the computed `variant` key. Every
 *     caller using `variant:` instead of `status:` got a grey toast.
 *  2. Honoring `variant` then made an unrecognised value reachable. cva
 *     contributes no classes at all for a value outside its map, so
 *     `variant: 'destructive'` rendered a completely unstyled toast — worse
 *     than the grey it used to be clobbered into.
 */
describe('useToast variant resolution', () => {
  const latest = (result: { current: ReturnType<typeof useToast> }) =>
    result.current.toasts[0];

  it('maps Chakra status to a variant', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.toast({ title: 'Saved', status: 'success' });
    });
    expect(latest(result).variant).toBe('success');
  });

  it('honors a caller-supplied variant when status is absent', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.toast({ title: 'Nope', variant: 'error' });
    });
    expect(latest(result).variant).toBe('error');
  });

  it('lets status win when both are given', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.toast({ title: 'Both', status: 'warning', variant: 'error' });
    });
    expect(latest(result).variant).toBe('warning');
  });

  it("aliases shadcn's 'destructive' to error rather than passing it through", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.toast({ title: 'Deleted', variant: 'destructive' as never });
    });
    expect(latest(result).variant).toBe('error');
  });

  it('degrades an unrecognised variant to default instead of leaving it unstyled', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.toast({ title: 'Odd', variant: 'chartreuse' as never });
    });
    expect(latest(result).variant).toBe('default');
  });

  it('defaults when neither is given', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.toast({ title: 'Plain' });
    });
    expect(latest(result).variant).toBe('default');
  });
});
