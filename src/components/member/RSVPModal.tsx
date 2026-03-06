"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useMemberAuth } from '@/context/MemberAuthContext';

interface RSVPModalProps {
  isOpen: boolean;
  onClose: () => void;
  rsvpUrl: string;
}

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
  background_image_url: string | null;
  require_time_selection: boolean;
}

interface RSVPForm {
  party_size: number;
  time_selected: string;
  special_requests: string;
}

export default function RSVPModal({ isOpen, onClose, rsvpUrl }: RSVPModalProps) {
  const { member } = useMemberAuth();
  const [event, setEvent] = useState<PrivateEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [remainingSpots, setRemainingSpots] = useState<number | null>(null);

  const [formData, setFormData] = useState<RSVPForm>({
    party_size: 1,
    time_selected: '',
    special_requests: ''
  });

  useEffect(() => {
    if (isOpen && rsvpUrl) {
      fetchEvent();
    }
  }, [isOpen, rsvpUrl]);

  const fetchEvent = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/rsvp/${rsvpUrl}`);
      if (!response.ok) {
        throw new Error('Event not found');
      }
      const eventData = await response.json();
      setEvent(eventData);

      // Fetch current attendee count
      if (eventData.id) {
        const attendeeResponse = await fetch(`/api/rsvp/attendee-count?event_id=${eventData.id}`);
        if (attendeeResponse.ok) {
          const { currentAttendees } = await attendeeResponse.json();
          setRemainingSpots(eventData.total_attendees_maximum - currentAttendees);
        }
      }
    } catch (error) {
      console.error('Error fetching event:', error);
      setError('This RSVP link is invalid or the event has been cancelled.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (!member) {
      setError('You must be logged in to RSVP');
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/rsvp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          private_event_id: event?.id,
          first_name: member.first_name,
          last_name: member.last_name,
          email: member.email,
          phone: member.phone,
          ...formData
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit RSVP');
      }

      setSuccess(true);

      // Reset form after 2 seconds and close modal
      setTimeout(() => {
        setSuccess(false);
        setFormData({
          party_size: 1,
          time_selected: '',
          special_requests: ''
        });
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Error submitting RSVP:', error);
      setError(error instanceof Error ? error.message : 'Failed to submit RSVP');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDateTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-[#1F1F1F]">
            {loading ? 'Loading Event...' : event?.title || 'RSVP'}
          </DialogTitle>
          {event && (
            <DialogDescription className="text-xs text-[#5A5A5A]">
              {formatDateTime(event.start_time)}
            </DialogDescription>
          )}
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Spinner className="text-[#A59480] mb-4" />
            <p className="text-[#5A5A5A]">Loading event details...</p>
          </div>
        ) : error || !event ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error || 'This RSVP link is invalid or the event has been cancelled.'}
            </AlertDescription>
          </Alert>
        ) : success ? (
          <div className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="h-16 w-16 text-[#4CAF50] mb-4" />
            <h3 className="text-xl font-semibold text-[#1F1F1F] mb-2">RSVP Confirmed!</h3>
            <p className="text-[#5A5A5A]">We look forward to seeing you at the event.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Event Details */}
            <div className="bg-[#F6F5F2] rounded-lg p-4">
              <p className="text-sm text-[#5A5A5A] mb-3">{event.event_description}</p>
              <div className="flex items-center gap-4 text-xs text-[#8C7C6D]">
                <span>Max {event.max_guests} guests per RSVP</span>
                <span>•</span>
                <span>Capacity: {event.total_attendees_maximum}</span>
                {remainingSpots !== null && (
                  <>
                    <span>•</span>
                    <span className="font-semibold text-[#A59480]">
                      {remainingSpots} spots remaining
                    </span>
                  </>
                )}
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Form Fields */}
            <div>
              <Label htmlFor="party_size" className="text-xs">Party Size *</Label>
              <Input
                id="party_size"
                type="number"
                min={1}
                max={event.max_guests}
                value={formData.party_size}
                onChange={(e) => setFormData({ ...formData, party_size: parseInt(e.target.value) })}
                required
                disabled={submitting}
                className="h-8 text-sm"
              />
            </div>

            <div>
              <Label htmlFor="special_requests" className="text-xs">Special Requests (Optional)</Label>
              <Textarea
                id="special_requests"
                value={formData.special_requests}
                onChange={(e) => setFormData({ ...formData, special_requests: e.target.value })}
                rows={2}
                disabled={submitting}
                className="text-sm"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 h-9 text-sm"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="flex-1 h-9 text-sm bg-[#A59480] text-white hover:bg-[#8C7C6D]"
              >
                {submitting ? 'Submitting...' : 'Submit RSVP'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
