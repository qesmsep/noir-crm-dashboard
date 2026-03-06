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
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Calendar, Clock, MapPin, Users, ChevronLeft, ChevronRight, Plus } from 'lucide-react';

interface UpcomingEventsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMakeReservation?: () => void;
}

interface Event {
  id: string;
  title: string;
  date: Date;
  time: string;
  location: string;
  type: 'reservation' | 'event' | 'special';
  status?: string;
  partySize?: number;
  description?: string;
}

export default function UpcomingEventsModal({ isOpen, onClose, onMakeReservation }: UpcomingEventsModalProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchEvents();
    }
  }, [isOpen, currentMonth]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      // Fetch reservations
      const reservationsResponse = await fetch('/api/member/reservations', {
        credentials: 'include',
      });

      // Fetch member events
      const memberEventsResponse = await fetch('/api/noir-member-events', {
        credentials: 'include',
      });

      const allEvents: Event[] = [];

      // Process reservations
      if (reservationsResponse.ok) {
        const data = await reservationsResponse.json();
        const reservations = data.reservations || [];

        const formattedReservations = reservations.map((res: any) => ({
          id: res.id,
          title: `Reservation - Party of ${res.party_size}`,
          date: new Date(res.start_time),
          time: new Date(res.start_time).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          }),
          location: 'Main Dining Room',
          type: 'reservation' as const,
          status: res.status,
          partySize: res.party_size,
          description: res.special_requests,
        }));

        allEvents.push(...formattedReservations);
      }

      // Process member events
      if (memberEventsResponse.ok) {
        const data = await memberEventsResponse.json();
        const memberEvents = data.events || [];

        const formattedMemberEvents = memberEvents.map((event: any) => ({
          id: event.id,
          title: event.title || event.name || 'Member Event',
          date: new Date(event.start_time),
          time: new Date(event.start_time).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          }),
          location: event.location || 'Noir KC',
          type: 'event' as const,
          description: event.description || event.event_description,
        }));

        allEvents.push(...formattedMemberEvents);
      }

      // Sort all events by date
      setEvents(allEvents.sort((a, b) => a.date.getTime() - b.date.getTime()));
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (date: Date): (Date | null)[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      return event.date.getFullYear() === date.getFullYear() &&
             event.date.getMonth() === date.getMonth() &&
             event.date.getDate() === date.getDate();
    });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  const days = getDaysInMonth(currentMonth);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const upcomingEvents = events.filter(event => event.date >= new Date());
  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-[#1F1F1F]">
            Calendar & Events
          </DialogTitle>
          <DialogDescription className="text-sm text-[#5A5A5A] mt-1">
            View your upcoming reservations and special events
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner className="text-[#A59480]" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Calendar Section */}
              <div className="lg:col-span-2">
                <div className="bg-[#F6F5F2] rounded-xl p-6 border border-[#ECEAE5]">
                  {/* Month Navigation */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-[#1F1F1F]">
                      {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </h3>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigateMonth('prev')}
                        className="border-[#ECEAE5] text-[#5A5A5A] hover:bg-[#F6F5F2]"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigateMonth('next')}
                        className="border-[#ECEAE5] text-[#5A5A5A] hover:bg-[#F6F5F2]"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {/* Week day headers */}
                    {weekDays.map(day => (
                      <div key={day} className="text-center text-xs font-medium text-[#8C7C6D] py-2">
                        {day}
                      </div>
                    ))}

                    {/* Calendar days */}
                    {days.map((day, index) => {
                      if (!day) {
                        return <div key={`empty-${index}`} className="h-12"></div>;
                      }

                      const dayEvents = getEventsForDate(day);
                      const isToday = day.toDateString() === new Date().toDateString();
                      const isSelected = selectedDate?.toDateString() === day.toDateString();
                      const hasEvents = dayEvents.length > 0;

                      return (
                        <button
                          key={day.toISOString()}
                          onClick={() => setSelectedDate(day)}
                          className={`
                            h-12 relative border rounded-lg transition-all
                            ${isToday ? 'bg-[#A59480]/10 border-[#A59480]' : 'border-[#ECEAE5]'}
                            ${isSelected ? 'bg-[#A59480] text-white' : 'bg-white hover:bg-[#FBFBFA]'}
                          `}
                        >
                          <span className={`text-sm ${isSelected ? 'font-semibold' : ''}`}>
                            {day.getDate()}
                          </span>
                          {hasEvents && (
                            <div className={`absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 rounded-full ${
                              isSelected ? 'bg-white' : 'bg-[#A59480]'
                            }`} />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected Date Events */}
                  {selectedDate && (
                    <div className="mt-6 pt-6 border-t border-[#ECEAE5]">
                      <h4 className="text-sm font-semibold text-[#1F1F1F] mb-3">
                        Events on {selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                      </h4>
                      {selectedDateEvents.length > 0 ? (
                        <div className="space-y-2">
                          {selectedDateEvents.map(event => (
                            <div key={event.id} className="bg-white rounded-lg p-3 border border-[#ECEAE5]">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-[#1F1F1F]">{event.title}</p>
                                <Badge className={`text-xs ${
                                  event.type === 'reservation' ? 'bg-[#4CAF50] text-white' :
                                  event.type === 'special' ? 'bg-[#A59480] text-white' :
                                  'bg-[#DAD7D0] text-[#5A5A5A]'
                                }`}>
                                  {event.type}
                                </Badge>
                              </div>
                              <p className="text-xs text-[#5A5A5A] mt-1">
                                <Clock className="inline w-3 h-3 mr-1" />
                                {event.time}
                                {event.location && (
                                  <>
                                    <MapPin className="inline w-3 h-3 ml-2 mr-1" />
                                    {event.location}
                                  </>
                                )}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-[#8C7C6D]">No events scheduled</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Upcoming Events List */}
              <div className="lg:col-span-1">
                <div className="bg-[#F6F5F2] rounded-xl p-6 border border-[#ECEAE5]">
                  <h3 className="text-lg font-semibold text-[#1F1F1F] mb-4">Upcoming</h3>

                  {upcomingEvents.length > 0 ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                      {upcomingEvents.slice(0, 10).map(event => (
                        <div key={event.id} className="bg-white rounded-lg p-3 border border-[#ECEAE5]">
                          <p className="text-sm font-medium text-[#1F1F1F] truncate">
                            {event.title}
                          </p>
                          <p className="text-xs text-[#8C7C6D] mt-1">
                            {event.date.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })} at {event.time}
                          </p>
                          {event.partySize && (
                            <p className="text-xs text-[#5A5A5A] mt-1">
                              <Users className="inline w-3 h-3 mr-1" />
                              Party of {event.partySize}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[#8C7C6D] text-center py-8">No upcoming events</p>
                  )}

                  <Button
                    onClick={() => {
                      onClose();
                      onMakeReservation?.();
                    }}
                    className="w-full mt-4 bg-[#A59480] text-white hover:bg-[#8C7C6D]"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Make Reservation
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}