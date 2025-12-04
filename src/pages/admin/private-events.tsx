import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { utcToLocalInput, localInputToUTC, formatDateTime } from '../../utils/dateUtils';
import AdminLayout from '../../components/layouts/AdminLayout';
import styles from '../../styles/PrivateEvents.module.css';

interface PrivateEvent {
  id: string;
  title: string;
  event_type: string;
  start_time: string;
  end_time: string;
  max_guests: number;
  total_attendees_maximum: number;
  deposit_required: number;
  event_description: string;
  rsvp_enabled: boolean;
  rsvp_url: string | null;
  background_image_url: string | null;
  require_time_selection: boolean;
  status: 'active' | 'cancelled' | 'completed';
  created_at: string;
  created_by: string | null;
  full_day: boolean;
}

const EVENT_TYPES = [
  'Birthday', 'Anniversary', 'Corporate Event', 'Wedding Reception',
  'Graduation', 'Holiday Party', 'Party', 'Wind Down Party',
  'After Party', 'Rehearsal Dinner', 'Noir Member Event', 'Other'
];

const VENUE_TIMEZONE = 'America/Chicago';

export default function PrivateEvents() {
  const [events, setEvents] = useState<PrivateEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    event_type: 'Birthday',
    start_time: '',
    end_time: '',
    max_guests: 10,
    deposit_required: 0,
    event_description: '',
    rsvp_enabled: false,
    require_time_selection: false,
    total_attendees_maximum: 500,
    full_day: true
  });

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
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
      showMessage('error', 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(file);
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
      showMessage('error', 'Failed to upload image');
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (!formData.title || !formData.start_time || !formData.end_time) {
        showMessage('error', 'Please fill in all required fields');
        setSaving(false);
        return;
      }

      const startTimeUTC = localInputToUTC(formData.start_time, VENUE_TIMEZONE);
      const endTimeUTC = localInputToUTC(formData.end_time, VENUE_TIMEZONE);

      const eventData = {
        title: formData.title,
        event_type: formData.event_type,
        start_time: startTimeUTC,
        end_time: endTimeUTC,
        max_guests: formData.max_guests,
        total_attendees_maximum: formData.total_attendees_maximum,
        deposit_required: formData.deposit_required,
        event_description: formData.event_description,
        rsvp_enabled: formData.rsvp_enabled,
        require_time_selection: formData.require_time_selection,
        full_day: formData.full_day,
        status: 'active' as const,
        created_by: (await supabase.auth.getUser()).data.user?.id
      };

      let eventId: string;

      if (editingId) {
        const { data: event, error: updateError } = await supabase
          .from('private_events')
          .update(eventData)
          .eq('id', editingId)
          .select()
          .single();

        if (updateError) throw updateError;
        eventId = event.id;
      } else {
        const { data: event, error: insertError } = await supabase
          .from('private_events')
          .insert(eventData)
          .select()
          .single();

        if (insertError) throw insertError;
        eventId = event.id;
      }

      if (imageFile && eventId) {
        const imageUrl = await uploadImage(eventId);
        if (imageUrl) {
          await supabase
            .from('private_events')
            .update({ background_image_url: imageUrl })
            .eq('id', eventId);
        }
      }

      showMessage('success', editingId ? 'Event updated successfully' : 'Event created successfully');
      resetForm();
      fetchEvents();
    } catch (error) {
      console.error('Error saving event:', error);
      showMessage('error', 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (event: PrivateEvent) => {
    setEditingId(event.id);
    setFormData({
      title: event.title,
      event_type: event.event_type,
      start_time: utcToLocalInput(event.start_time, VENUE_TIMEZONE),
      end_time: utcToLocalInput(event.end_time, VENUE_TIMEZONE),
      max_guests: event.max_guests,
      total_attendees_maximum: event.total_attendees_maximum,
      deposit_required: event.deposit_required,
      event_description: event.event_description || '',
      rsvp_enabled: event.rsvp_enabled,
      require_time_selection: event.require_time_selection,
      full_day: event.full_day
    });
    setImagePreview(event.background_image_url);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      const { error } = await supabase
        .from('private_events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;
      showMessage('success', 'Event deleted successfully');
      fetchEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
      showMessage('error', 'Failed to delete event');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      event_type: 'Birthday',
      start_time: '',
      end_time: '',
      max_guests: 10,
      deposit_required: 0,
      event_description: '',
      rsvp_enabled: false,
      require_time_selection: false,
      total_attendees_maximum: 500,
      full_day: true
    });
    setEditingId(null);
    setImageFile(null);
    setImagePreview(null);
    setShowForm(false);
  };

  const formatDate = (dateTime: string) => formatDateTime(dateTime, VENUE_TIMEZONE, 'MMM dd, yyyy');
  const formatTime = (dateTime: string) => formatDateTime(dateTime, VENUE_TIMEZONE, 'HH:mm');

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'active': return styles.badgeGreen;
      case 'cancelled': return styles.badgeRed;
      case 'completed': return styles.badgeBlue;
      default: return styles.badgeGreen;
    }
  };

  return (
    <AdminLayout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Private Events</h1>
          <button
            className={styles.createButton}
            onClick={() => setShowForm(!showForm)}
          >
            <span>{showForm ? '−' : '+'}</span>
            {showForm ? 'Cancel' : 'Create Event'}
          </button>
        </div>

        {message && (
          <div className={`${styles.message} ${message.type === 'success' ? styles.success : styles.error}`}>
            {message.text}
          </div>
        )}

        {showForm && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>{editingId ? 'Edit Event' : 'Create New Event'}</h2>
            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={`${styles.label} ${styles.required}`}>Event Title</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="Enter event title"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={`${styles.label} ${styles.required}`}>Event Type</label>
                  <select
                    className={styles.select}
                    value={formData.event_type}
                    onChange={(e) => handleInputChange('event_type', e.target.value)}
                  >
                    {EVENT_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={`${styles.label} ${styles.required}`}>Start Date & Time</label>
                  <input
                    type="datetime-local"
                    className={styles.input}
                    value={formData.start_time}
                    onChange={(e) => handleInputChange('start_time', e.target.value)}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={`${styles.label} ${styles.required}`}>End Date & Time</label>
                  <input
                    type="datetime-local"
                    className={styles.input}
                    value={formData.end_time}
                    onChange={(e) => handleInputChange('end_time', e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Max Guests per Reservation</label>
                  <div className={styles.numberInput}>
                    <button
                      type="button"
                      className={styles.numberButton}
                      onClick={() => handleInputChange('max_guests', Math.max(1, formData.max_guests - 1))}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      className={styles.numberInputField}
                      value={formData.max_guests}
                      onChange={(e) => handleInputChange('max_guests', parseInt(e.target.value) || 1)}
                      min="1"
                      max="100"
                    />
                    <button
                      type="button"
                      className={styles.numberButton}
                      onClick={() => handleInputChange('max_guests', Math.min(100, formData.max_guests + 1))}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Total Max Attendees</label>
                  <div className={styles.numberInput}>
                    <button
                      type="button"
                      className={styles.numberButton}
                      onClick={() => handleInputChange('total_attendees_maximum', Math.max(1, formData.total_attendees_maximum - 10))}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      className={styles.numberInputField}
                      value={formData.total_attendees_maximum}
                      onChange={(e) => handleInputChange('total_attendees_maximum', parseInt(e.target.value) || 1)}
                      min="1"
                      max="1000"
                    />
                    <button
                      type="button"
                      className={styles.numberButton}
                      onClick={() => handleInputChange('total_attendees_maximum', Math.min(1000, formData.total_attendees_maximum + 10))}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Deposit Required ($)</label>
                  <div className={styles.numberInput}>
                    <button
                      type="button"
                      className={styles.numberButton}
                      onClick={() => handleInputChange('deposit_required', Math.max(0, formData.deposit_required - 50))}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      className={styles.numberInputField}
                      value={formData.deposit_required}
                      onChange={(e) => handleInputChange('deposit_required', parseFloat(e.target.value) || 0)}
                      min="0"
                      max="10000"
                      step="0.01"
                    />
                    <button
                      type="button"
                      className={styles.numberButton}
                      onClick={() => handleInputChange('deposit_required', Math.min(10000, formData.deposit_required + 50))}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Event Description</label>
                <textarea
                  className={styles.textarea}
                  value={formData.event_description}
                  onChange={(e) => handleInputChange('event_description', e.target.value)}
                  placeholder="Enter event description..."
                />
              </div>

              <div className={styles.checkboxGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={formData.rsvp_enabled}
                    onChange={(e) => handleInputChange('rsvp_enabled', e.target.checked)}
                  />
                  Enable RSVP
                </label>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={formData.require_time_selection}
                    onChange={(e) => handleInputChange('require_time_selection', e.target.checked)}
                  />
                  Require Time Selection
                </label>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={formData.full_day}
                    onChange={(e) => handleInputChange('full_day', e.target.checked)}
                  />
                  Full Day Event
                </label>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Background Image</label>
                <input
                  type="file"
                  className={`${styles.input} ${styles.fileInput}`}
                  accept="image/*"
                  onChange={handleImageChange}
                />
                {imagePreview && (
                  <img src={imagePreview} alt="Preview" className={styles.imagePreview} />
                )}
              </div>

              <div className={styles.formActions}>
                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : editingId ? 'Update Event' : 'Create Event'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    className={styles.cancelButton}
                    onClick={resetForm}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>All Events</h2>
          {loading ? (
            <div className={styles.loadingContainer}>
              <div className={styles.spinner}></div>
              <p className={styles.loadingText}>Loading events...</p>
            </div>
          ) : events.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No events found. Create your first event above.</p>
            </div>
          ) : (
            <div className={styles.eventsList}>
              {events.map((event) => (
                <div key={event.id} className={styles.eventCard}>
                  <div className={styles.eventHeader}>
                    <div className={styles.eventInfo}>
                      <h3 className={styles.eventTitle}>{event.title}</h3>
                      <div className={styles.eventType}>{event.event_type}</div>
                      {event.event_description && (
                        <p className={styles.eventDescription}>{event.event_description}</p>
                      )}
                    </div>
                    <div className={styles.eventActions}>
                      <button
                        className={`${styles.iconButton} ${styles.editButton}`}
                        onClick={() => handleEdit(event)}
                        title="Edit event"
                      >
                        ✎
                      </button>
                      <button
                        className={`${styles.iconButton} ${styles.deleteButton}`}
                        onClick={() => handleDelete(event.id)}
                        title="Delete event"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <div className={styles.eventDetails}>
                    <div className={styles.eventDetail}>
                      <span className={styles.detailLabel}>Date</span>
                      <span className={styles.detailValue}>{formatDate(event.start_time)}</span>
                    </div>
                    <div className={styles.eventDetail}>
                      <span className={styles.detailLabel}>Time</span>
                      <span className={styles.detailValue}>
                        {formatTime(event.start_time)} - {formatTime(event.end_time)}
                      </span>
                    </div>
                    <div className={styles.eventDetail}>
                      <span className={styles.detailLabel}>Guests per Reservation</span>
                      <span className={styles.detailValue}>{event.max_guests}</span>
                    </div>
                    <div className={styles.eventDetail}>
                      <span className={styles.detailLabel}>Total Max Attendees</span>
                      <span className={styles.detailValue}>{event.total_attendees_maximum}</span>
                    </div>
                  </div>

                  <div className={styles.eventFooter}>
                    <span className={`${styles.badge} ${getStatusClass(event.status)}`}>
                      {event.status}
                    </span>
                    {event.deposit_required > 0 && (
                      <span className={styles.detailValue}>
                        Deposit: ${event.deposit_required.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
