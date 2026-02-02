import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../components/layouts/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/useToast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Download, Edit, Trash2, Calendar as CalendarIcon, CalendarDays, Sparkles, BarChart3, Settings, CalendarCheck, Users } from 'lucide-react';
import { supabase, supabaseAdmin } from '../../lib/supabase';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, parseISO, isToday, startOfYear, endOfYear } from 'date-fns';
import { localInputToUTC } from '../../utils/dateUtils';
import { useSettings } from '../../context/SettingsContext';

interface PrivateEvent {
  id: string;
  name?: string;
  title?: string;
  start_time: string;
  end_time: string;
  description?: string;
  guest_count?: number;
  source?: 'minaka' | 'local';
  client_name?: string;
  client_email?: string;
  location?: string;
  minaka_url?: string;
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

interface CustomDay {
  id: string;
  date: string;
  type: 'exceptional_open' | 'exceptional_closure';
}

interface DayData {
  date: Date;
  privateEvents: PrivateEvent[];
  reservations: Reservation[];
  isOpen: boolean;
  isCurrentMonth: boolean;
  covers: number;
  revenue: number;
}

export default function EventCalendarV2() {
  const { settings } = useSettings();
  const timezone = settings?.timezone || 'America/Chicago';
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PrivateEvent | null>(null);
  const [eventFormData, setEventFormData] = useState({
    title: '',
    start_time: '',
    end_time: '',
    description: '',
    guest_count: '',
    client_name: '',
    client_email: '',
    location: '',
  });
  const [monthStats, setMonthStats] = useState({
    totalReservations: 0,
    totalCovers: 0,
    totalRevenue: 0,
    privateEvents: 0,
  });

  const { toast } = useToast();

  // Fetch calendar data
  const fetchCalendarData = useCallback(async () => {
    setLoading(true);
    try {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calendarStart = startOfWeek(monthStart);
      const calendarEnd = endOfWeek(monthEnd);

      // Fetch private events
      const { data: privateEvents } = await supabase
        .from('private_events')
        .select('*')
        .gte('start_time', calendarStart.toISOString())
        .lte('start_time', calendarEnd.toISOString());

      // Fetch Minaka events
      let minakaEvents: PrivateEvent[] = [];
      try {
        const minakaResponse = await fetch('/api/minaka-events');
        if (minakaResponse.ok) {
          const minakaData = await minakaResponse.json();
          minakaEvents = (minakaData.data || []).filter((e: PrivateEvent) => {
            const eventDate = parseISO(e.start_time);
            return eventDate >= calendarStart && eventDate <= calendarEnd;
          }).map((e: PrivateEvent) => ({
            ...e,
            source: 'minaka' as const,
          }));
        }
      } catch (error) {
        console.error('Error fetching Minaka events:', error);
      }

      const allEvents = [
        ...(privateEvents || []).map((e: any) => ({ ...e, source: 'local' as const })),
        ...minakaEvents,
      ];

      // Fetch reservations
      const client = supabaseAdmin || supabase;
      const { data: reservations } = await client
        .from('reservations')
        .select('*')
        .gte('start_time', calendarStart.toISOString())
        .lte('start_time', calendarEnd.toISOString());

      // Build calendar days
      const days: DayData[] = [];
      let currentDay = calendarStart;
      let stats = {
        totalReservations: 0,
        totalCovers: 0,
        totalRevenue: 0,
        privateEvents: 0,
      };

      while (currentDay <= calendarEnd) {
        const dayEvents = allEvents.filter(e =>
          isSameDay(parseISO(e.start_time), currentDay)
        );
        const dayReservations = (reservations || []).filter(r =>
          isSameDay(parseISO(r.start_time), currentDay)
        );

        // Default venue schedule: Wed-Sat (days 3-6)
        const dayOfWeek = currentDay.getDay();
        const isOpen = dayOfWeek >= 3 && dayOfWeek <= 6;

        const covers = dayReservations.reduce((sum, r) => sum + (r.party_size || 0), 0);
        const revenue = covers * 100; // Simplified revenue calc

        if (isSameMonth(currentDay, currentDate)) {
          stats.totalReservations += dayReservations.length;
          stats.totalCovers += covers;
          stats.totalRevenue += revenue;
          stats.privateEvents += dayEvents.length;
        }

        days.push({
          date: new Date(currentDay),
          privateEvents: dayEvents,
          reservations: dayReservations,
          isOpen,
          isCurrentMonth: isSameMonth(currentDay, currentDate),
          covers,
          revenue,
        });

        currentDay = addDays(currentDay, 1);
      }

      setCalendarDays(days);
      setMonthStats(stats);
    } catch (error) {
      console.error('Error fetching calendar data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load calendar data',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  }, [currentDate, toast]);

  useEffect(() => {
    fetchCalendarData();
  }, [fetchCalendarData]);

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const handleToday = () => setCurrentDate(new Date());

  const handleDayClick = (day: DayData) => {
    setSelectedDay(day);
    setIsDayModalOpen(true);
  };

  const handleExportForMembers = async () => {
    try {
      const yearStart = startOfYear(currentDate);
      const yearEnd = endOfYear(currentDate);

      const { data: events } = await supabase
        .from('private_events')
        .select('*')
        .gte('start_time', yearStart.toISOString())
        .lte('start_time', yearEnd.toISOString())
        .order('start_time');

      const icsEvents = (events || []).map((event: PrivateEvent) => {
        const start = parseISO(event.start_time);
        const end = parseISO(event.end_time);
        const title = event.title || event.name || 'Private Event';

        return [
          'BEGIN:VEVENT',
          `DTSTART:${format(start, "yyyyMMdd'T'HHmmss")}`,
          `DTEND:${format(end, "yyyyMMdd'T'HHmmss")}`,
          `SUMMARY:${title}`,
          `DESCRIPTION:${event.description || 'Private Event - Venue Closed'}`,
          `LOCATION:${event.location || 'Noir'}`,
          'STATUS:CONFIRMED',
          'END:VEVENT',
        ].join('\r\n');
      }).join('\r\n');

      const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Noir//Event Calendar//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        icsEvents,
        'END:VCALENDAR',
      ].join('\r\n');

      const blob = new Blob([icsContent], { type: 'text/calendar' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `noir-private-events-${format(currentDate, 'yyyy')}.ics`;
      link.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Success',
        description: 'Calendar exported successfully',
        status: 'success',
        duration: 3000,
      });
    } catch (error) {
      console.error('Error exporting calendar:', error);
      toast({
        title: 'Error',
        description: 'Failed to export calendar',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleCreateEvent = () => {
    setEditingEvent(null);
    setEventFormData({
      title: '',
      start_time: '',
      end_time: '',
      description: '',
      guest_count: '',
      client_name: '',
      client_email: '',
      location: '',
    });
    setIsEventModalOpen(true);
  };

  const handleEditEvent = (event: PrivateEvent) => {
    setEditingEvent(event);
    setEventFormData({
      title: event.title || event.name || '',
      start_time: event.start_time,
      end_time: event.end_time,
      description: event.description || '',
      guest_count: event.guest_count?.toString() || '',
      client_name: event.client_name || '',
      client_email: event.client_email || '',
      location: event.location || '',
    });
    setIsEventModalOpen(true);
  };

  const handleSaveEvent = async () => {
    try {
      const eventData = {
        title: eventFormData.title,
        start_time: localInputToUTC(eventFormData.start_time, timezone),
        end_time: localInputToUTC(eventFormData.end_time, timezone),
        description: eventFormData.description,
        guest_count: eventFormData.guest_count ? parseInt(eventFormData.guest_count) : null,
        client_name: eventFormData.client_name,
        client_email: eventFormData.client_email,
        location: eventFormData.location,
      };

      if (editingEvent) {
        const { error } = await supabase
          .from('private_events')
          .update(eventData)
          .eq('id', editingEvent.id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Event updated successfully',
          status: 'success',
          duration: 3000,
        });
      } else {
        const { error } = await supabase
          .from('private_events')
          .insert([eventData]);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Event created successfully',
          status: 'success',
          duration: 3000,
        });
      }

      setIsEventModalOpen(false);
      fetchCalendarData();
    } catch (error) {
      console.error('Error saving event:', error);
      toast({
        title: 'Error',
        description: 'Failed to save event',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      const { error } = await supabase
        .from('private_events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Event deleted successfully',
        status: 'success',
        duration: 3000,
      });

      fetchCalendarData();
    } catch (error) {
      console.error('Error deleting event:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete event',
        status: 'error',
        duration: 3000,
      });
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-screen">
          <Spinner size="xl" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'IvyJournal, serif' }}>
            Event Calendar
          </h1>
          <Button
            onClick={handleExportForMembers}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export for Members
          </Button>
        </div>

        <Tabs defaultValue="calendar" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="calendar" className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="events" className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Private Events
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Calendar Tab */}
          <TabsContent value="calendar">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-2xl">
                    {format(currentDate, 'MMMM yyyy')}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button onClick={handleToday} variant="outline" size="sm">
                      Today
                    </Button>
                    <Button onClick={handlePrevMonth} variant="outline" size="sm">
                      <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <Button onClick={handleNextMonth} variant="outline" size="sm">
                      <ChevronRight className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {/* Day headers */}
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center font-semibold text-sm py-2 text-gray-600">
                      {day}
                    </div>
                  ))}

                  {/* Calendar days */}
                  {calendarDays.map((day, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleDayClick(day)}
                      className={`
                        min-h-[120px] p-2 border rounded cursor-pointer transition-all
                        ${!day.isCurrentMonth ? 'bg-gray-50 text-gray-400' : 'bg-white'}
                        ${isToday(day.date) ? 'ring-2 ring-cork' : ''}
                        ${!day.isOpen ? 'bg-gray-100' : ''}
                        hover:shadow-md hover:scale-[1.02]
                      `}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className={`text-sm font-semibold ${isToday(day.date) ? 'text-cork' : ''}`}>
                          {format(day.date, 'd')}
                        </span>
                        {!day.isOpen && (
                          <Badge variant="error" className="text-xs">Closed</Badge>
                        )}
                      </div>

                      {day.privateEvents.length > 0 && (
                        <div className="mb-1">
                          <Badge variant="default" className="text-xs flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            {day.privateEvents.length} event{day.privateEvents.length > 1 ? 's' : ''}
                          </Badge>
                        </div>
                      )}

                      {day.reservations.length > 0 && (
                        <div className="text-xs text-gray-600 space-y-0.5">
                          <div className="flex items-center gap-1">
                            <CalendarCheck className="w-3 h-3" />
                            {day.reservations.length} res
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {day.covers} covers
                          </div>
                          <div className="text-cork font-semibold">${day.revenue}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Private Events Tab */}
          <TabsContent value="events">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Private Events</CardTitle>
                  <Button onClick={handleCreateEvent} className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4" />
                    Create Event
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <PrivateEventsList
                  onEdit={handleEditEvent}
                  onDelete={handleDeleteEvent}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    Total Reservations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{monthStats.totalReservations}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    Total Covers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{monthStats.totalCovers}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    Estimated Revenue
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-cork">
                    ${monthStats.totalRevenue.toLocaleString()}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    Private Events
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{monthStats.privateEvents}</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Calendar Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Settings and configuration options will be available here.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Day Details Modal */}
        <Dialog open={isDayModalOpen} onOpenChange={setIsDayModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedDay && format(selectedDay.date, 'EEEE, MMMM d, yyyy')}
              </DialogTitle>
            </DialogHeader>

            {selectedDay && (
              <div className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Covers</div>
                    <div className="text-lg font-semibold">{selectedDay.covers}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Revenue</div>
                    <div className="text-lg font-semibold text-cork">${selectedDay.revenue}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Status</div>
                    <Badge variant={selectedDay.isOpen ? 'success' : 'error'}>
                      {selectedDay.isOpen ? 'Open' : 'Closed'}
                    </Badge>
                  </div>
                </div>

                {/* Private Events */}
                {selectedDay.privateEvents.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">Private Events</h3>
                    <div className="space-y-2">
                      {selectedDay.privateEvents.map(event => (
                        <div key={event.id} className="p-3 bg-gray-50 rounded border">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">{event.title || event.name}</div>
                              <div className="text-sm text-gray-600">
                                {format(parseISO(event.start_time), 'h:mm a')} - {format(parseISO(event.end_time), 'h:mm a')}
                              </div>
                              {event.guest_count && (
                                <div className="text-sm text-gray-600">👥 {event.guest_count} guests</div>
                              )}
                              {event.source === 'minaka' && (
                                <Badge variant="default" className="mt-1">Minaka</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reservations */}
                {selectedDay.reservations.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">
                      Reservations ({selectedDay.reservations.length})
                    </h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {selectedDay.reservations.map(res => (
                        <div key={res.id} className="p-2 bg-gray-50 rounded border text-sm">
                          <div className="flex justify-between">
                            <span className="font-medium">
                              {res.first_name} {res.last_name}
                            </span>
                            <span className="text-gray-600">
                              Party of {res.party_size || 0}
                            </span>
                          </div>
                          <div className="text-gray-600">
                            {format(parseISO(res.start_time), 'h:mm a')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Event Form Modal */}
        <Dialog open={isEventModalOpen} onOpenChange={setIsEventModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingEvent ? 'Edit Event' : 'Create Event'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Event Title *</label>
                <Input
                  value={eventFormData.title}
                  onChange={(e) => setEventFormData({ ...eventFormData, title: e.target.value })}
                  placeholder="Event name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Start Time *</label>
                  <Input
                    type="datetime-local"
                    value={eventFormData.start_time}
                    onChange={(e) => setEventFormData({ ...eventFormData, start_time: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">End Time *</label>
                  <Input
                    type="datetime-local"
                    value={eventFormData.end_time}
                    onChange={(e) => setEventFormData({ ...eventFormData, end_time: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Description</label>
                <Textarea
                  value={eventFormData.description}
                  onChange={(e) => setEventFormData({ ...eventFormData, description: e.target.value })}
                  placeholder="Event details"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Guest Count</label>
                  <Input
                    type="number"
                    value={eventFormData.guest_count}
                    onChange={(e) => setEventFormData({ ...eventFormData, guest_count: e.target.value })}
                    placeholder="Number of guests"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Location</label>
                  <Input
                    value={eventFormData.location}
                    onChange={(e) => setEventFormData({ ...eventFormData, location: e.target.value })}
                    placeholder="Event location"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Client Name</label>
                  <Input
                    value={eventFormData.client_name}
                    onChange={(e) => setEventFormData({ ...eventFormData, client_name: e.target.value })}
                    placeholder="Contact name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Client Email</label>
                  <Input
                    type="email"
                    value={eventFormData.client_email}
                    onChange={(e) => setEventFormData({ ...eventFormData, client_email: e.target.value })}
                    placeholder="Contact email"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEventModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEvent}>
                {editingEvent ? 'Update Event' : 'Create Event'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

// Private Events List Component
function PrivateEventsList({
  onEdit,
  onDelete
}: {
  onEdit: (event: PrivateEvent) => void;
  onDelete: (eventId: string) => void;
}) {
  const [events, setEvents] = useState<PrivateEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('private_events')
        .select('*')
        .order('start_time', { ascending: true });

      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size="lg" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-2">🎉</div>
        <div className="text-lg font-semibold text-gray-700 mb-2">No Private Events</div>
        <div className="text-gray-500">Create your first private event to get started</div>
      </div>
    );
  }

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
    <div
      key={event.id}
      className={`p-4 border rounded-lg ${isPast ? 'opacity-60 bg-gray-50' : 'bg-white'}`}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="text-lg font-semibold mb-2">
            {event.title || event.name || 'Untitled Event'}
          </h3>
          <div className="flex flex-wrap gap-2 mb-2">
            <Badge variant={isPast ? 'secondary' : 'default'}>
              📅 {format(parseISO(event.start_time), 'MMM d, yyyy')}
            </Badge>
            <Badge variant={isPast ? 'secondary' : 'default'}>
              🕐 {format(parseISO(event.start_time), 'h:mm a')} - {format(parseISO(event.end_time), 'h:mm a')}
            </Badge>
            {event.guest_count && (
              <Badge variant={isPast ? 'secondary' : 'success'}>
                👥 {event.guest_count} guests
              </Badge>
            )}
          </div>
          {event.description && (
            <p className="text-sm text-gray-600 mb-2">{event.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(event)}
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(event.id)}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {futureEvents.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Upcoming Events</h3>
          <div className="space-y-3">
            {futureEvents.map(event => renderEvent(event, false))}
          </div>
        </div>
      )}

      {pastEvents.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 text-gray-600">Past Events</h3>
          <div className="space-y-3">
            {pastEvents.map(event => renderEvent(event, true))}
          </div>
        </div>
      )}
    </div>
  );
}
