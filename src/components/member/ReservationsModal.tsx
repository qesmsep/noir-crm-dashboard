'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Calendar, Clock, Users, MapPin, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ReservationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReservationUpdated?: () => void;
  onMakeReservation?: () => void;
}

export default function ReservationsModal({ isOpen, onClose, onReservationUpdated, onMakeReservation }: ReservationsModalProps) {
  const { toast } = useToast();
  const [reservations, setReservations] = useState<any[]>([]);
  const [loadingReservations, setLoadingReservations] = useState(true);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [reservationToCancel, setReservationToCancel] = useState<any | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchReservations();
    }
  }, [isOpen]);

  const fetchReservations = async () => {
    try {
      setLoadingReservations(true);
      const response = await fetch('/api/member/reservations', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setReservations(data.reservations || []);
      }
    } catch (error) {
      console.error('Error fetching reservations:', error);
      toast({
        title: 'Error',
        description: 'Failed to load reservations',
        variant: 'error',
      });
    } finally {
      setLoadingReservations(false);
    }
  };

  const handleCancelReservation = async () => {
    if (!reservationToCancel) return;

    setCancelingId(reservationToCancel.id);
    try {
      const response = await fetch('/api/member/reservations/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          reservation_id: reservationToCancel.id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cancel reservation');
      }

      toast({
        title: 'Success',
        description: 'Reservation cancelled successfully',
      });

      await fetchReservations();
      if (onReservationUpdated) {
        onReservationUpdated();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'error',
      });
    } finally {
      setCancelingId(null);
      setReservationToCancel(null);
    }
  };

  const now = new Date();
  const upcomingReservations = reservations.filter(
    (r) => new Date(r.start_time) >= now && r.status !== 'cancelled'
  );
  const pastReservations = reservations.filter(
    (r) => new Date(r.start_time) < now || r.status === 'cancelled'
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-[#4CAF50] text-white';
      case 'pending':
        return 'bg-[#FFA726] text-white';
      case 'cancelled':
        return 'bg-[#757575] text-white';
      case 'completed':
        return 'bg-[#A59480] text-white';
      default:
        return 'bg-[#DAD7D0] text-[#1F1F1F]';
    }
  };

  const ReservationCard = ({ reservation, isPast }: { reservation: any; isPast: boolean }) => (
    <div className="p-4 bg-white rounded-lg border border-[#ECEAE5] hover:bg-[#FBFBFA] transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-[#1F1F1F]">
              <Calendar className="w-4 h-4 text-[#A59480]" />
              <span className="text-sm font-medium">
                {new Date(reservation.start_time).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[#1F1F1F]">
              <Clock className="w-4 h-4 text-[#A59480]" />
              <span className="text-sm font-medium">
                {new Date(reservation.start_time).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                })}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 text-[#5A5A5A]">
              <Users className="w-4 h-4" />
              <span className="text-sm">Party of {reservation.party_size}</span>
            </div>
            {reservation.table_number && (
              <div className="flex items-center gap-1 text-[#5A5A5A]">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">Table {reservation.table_number}</span>
              </div>
            )}
            <Badge className={getStatusColor(reservation.status)}>
              {reservation.status}
            </Badge>
          </div>

          {reservation.notes && (
            <p className="text-xs text-[#8C7C6D] mt-2">{reservation.notes}</p>
          )}
        </div>

        {!isPast && reservation.status !== 'cancelled' && (
          <div className="flex gap-2 flex-shrink-0">
            <Button
              size="sm"
              variant="ghost"
              className="text-[#F44336] hover:bg-[#F44336] hover:text-white border-0"
              onClick={() => setReservationToCancel(reservation)}
              disabled={!!cancelingId}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-[#1F1F1F]">
              Reservations
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-6 pr-2">
            {loadingReservations ? (
              <div className="flex justify-center py-12">
                <Spinner className="text-[#A59480]" />
              </div>
            ) : (
              <>
                {/* Upcoming Reservations */}
                <div>
                  <h3 className="text-lg font-semibold text-[#1F1F1F] mb-3">
                    Upcoming ({upcomingReservations.length})
                  </h3>
                  {upcomingReservations.length > 0 ? (
                    <div className="space-y-3">
                      {upcomingReservations.map((reservation) => (
                        <ReservationCard
                          key={reservation.id}
                          reservation={reservation}
                          isPast={false}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-[#5A5A5A] text-center py-8">No upcoming reservations</p>
                  )}
                </div>

                {/* Make Reservation Button */}
                {onMakeReservation && (
                  <div>
                    <Button
                      className="w-full bg-[#A59480] text-white hover:bg-[#8C7C6D]"
                      onClick={() => {
                        onMakeReservation();
                        onClose();
                      }}
                    >
                      Make Reservation
                    </Button>
                  </div>
                )}

                {/* Past Reservations */}
                <div>
                  <h3 className="text-lg font-semibold text-[#1F1F1F] mb-3">
                    Past Visits ({pastReservations.length})
                  </h3>
                  {pastReservations.length > 0 ? (
                    <div className="space-y-3">
                      {pastReservations.map((reservation) => (
                        <ReservationCard
                          key={reservation.id}
                          reservation={reservation}
                          isPast={true}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-[#5A5A5A] text-center py-8">No past reservations</p>
                  )}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={!!reservationToCancel} onOpenChange={() => setReservationToCancel(null)}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Reservation?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel your reservation for{' '}
              {reservationToCancel &&
                new Date(reservationToCancel.start_time).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Reservation</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelReservation}
              className="bg-[#F44336] text-white hover:bg-[#D32F2F]"
              disabled={!!cancelingId}
            >
              {cancelingId ? 'Cancelling...' : 'Cancel Reservation'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
