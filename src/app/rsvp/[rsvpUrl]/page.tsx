'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/useToast';
import { AlertCircle } from 'lucide-react';

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
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  party_size: number;
  time_selected: string;
  special_requests: string;
}

export default function RSVPPage({ params }: { params: Promise<{ rsvpUrl: string }> }) {
  const [event, setEvent] = useState<PrivateEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rsvpUrl, setRsvpUrl] = useState<string>('');
  const [remainingSpots, setRemainingSpots] = useState<number | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState<RSVPForm>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    party_size: 1,
    time_selected: '',
    special_requests: ''
  });

  useEffect(() => {
    const initPage = async () => {
      const resolvedParams = await params;
      setRsvpUrl(resolvedParams.rsvpUrl);
      await fetchEvent(resolvedParams.rsvpUrl);
    };

    initPage();
  }, [params]);

  const fetchEvent = async (url: string) => {
    try {
      const response = await fetch(`/api/rsvp/${url}`);
      if (!response.ok) {
        throw new Error('Event not found');
      }
      const eventData = await response.json();
      console.log('Event data:', eventData);
      console.log('Background image URL:', eventData.background_image_url);
      setEvent(eventData);

      // Fetch current attendee count to calculate remaining spots
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

  const generateTimeOptions = (): { value: string; label: string }[] => {
    if (!event) return [];

    const startTime = new Date(event!.start_time);
    const endTime = new Date(event!.end_time);
    const options: { value: string; label: string }[] = [];

    let currentTime = new Date(startTime);
    while (currentTime <= endTime) {
      options.push({
        value: currentTime.toISOString(),
        label: currentTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })
      });
      currentTime.setMinutes(currentTime.getMinutes() + 15);
    }

    return options;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/rsvp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          private_event_id: event?.id,
          ...formData
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit RSVP');
      }

      setIsSuccessModalOpen(true);
    } catch (error) {
      console.error('Error submitting RSVP:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to submit RSVP',
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof RSVPForm, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Spinner className="h-12 w-12" />
          <p className="text-gray-600">Loading event details...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Alert variant="error" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Event Not Found</AlertTitle>
          <AlertDescription>
            {error || 'This RSVP link is invalid or the event has been cancelled.'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const timeOptions = generateTimeOptions();

  // Fallback to main hero image if event doesn't have custom image
  const FALLBACK_HERO_IMAGE = '/images/002-20250911-noir-fall-25-©LoveProjectPhotography.jpg';
  const backgroundImage = event.background_image_url || FALLBACK_HERO_IMAGE;
  const hasBackgroundImage = Boolean(event.background_image_url || FALLBACK_HERO_IMAGE);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Image or Gradient */}
      {hasBackgroundImage ? (
        <>
          <div className="absolute inset-0 z-0">
            <img
              src={backgroundImage}
              alt="Event background"
              className="w-full h-full object-cover"
              onLoad={() => console.log('Image loaded successfully:', backgroundImage)}
              onError={(e) => {
                console.error('Image failed to load:', backgroundImage);
                // Hide image and show gradient fallback instead
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
          <div className="absolute inset-0 z-[1] bg-gradient-to-b from-black/60 to-black/70" />
        </>
      ) : (
        // Gradient fallback if no images available
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900" />
      )}

      <div className="relative z-10 container max-w-md mx-auto py-8 px-4">
        <div className="flex flex-col gap-8">
          {/* Event Header - Always white text since we always have background */}
          <div className="text-center text-white">
            <h1 className="text-3xl font-bold mb-2">
              {event.title}
            </h1>
            <p className="text-lg mb-4">
              {event.event_type}
            </p>
            <p className="text-base mb-2">
              {formatDateTime(event.start_time)}
            </p>
            <p className="text-sm opacity-80">
              {event.max_guests} guests maximum per reservation
              {event.deposit_required > 0 && ` • $${event.deposit_required} deposit required`}
            </p>
            <p className="text-sm opacity-80 mt-1">
              Total Event Capacity: {event.total_attendees_maximum} guests
              {remainingSpots !== null && (
                <span className={remainingSpots <= 5 ? 'text-red-400' : 'text-green-400'}>
                  {' '}• {remainingSpots} spots remaining
                </span>
              )}
            </p>
            {event.event_description && (
              <p className="text-sm mt-4 opacity-90">
                {event.event_description}
              </p>
            )}
          </div>

          {/* RSVP Form */}
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <form onSubmit={handleSubmit}>
              <div className="flex flex-col gap-4">
                <h2 className="text-xl font-semibold mb-4">RSVP Form</h2>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name *</Label>
                    <Input
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => handleInputChange('first_name', e.target.value)}
                      placeholder="First name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name *</Label>
                    <Input
                      id="last_name"
                      value={formData.last_name}
                      onChange={(e) => handleInputChange('last_name', e.target.value)}
                      placeholder="Last name"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="your@email.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="(555) 123-4567"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="party_size">Party Size *</Label>
                  <Select
                    id="party_size"
                    value={formData.party_size.toString()}
                    onChange={(e) => handleInputChange('party_size', parseInt(e.target.value))}
                    required
                  >
                    {Array.from({ length: Math.min(event.max_guests, remainingSpots || event.max_guests) }, (_, i) => i + 1).map(num => (
                      <option key={num} value={num.toString()}>
                        {num} {num === 1 ? 'guest' : 'guests'}
                      </option>
                    ))}
                  </Select>
                  {remainingSpots !== null && remainingSpots < event.max_guests && (
                    <p className="text-xs text-red-500">
                      Limited by remaining spots ({remainingSpots} available)
                    </p>
                  )}
                </div>

                {event.require_time_selection && (
                  <div className="space-y-2">
                    <Label htmlFor="time_selected">Preferred Time *</Label>
                    <Select
                      id="time_selected"
                      value={formData.time_selected}
                      onChange={(e) => handleInputChange('time_selected', e.target.value)}
                      required
                    >
                      <option value="">Select a time</option>
                      {timeOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="special_requests">Special Requests</Label>
                  <Textarea
                    id="special_requests"
                    value={formData.special_requests}
                    onChange={(e) => handleInputChange('special_requests', e.target.value)}
                    placeholder="Any special requests or dietary restrictions..."
                    rows={3}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-[#a59480] hover:bg-[#8c7a5a] text-white"
                  size="lg"
                  disabled={submitting}
                >
                  {submitting ? 'Submitting RSVP...' : 'Submit RSVP'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      <Dialog open={isSuccessModalOpen} onOpenChange={setIsSuccessModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>RSVP Confirmed!</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 text-center py-4">
            <DialogDescription className="text-lg">
              Thank you for your RSVP!
            </DialogDescription>
            <p className="text-sm text-gray-600">
              We've sent a confirmation message to your phone number.
              Please respond directly to that message if you need to make any changes.
            </p>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => setIsSuccessModalOpen(false)}
              className="bg-[#a59480] hover:bg-[#8c7a5a] text-white"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
