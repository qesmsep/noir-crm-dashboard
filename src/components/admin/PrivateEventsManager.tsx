import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { Plus, Edit2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { localInputToUTC } from '@/utils/dateUtils';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import styles from '@/styles/PrivateEventsManager.module.css';

interface PrivateEvent {
  id: string;
  name?: string; // Legacy field name
  title?: string; // Current field name
  start_time: string;
  end_time: string;
  description?: string;
  event_description?: string;
  guest_count?: number;
  source?: 'minaka' | 'local';
  client_name?: string;
  client_email?: string;
  location?: string;
  minaka_url?: string;
  rsvp_enabled?: boolean;
  rsvp_url?: string;
  max_guests?: number;
  total_attendees_maximum?: number;
  background_image_url?: string;
  is_member_event?: boolean;
}

interface Reservation {
  id: string;
  start_time: string;
  end_time?: string;
  party_size?: number;
  phone?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  status?: string;
  membership_type?: string;
}

interface PrivateEventsManagerProps {
  onEventChange: () => void;
}

export default function PrivateEventsManager({ onEventChange }: PrivateEventsManagerProps) {
  const { settings } = useSettings();
  const timezone = settings?.timezone || 'America/Chicago';
  const [events, setEvents] = useState<PrivateEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PrivateEvent | null>(null);
  const [linkedReservations, setLinkedReservations] = useState<Reservation[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    title: '',
    start_time: '',
    end_time: '',
    description: '',
    guest_count: '',
    rsvp_enabled: false,
    max_guests: 10,
    total_attendees_maximum: 100,
    is_member_event: false,
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('private_events')
        .select('*')
        .order('start_time', { ascending: false });

      if (error) throw error;

      // Separate past and future events
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const futureEvents: PrivateEvent[] = [];
      const pastEvents: PrivateEvent[] = [];

      (data || []).forEach(event => {
        const eventDate = new Date(event.start_time);
        eventDate.setHours(0, 0, 0, 0);

        if (eventDate >= today) {
          futureEvents.push(event);
        } else {
          pastEvents.push(event);
        }
      });

      setEvents([...futureEvents, ...pastEvents]);
    } catch (error) {
      console.error('Error fetching events:', error);
      toast({
        title: 'Error',
        description: 'Failed to load private events',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchLinkedReservations = async (eventId: string) => {
    try {
      const { data: reservations, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('private_event_id', eventId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLinkedReservations(reservations || []);
    } catch (error) {
      console.error('Error fetching linked reservations:', error);
      setLinkedReservations([]);
    }
  };

  const uploadImage = async (eventId: string): Promise<string | null> => {
    if (!imageFile) return null;

    try {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${eventId}-${Date.now()}.${fileExt}`;
      const filePath = `private-events/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(filePath, imageFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('uploads')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload image',
        variant: 'destructive',
      });
      return null;
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!formData.start_time || !formData.end_time) {
        toast({
          title: 'Error',
          description: 'Start time and end time are required',
          variant: 'destructive',
        });
        return;
      }

      const startTimeUTC = localInputToUTC(formData.start_time, timezone);
      const endTimeUTC = localInputToUTC(formData.end_time, timezone);

      if (editingEvent) {
        // Generate RSVP URL if enabling RSVP and no URL exists yet
        let rsvp_url = editingEvent.rsvp_url;
        if (formData.rsvp_enabled && !rsvp_url) {
          const { data: urlData, error: urlError } = await supabase
            .rpc('generate_rsvp_url');

          if (urlError) {
            console.error('Error generating RSVP URL:', urlError);
          } else {
            rsvp_url = urlData;
          }
        }

        // Upload image if selected
        let background_image_url = editingEvent.background_image_url;
        if (imageFile) {
          const uploadedUrl = await uploadImage(editingEvent.id);
          if (uploadedUrl) {
            background_image_url = uploadedUrl;
          }
        }

        const { error } = await supabase
          .from('private_events')
          .update({
            title: formData.title,
            start_time: startTimeUTC,
            end_time: endTimeUTC,
            event_description: formData.description,
            guest_count: formData.guest_count ? parseInt(formData.guest_count) : null,
            rsvp_enabled: formData.rsvp_enabled,
            rsvp_url: formData.rsvp_enabled ? rsvp_url : null,
            max_guests: formData.rsvp_enabled ? formData.max_guests : null,
            total_attendees_maximum: formData.rsvp_enabled ? formData.total_attendees_maximum : null,
            background_image_url,
            is_member_event: formData.is_member_event,
          })
          .eq('id', editingEvent.id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Private event updated successfully',
        });
      } else {
        // Create new event
        const { data: newEvent, error: insertError } = await supabase
          .from('private_events')
          .insert({
            title: formData.title,
            start_time: startTimeUTC,
            end_time: endTimeUTC,
            event_description: formData.description,
            guest_count: formData.guest_count ? parseInt(formData.guest_count) : null,
            rsvp_enabled: formData.rsvp_enabled,
            max_guests: formData.rsvp_enabled ? formData.max_guests : null,
            total_attendees_maximum: formData.rsvp_enabled ? formData.total_attendees_maximum : null,
            is_member_event: formData.is_member_event,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Generate RSVP URL if enabled
        if (formData.rsvp_enabled && newEvent) {
          const { data: urlData, error: urlError } = await supabase
            .rpc('generate_rsvp_url');

          if (!urlError && urlData) {
            await supabase
              .from('private_events')
              .update({ rsvp_url: urlData })
              .eq('id', newEvent.id);
          }
        }

        // Upload image if selected
        if (imageFile && newEvent) {
          const uploadedUrl = await uploadImage(newEvent.id);
          if (uploadedUrl) {
            await supabase
              .from('private_events')
              .update({ background_image_url: uploadedUrl })
              .eq('id', newEvent.id);
          }
        }

        toast({
          title: 'Success',
          description: 'Private event created successfully',
        });
      }

      fetchEvents();
      onEventChange();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving event:', error);
      toast({
        title: 'Error',
        description: 'Failed to save private event',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      const { error } = await supabase
        .from('private_events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Private event deleted successfully',
      });

      fetchEvents();
      onEventChange();
    } catch (error) {
      console.error('Error deleting event:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete private event',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (event: PrivateEvent) => {
    setEditingEvent(event);

    // Convert ISO datetime strings to datetime-local format
    const formatForInput = (isoString: string) => {
      if (!isoString) return '';
      const date = new Date(isoString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    setFormData({
      name: event.name || '',
      title: event.title || event.name || '',
      start_time: formatForInput(event.start_time),
      end_time: formatForInput(event.end_time),
      description: event.event_description || event.description || '',
      guest_count: event.guest_count?.toString() || '',
      rsvp_enabled: event.rsvp_enabled || false,
      max_guests: event.max_guests || 10,
      total_attendees_maximum: event.total_attendees_maximum || 100,
      is_member_event: event.is_member_event || false,
    });

    if (event.rsvp_enabled) {
      fetchLinkedReservations(event.id);
    } else {
      setLinkedReservations([]);
    }

    setIsCreateModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsCreateModalOpen(false);
    setEditingEvent(null);
    setLinkedReservations([]);
    setImageFile(null);
    setImagePreview(null);
    setFormData({
      name: '',
      title: '',
      start_time: '',
      end_time: '',
      description: '',
      guest_count: '',
      rsvp_enabled: false,
      max_guests: 10,
      total_attendees_maximum: 100,
      is_member_event: false,
    });
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const futureEvents = events.filter(e => {
    const eventDate = new Date(e.start_time);
    eventDate.setHours(0, 0, 0, 0);
    return eventDate >= today;
  });

  const pastEvents = events.filter(e => {
    const eventDate = new Date(e.start_time);
    eventDate.setHours(0, 0, 0, 0);
    return eventDate < today;
  });

  const renderEvent = (event: PrivateEvent, isPast: boolean = false) => (
    <div key={event.id} className={`${styles.eventCard} ${isPast ? styles.pastEvent : ''}`}>
      <div className={styles.eventHeader}>
        <div className={styles.eventInfo}>
          <h3 className={styles.eventTitle}>{event.title || event.name || 'Untitled Event'}</h3>
          <div className={styles.badges}>
            <Badge variant={isPast ? "secondary" : "default"}>
              📅 {format(parseISO(event.start_time), 'MMM d, yyyy')}
            </Badge>
            <Badge variant={isPast ? "secondary" : "default"}>
              🕐 {format(parseISO(event.start_time), 'h:mm a')} - {format(parseISO(event.end_time), 'h:mm a')}
            </Badge>
            {event.rsvp_enabled && event.total_attendees_maximum ? (
              <Badge variant="success">
                👥 Capacity: {event.total_attendees_maximum}
              </Badge>
            ) : event.guest_count ? (
              <Badge variant="success">
                👥 {event.guest_count} guests
              </Badge>
            ) : null}
            {event.is_member_event && (
              <Badge variant="default">
                ⭐ Noir Event
              </Badge>
            )}
            {event.rsvp_enabled && event.rsvp_url && (
              <Badge
                variant="secondary"
                className={styles.clickableBadge}
                onClick={() => {
                  const url = `${window.location.origin}/rsvp/${event.rsvp_url}`;
                  navigator.clipboard.writeText(url);
                  toast({
                    title: 'Copied!',
                    description: 'RSVP link copied to clipboard',
                  });
                }}
              >
                🔗 RSVP
              </Badge>
            )}
          </div>
        </div>
        <div className={styles.eventActions}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEdit(event)}
          >
            <Edit2 size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(event.id)}
          >
            <X size={16} />
          </Button>
        </div>
      </div>
      {(event.event_description || event.description) && (
        <p className={styles.eventDescription}>{event.event_description || event.description}</p>
      )}
    </div>
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Private Events</h2>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus size={16} className="mr-2" />
          Create Event
        </Button>
      </div>

      {loading ? (
        <div className={styles.loadingContainer}>
          <Spinner size="lg" />
          <p className={styles.loadingText}>Loading events...</p>
        </div>
      ) : events.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🎉</div>
          <h3 className={styles.emptyTitle}>No Private Events</h3>
          <p className={styles.emptyText}>Create your first private event to get started</p>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus size={16} className="mr-2" />
            Create Event
          </Button>
        </div>
      ) : (
        <div className={styles.eventsList}>
          {futureEvents.length > 0 && (
            <>
              <h3 className={styles.sectionTitle}>Upcoming Events</h3>
              {futureEvents.map(event => renderEvent(event, false))}
            </>
          )}

          {pastEvents.length > 0 && (
            <>
              <h3 className={`${styles.sectionTitle} ${styles.pastSection}`}>Past Events</h3>
              {pastEvents.map(event => renderEvent(event, true))}
            </>
          )}
        </div>
      )}

      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className={styles.modal}>
          <DialogHeader>
            <DialogTitle>
              {editingEvent ? 'Edit Private Event' : 'Create Private Event'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formField}>
              <Label htmlFor="title">Event Name *</Label>
              <Input
                id="title"
                value={formData.title || formData.name}
                onChange={(e) => setFormData({ ...formData, title: e.target.value, name: e.target.value })}
                placeholder="e.g., Holiday Party"
                required
              />
              <p className={styles.helpText}>The name of the private event</p>
            </div>

            <div className={styles.formField}>
              <Label htmlFor="start_time">Start Time *</Label>
              <Input
                id="start_time"
                type="datetime-local"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                required
              />
              <p className={styles.helpText}>When the event begins</p>
            </div>

            <div className={styles.formField}>
              <Label htmlFor="end_time">End Time *</Label>
              <Input
                id="end_time"
                type="datetime-local"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                required
              />
              <p className={styles.helpText}>When the event ends</p>
            </div>

            <div className={styles.formField}>
              <Label htmlFor="guest_count">Guest Count</Label>
              <Input
                id="guest_count"
                type="number"
                value={formData.guest_count}
                onChange={(e) => setFormData({ ...formData, guest_count: e.target.value })}
                placeholder="Number of guests"
              />
              <p className={styles.helpText}>Expected number of guests (for non-RSVP events)</p>
            </div>

            <div className={styles.formField}>
              <Label htmlFor="image">Event Background Image (Optional)</Label>
              <Input
                id="image"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
              />
              {imagePreview && (
                <div className={styles.imagePreview}>
                  <img src={imagePreview} alt="Preview" />
                </div>
              )}
              {!imagePreview && editingEvent?.background_image_url && (
                <div className={styles.imagePreview}>
                  <p className={styles.imageLabel}>Current image:</p>
                  <img src={editingEvent.background_image_url} alt="Current" />
                </div>
              )}
              <p className={styles.helpText}>
                If no image is uploaded, the main landing page hero image will be used as fallback
              </p>
            </div>

            {formData.rsvp_enabled && (
              <>
                <div className={styles.formField}>
                  <Label htmlFor="max_guests">Max Guests Per Reservation</Label>
                  <Input
                    id="max_guests"
                    type="number"
                    value={formData.max_guests}
                    onChange={(e) => setFormData({ ...formData, max_guests: parseInt(e.target.value) || 10 })}
                    placeholder="e.g., 10"
                    min={1}
                  />
                  <p className={styles.helpText}>Maximum party size for each individual RSVP (e.g., if set to 10, one person can RSVP for up to 10 guests)</p>
                </div>

                <div className={styles.formField}>
                  <Label htmlFor="total_attendees_maximum">Total Event Capacity</Label>
                  <Input
                    id="total_attendees_maximum"
                    type="number"
                    value={formData.total_attendees_maximum}
                    onChange={(e) => setFormData({ ...formData, total_attendees_maximum: parseInt(e.target.value) || 100 })}
                    placeholder="e.g., 100"
                    min={1}
                  />
                  <p className={styles.helpText}>Maximum total attendees across ALL RSVPs (e.g., if set to 100, RSVPs close once 100 total guests have signed up)</p>
                </div>
              </>
            )}

            <div className={styles.formField}>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Event details..."
                rows={4}
              />
              <p className={styles.helpText}>Additional details about the event (optional)</p>
            </div>

            <div className={styles.checkboxField}>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_member_event"
                  checked={formData.is_member_event}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_member_event: checked as boolean })}
                />
                <Label htmlFor="is_member_event" className="cursor-pointer">Show in Member Portal Calendar</Label>
              </div>
              <p className={styles.helpText}>
                When enabled, NOAA members will see this event in their calendar tab
              </p>
            </div>

            <div className={styles.checkboxField}>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="rsvp_enabled"
                  checked={formData.rsvp_enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, rsvp_enabled: checked as boolean })}
                />
                <Label htmlFor="rsvp_enabled" className="cursor-pointer">Enable RSVP</Label>
              </div>
              <p className={styles.helpText}>
                Generate a public RSVP link for guests to sign up (shows Max Guests and Total Capacity fields)
              </p>
              {formData.rsvp_enabled && editingEvent?.rsvp_url && (
                <div className={styles.rsvpLink}>
                  <p className={styles.rsvpLabel}>RSVP Link:</p>
                  <div className={styles.rsvpLinkContainer}>
                    <span className={styles.rsvpUrl}>/rsvp/{editingEvent.rsvp_url}</span>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        const url = `${window.location.origin}/rsvp/${editingEvent.rsvp_url}`;
                        navigator.clipboard.writeText(url);
                        toast({
                          title: 'Copied!',
                          description: 'RSVP link copied to clipboard',
                        });
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              )}
              {formData.rsvp_enabled && !editingEvent?.rsvp_url && (
                <p className={styles.helpText}>
                  RSVP link will be generated when you {editingEvent ? 'update' : 'create'} the event
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseModal}>
                Cancel
              </Button>
              <Button type="submit">
                {editingEvent ? 'Update Event' : 'Create Event'}
              </Button>
            </DialogFooter>

            {editingEvent && formData.rsvp_enabled && (
              <div className={styles.guestList}>
                <h3 className={styles.guestListTitle}>
                  RSVP Guest List ({linkedReservations.length})
                </h3>
                {linkedReservations.length === 0 ? (
                  <p className={styles.noGuests}>No RSVPs yet</p>
                ) : (
                  <div className={styles.tableContainer}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Guest</th>
                          <th>Email</th>
                          <th>Phone</th>
                          <th className={styles.alignRight}>Party Size</th>
                        </tr>
                      </thead>
                      <tbody>
                        {linkedReservations.map(reservation => (
                          <tr key={reservation.id}>
                            <td>{reservation.first_name} {reservation.last_name}</td>
                            <td>{reservation.email}</td>
                            <td>{reservation.phone}</td>
                            <td className={styles.alignRight}>{reservation.party_size}</td>
                          </tr>
                        ))}
                        <tr className={styles.totalRow}>
                          <td colSpan={3} className={styles.totalLabel}>Total Guests</td>
                          <td className={styles.alignRight}>
                            {linkedReservations.reduce((sum, r) => sum + (r.party_size || 0), 0)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
