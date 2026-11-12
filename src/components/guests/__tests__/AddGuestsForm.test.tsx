import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AddGuestsForm, { splitContactName } from '../AddGuestsForm';

describe('AddGuestsForm', () => {
  afterEach(() => {
    delete (navigator as any).contacts;
    delete (window as any).ContactsManager;
  });

  it('labels last name optional and hides the contacts button without the Contact Picker (iPhone Safari)', () => {
    render(<AddGuestsForm maxGuests={2} onSubmit={jest.fn()} />);
    expect(screen.getByText('(optional)')).toBeInTheDocument();
    expect(screen.queryByText('Choose from contacts')).not.toBeInTheDocument();
  });

  it('shows the contacts button and prefills rows where supported', async () => {
    (window as any).ContactsManager = function ContactsManager() {};
    (navigator as any).contacts = { select: jest.fn().mockResolvedValue([{ name: ['Ava Marie Stone'], tel: ['913-555-0101'] }]) };
    render(<AddGuestsForm maxGuests={2} onSubmit={jest.fn()} />);
    fireEvent.click(screen.getByText('Choose from contacts'));
    await waitFor(() => expect(screen.getByDisplayValue('Ava')).toBeInTheDocument());
    expect(screen.getByDisplayValue('Marie Stone')).toBeInTheDocument();
    expect(screen.getByDisplayValue('913-555-0101')).toBeInTheDocument();
  });

  it('caps "Add another" at the spots left', () => {
    render(<AddGuestsForm maxGuests={2} onSubmit={jest.fn()} />);
    fireEvent.click(screen.getByText('Add another'));
    expect(screen.queryByText('Add another')).not.toBeInTheDocument();
  });

  it('requires first name and mobile on a started row, and maps server row errors back', async () => {
    const onSubmit = jest.fn().mockResolvedValue({ ok: false, error: 'Some guests need fixing.', rowErrors: [{ index: 0, field: 'phone', error: "That's the host's own number." }] });
    render(<AddGuestsForm maxGuests={3} onSubmit={onSubmit} />);
    fireEvent.change(screen.getAllByLabelText('First name')[0], { target: { value: 'Ava' } });
    fireEvent.click(screen.getByText('Send'));
    expect(await screen.findByText('Mobile number is required.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(screen.getAllByLabelText('Mobile')[0], { target: { value: '9135550100' } });
    fireEvent.click(screen.getByText('Send'));
    expect(await screen.findByText("That's the host's own number.")).toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledWith([{ first_name: 'Ava', last_name: '', phone: '9135550100' }]);
  });

  it('full party: explains how to add more and still offers Skip', () => {
    const onSkip = jest.fn();
    render(<AddGuestsForm maxGuests={0} onSubmit={jest.fn()} onSkip={onSkip} />);
    expect(screen.getByText(/Raise the party size/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Skip'));
    expect(onSkip).toHaveBeenCalled();
  });

  it('splitContactName', () => {
    expect(splitContactName('Ava')).toEqual({ first_name: 'Ava', last_name: '' });
    expect(splitContactName('  Ava  Marie Stone ')).toEqual({ first_name: 'Ava', last_name: 'Marie Stone' });
    expect(splitContactName(undefined)).toEqual({ first_name: '', last_name: '' });
  });
});
