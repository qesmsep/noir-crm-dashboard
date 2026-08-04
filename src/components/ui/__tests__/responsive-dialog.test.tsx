import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import { ResponsiveDialog } from '../responsive-dialog';

/**
 * `dismissable` is the load-bearing bit here. It exists so a nested
 * confirmation can take Escape and outside-clicks without tearing down the form
 * behind it — the campaign builder's delete flow depends on it, and a
 * regression would silently discard a half-filled form rather than fail loudly.
 */
describe('ResponsiveDialog', () => {
  const setup = (props: Partial<React.ComponentProps<typeof ResponsiveDialog>> = {}) => {
    const onOpenChange = jest.fn();
    render(
      <ResponsiveDialog
        open
        onOpenChange={onOpenChange}
        title="Edit Message"
        footer={<button type="button">Save</button>}
        {...props}
      >
        <p>form body</p>
      </ResponsiveDialog>
    );
    return { onOpenChange };
  };

  it('renders title, body and footer', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Edit Message' })).toBeInTheDocument();
    expect(screen.getByText('form body')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('closes on Escape by default', () => {
    const { onOpenChange } = setup();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not close on Escape when not dismissable', () => {
    const { onOpenChange } = setup({ dismissable: false });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('exposes a close control', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('names the dialog for screen readers even without a description', () => {
    // Radix warns when Content has no Description; the fallback repeats the
    // title rather than leaving the dialog unnamed.
    setup();
    expect(screen.getByRole('dialog', { name: 'Edit Message' })).toHaveAccessibleDescription(
      'Edit Message'
    );
  });

  it('uses the given description when one is provided', () => {
    setup({ description: 'Configure when this message sends' });
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription(
      'Configure when this message sends'
    );
  });

  it('renders no footer element when none is passed', () => {
    setup({ footer: undefined });
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });
});
