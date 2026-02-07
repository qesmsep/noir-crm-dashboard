import React, { useState, useEffect, useRef } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/useToast';
import { localInputToUTC } from '../utils/dateUtils';
import { useSettings } from '../context/SettingsContext';

interface NewReservationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: Date;
  initialTableId?: string;
  onReservationCreated: () => void;
}

const eventTypes = [
  { value: 'birthday', label: '🎂 Birthday' },
  { value: 'engagement', label: '💍 Engagement' },
  { value: 'anniversary', label: '🥂 Anniversary' },
  { value: 'party', label: '🎉 Party / Celebration' },
  { value: 'graduation', label: '🎓 Graduation' },
  { value: 'corporate', label: '🧑‍💼 Corporate Event' },
  { value: 'holiday', label: '❄️ Holiday Gathering' },
  { value: 'networking', label: '🤝 Networking' },
  { value: 'fundraiser', label: '🎗️ Fundraiser / Charity' },
  { value: 'bachelor', label: '🥳 Bachelor / Bachelorette Party' },
  { value: 'fun', label: '🍸 Fun Night Out' },
  { value: 'date', label: '💕 Date Night' },
];

const NewReservationDrawer: React.FC<NewReservationDrawerProps> = ({
  isOpen,
  onClose,
  initialDate,
  initialTableId,
  onReservationCreated,
}) => {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    party_size: 2,
    event_type: '',
    notes: '',
    table_id: initialTableId || '',
    start_time: '',
    end_time: '',
    is_checked_in: false,
    send_access_instructions: false,
    send_reminder: false,
    send_confirmation: false,
  });
  const [tables, setTables] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { settings } = useSettings();
  const timezone = settings?.timezone || 'America/Chicago';

  useEffect(() => {
    if (isOpen) {
      fetchTables();
      // Clear form data and set initial values based on the clicked slot
      const startTime = initialDate ? new Date(initialDate) : new Date();
      const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000); // 2 hours later
      
      console.log('NewReservationDrawer - initialDate:', initialDate);
      console.log('NewReservationDrawer - startTime:', startTime);
      console.log('NewReservationDrawer - endTime:', endTime);
      console.log('NewReservationDrawer - startTime ISO:', startTime.toISOString().slice(0, 16));
      console.log('NewReservationDrawer - endTime ISO:', endTime.toISOString().slice(0, 16));
      
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        party_size: 2,
        event_type: '',
        notes: '',
        table_id: initialTableId || '',
        start_time: startTime.toISOString().slice(0, 16), // Format for datetime-local input
        end_time: endTime.toISOString().slice(0, 16),
        is_checked_in: false,
        send_access_instructions: false,
        send_reminder: false,
        send_confirmation: false,
      });
      

    }
  }, [isOpen, initialDate]); // Remove initialTableId from dependencies to prevent multiple resets

    // Ensure table ID is set when drawer opens
  useEffect(() => {
    if (isOpen && initialTableId) {
      setFormData(prev => ({
        ...prev,
        table_id: initialTableId
      }));

    }
  }, [isOpen, initialTableId]);

  // Reset form when drawer closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        party_size: 2,
        event_type: '',
        notes: '',
        table_id: '',
        start_time: '',
        end_time: '',
        is_checked_in: false,
        send_access_instructions: false,
        send_reminder: false,
        send_confirmation: false,
      });
    }
  }, [isOpen]);

  const fetchTables = async () => {
    try {
      const response = await fetch('/api/tables');
      if (response.ok) {
        const result = await response.json();
        setTables(result.data || []);
      } else {
        console.error('Failed to fetch tables:', response.status);
      }
    } catch (error) {
      console.error('Error fetching tables:', error);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Validate required fields
      if (!formData.first_name || !formData.last_name || !formData.phone) {
        toast({
          title: 'Required fields missing',
          description: 'Please fill in first name, last name, and phone number.',
          variant: 'error',
        });
        return;
      }

      if (!formData.start_time || !formData.end_time) {
        toast({
          title: 'Time required',
          description: 'Please select start and end times.',
          variant: 'error',
        });
        return;
      }

      // Convert times to UTC
      const startTimeUTC = localInputToUTC(formData.start_time, timezone);
      const endTimeUTC = localInputToUTC(formData.end_time, timezone);
      
      // Clean phone number
      const cleanedPhone = formData.phone.replace(/\D/g, '');
      
      // Handle empty table_id (convert empty string to null)
      const tableId = formData.table_id === '' ? null : formData.table_id;
      

      

      
      const reservationData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: cleanedPhone,
        party_size: formData.party_size,
        event_type: formData.event_type,
        notes: formData.notes,
        table_id: tableId,
        start_time: startTimeUTC,
        end_time: endTimeUTC,
        is_checked_in: formData.is_checked_in,
        send_access_instructions: formData.send_access_instructions,
        send_reminder: formData.send_reminder,
        send_confirmation: formData.send_confirmation,
        source: 'manual' // Track that this reservation was made manually in the admin interface
      };



      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reservationData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create reservation');
      }

      const result = await response.json();


      toast({
        title: 'Success',
        description: 'Reservation created successfully!',
        variant: 'success',
      });

      onReservationCreated();
      onClose();

    } catch (error: any) {
      console.error('Error creating reservation:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create reservation',
        variant: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    // Reset form data completely
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      party_size: 2,
      event_type: '',
      notes: '',
      table_id: '',
      start_time: '',
      end_time: '',
      is_checked_in: false,
      send_access_instructions: false,
      send_reminder: false,
      send_confirmation: false,
    });
    onClose();
  };



  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent
        side="right"
        className="w-[350px] max-w-[50vw] bg-[#ecede8] border-2 border-[#353535] rounded-[10px] shadow-xl mt-20 mb-6 px-10 py-0 font-montserrat z-[2000]"
      >
        <SheetHeader className="border-b border-[#ECEAE5] pb-0 pt-0 mb-4">
          <SheetTitle className="text-left pt-4">
            <div className="flex flex-col gap-0">
              <div className="text-2xl font-bold font-ivyjournal text-[#353535] mb-0">
                New Reservation
              </div>
              <p className="text-sm text-gray-600 font-montserrat font-normal m-0">
                Create a new reservation
              </p>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="p-4 overflow-y-auto drawer-body-content flex-1">
          <div className="flex flex-col gap-1">{/* VStack replacement */}


            {/* Guest Information */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="first_name" className="text-sm mb-1">First Name *</Label>
                <Input
                  id="first_name"
                  className="font-montserrat h-9"
                  value={formData.first_name}
                  onChange={(e) => handleInputChange('first_name', e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="last_name" className="text-sm mb-1">Last Name *</Label>
                <Input
                  id="last_name"
                  className="font-montserrat h-9"
                  value={formData.last_name}
                  onChange={(e) => handleInputChange('last_name', e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="email" className="text-sm mb-1">Email</Label>
                <Input
                  id="email"
                  type="email"
                  className="font-montserrat h-9"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="phone" className="text-sm mb-1">Phone *</Label>
                <Input
                  id="phone"
                  className="font-montserrat h-9"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  required
                />
              </div>
            </div>


            {/* Reservation Details */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="party_size" className="text-sm mb-1">Party Size *</Label>
                <Select
                  id="party_size"
                  className="font-montserrat h-9"
                  value={formData.party_size}
                  onChange={(e) => handleInputChange('party_size', parseInt(e.target.value))}
                >
                  {Array.from({ length: 15 }, (_, i) => i + 1).map(num => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="event_type" className="text-sm mb-1">Event Type</Label>
                <Select
                  id="event_type"
                  className="font-montserrat h-9"
                  value={formData.event_type}
                  onChange={(e) => handleInputChange('event_type', e.target.value)}
                >
                  <option value="">Select event type</option>
                  {eventTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </Select>
              </div>
            </div>


            {/* Time Selection */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="start_time" className="text-sm mb-1">Start Time *</Label>
                <Input
                  id="start_time"
                  type="datetime-local"
                  className="font-montserrat h-9"
                  value={formData.start_time}
                  onChange={(e) => {
                    console.log('Start time changed:', e.target.value);
                    handleInputChange('start_time', e.target.value);
                  }}
                  required
                />
              </div>
              <div>
                <Label htmlFor="end_time" className="text-sm mb-1">End Time *</Label>
                <Input
                  id="end_time"
                  type="datetime-local"
                  className="font-montserrat h-9"
                  value={formData.end_time}
                  onChange={(e) => {
                    console.log('End time changed:', e.target.value);
                    handleInputChange('end_time', e.target.value);
                  }}
                  required
                />
              </div>
            </div>


            {/* Table Selection */}
            <div>
              <Label htmlFor="table_id" className="text-sm mb-1">Table</Label>
              <Select
                id="table_id"
                className="font-montserrat h-9"
                value={formData.table_id}
                onChange={(e) => handleInputChange('table_id', e.target.value)}
              >
                <option value="">Select table</option>
                {tables.map(table => (
                  <option key={table.id} value={table.id}>Table {table.table_number}</option>
                ))}
              </Select>
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="notes" className="text-sm mb-1">Notes</Label>
              <Textarea
                id="notes"
                className="font-montserrat"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                rows={3}
                placeholder="Special requests, dietary restrictions, etc."
              />
            </div>


            {/* Options */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_checked_in"
                  checked={formData.is_checked_in}
                  onCheckedChange={(checked) => handleInputChange('is_checked_in', checked)}
                  className="font-montserrat"
                />
                <label htmlFor="is_checked_in" className="text-sm font-montserrat cursor-pointer">
                  Check in reservation
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="send_confirmation"
                  checked={formData.send_confirmation}
                  onCheckedChange={(checked) => handleInputChange('send_confirmation', checked)}
                  className="font-montserrat"
                />
                <label htmlFor="send_confirmation" className="text-sm font-montserrat cursor-pointer">
                  Send reservation confirmation text
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="send_access_instructions"
                  checked={formData.send_access_instructions}
                  onCheckedChange={(checked) => handleInputChange('send_access_instructions', checked)}
                  className="font-montserrat"
                />
                <label htmlFor="send_access_instructions" className="text-sm font-montserrat cursor-pointer">
                  Send access instructions
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="send_reminder"
                  checked={formData.send_reminder}
                  onCheckedChange={(checked) => handleInputChange('send_reminder', checked)}
                  className="font-montserrat"
                />
                <label htmlFor="send_reminder" className="text-sm font-montserrat cursor-pointer">
                  Send 1-hour reminder
                </label>
              </div>
            </div>
          </div>
        </div>

        <SheetFooter className="border-t border-[#ECEAE5] justify-between drawer-footer-content pt-4">
          <div className="flex gap-3 mb-2">
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSaving ? 'Creating...' : 'Create Reservation'}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default NewReservationDrawer; 