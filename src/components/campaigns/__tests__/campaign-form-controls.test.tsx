import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import {
  Field,
  NumberField,
  RadioCardGroup,
  ToggleChipGroup,
  WEEKDAY_OPTIONS,
} from '../campaign-form-controls';

/**
 * These cover the two behaviours that regressed silently during this work
 * rather than the components' surface area in general.
 *
 * The weekday round-trip in particular broke independently in both campaign
 * components and was caught by review twice, not by anything automated — it is
 * the exact case a test earns its place on.
 */

describe('ToggleChipGroup', () => {
  it('marks a chip selected when the stored value is numeric', () => {
    // Weekdays come back from the database as INTEGER[] / JSONB numbers while
    // the options are string-valued. Callers convert with `.map(String)`; this
    // asserts the contract that conversion relies on.
    render(
      <ToggleChipGroup
        value={[1, 3].map(String)}
        onChange={() => {}}
        options={WEEKDAY_OPTIONS}
      />
    );

    expect(screen.getByRole('button', { name: 'Mon' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Wed' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Tue' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('does not select anything when numbers are passed unconverted', () => {
    // The original bug: strict `includes` comparing 1 against "1". Pinned so a
    // future refactor that drops the conversion fails loudly here instead of
    // silently showing an empty selection to the user.
    render(
      <ToggleChipGroup
        value={[1, 3] as unknown as string[]}
        onChange={() => {}}
        options={WEEKDAY_OPTIONS}
      />
    );

    expect(screen.getByRole('button', { name: 'Mon' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('reports the full selection when a chip is toggled on', () => {
    const onChange = jest.fn();
    render(
      <ToggleChipGroup value={['1']} onChange={onChange} options={WEEKDAY_OPTIONS} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Wed' }));
    expect(onChange).toHaveBeenCalledWith(['1', '3']);
  });

  it('removes a chip that is toggled off', () => {
    const onChange = jest.fn();
    render(
      <ToggleChipGroup value={['1', '3']} onChange={onChange} options={WEEKDAY_OPTIONS} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mon' }));
    expect(onChange).toHaveBeenCalledWith(['3']);
  });
});

describe('NumberField', () => {
  it('can be cleared mid-edit without the old value snapping back', () => {
    const { rerender } = render(
      <NumberField value={5} onChange={() => {}} min={0} max={31} />
    );
    const input = screen.getByRole('spinbutton');

    fireEvent.change(input, { target: { value: '' } });
    // The committed value is unchanged, so a naive controlled input would have
    // repainted "5" here.
    rerender(<NumberField value={5} onChange={() => {}} min={0} max={31} />);

    expect(input).toHaveValue(null);
  });

  it('does not clamp to max while typing', () => {
    // Typing "40" into a max=31 field must not snap to "31" on the second
    // keystroke; the upper bound is applied on blur instead.
    const onChange = jest.fn();
    render(<NumberField value={4} onChange={onChange} min={0} max={31} />);

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '40' } });

    expect(onChange).toHaveBeenCalledWith(40);
  });

  it('clamps to max on blur', () => {
    const onChange = jest.fn();
    render(<NumberField value={40} onChange={onChange} min={0} max={31} />);
    const input = screen.getByRole('spinbutton');

    fireEvent.change(input, { target: { value: '40' } });
    onChange.mockClear();
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(31);
  });

  it('enforces the lower bound while typing', () => {
    const onChange = jest.fn();
    render(<NumberField value={5} onChange={onChange} min={2} max={31} />);

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1' } });

    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('restores the committed value when left empty on blur', () => {
    render(<NumberField value={7} onChange={() => {}} min={0} max={31} />);
    const input = screen.getByRole('spinbutton');

    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    expect(input).toHaveValue(7);
  });
});

describe('Field labelling', () => {
  it('names a radio group that cannot be reached by htmlFor', () => {
    // `<label htmlFor>` binds only to a single labelable control, so a
    // role="radiogroup" container needs aria-labelledby to be announced.
    render(
      <Field label="Timing Type">
        <RadioCardGroup
          name="timing"
          value="a"
          onChange={() => {}}
          options={[
            { value: 'a', label: 'Option A' },
            { value: 'b', label: 'Option B' },
          ]}
        />
      </Field>
    );

    expect(screen.getByRole('radiogroup', { name: 'Timing Type' })).toBeInTheDocument();
  });

  it('names a toggle chip group the same way', () => {
    render(
      <Field label="Select Weekdays">
        <ToggleChipGroup value={[]} onChange={() => {}} options={WEEKDAY_OPTIONS} />
      </Field>
    );

    expect(screen.getByRole('group', { name: 'Select Weekdays' })).toBeInTheDocument();
  });
});
