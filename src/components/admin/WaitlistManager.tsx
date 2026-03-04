import React, { useState, useEffect } from 'react';
import { Search, Send, ExternalLink, Clock, Check, X, Eye, Info, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { Select } from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { useToast } from '@/hooks/useToast';

interface WaitlistEntry {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company?: string;
  occupation?: string;
  industry?: string;
  referral?: string;
  how_did_you_hear?: string;
  why_noir?: string;
  status: 'review' | 'approved' | 'denied' | 'waitlisted' | 'link_sent';
  submitted_at: string;
  reviewed_at?: string;
  review_notes?: string;
  application_token?: string;
  application_link_sent_at?: string;
  application_expires_at?: string;
  application_link_opened_at?: string;
}

export default function WaitlistManager() {
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<WaitlistEntry | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [sendingSMS, setSendingSMS] = useState(false);

  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadWaitlistEntries();
  }, [statusFilter]);

  const loadWaitlistEntries = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/waitlist/manage?${params}`);
      if (response.ok) {
        const data = await response.json();
        setWaitlistEntries(data.data);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load waitlist entries',
          status: 'error',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load waitlist entries',
        status: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReview = (entry: WaitlistEntry) => {
    setSelectedEntry(entry);
    setReviewNotes(entry.review_notes || '');
    setIsReviewOpen(true);
  };

  const handleGenerateLink = (entry: WaitlistEntry) => {
    setSelectedEntry(entry);
    setIsLinkOpen(true);
  };

  const handleViewEntry = (entry: WaitlistEntry) => {
    setSelectedEntry(entry);
    setIsViewOpen(true);
  };

  const submitReview = async (status: 'approved' | 'denied' | 'waitlisted') => {
    if (!selectedEntry) return;

    try {
      const response = await fetch('/api/waitlist/manage', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedEntry.id,
          status,
          review_notes: reviewNotes
        })
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: `Entry ${status} successfully`,
          status: 'success',
        });
        setIsReviewOpen(false);
        loadWaitlistEntries();
      } else {
        throw new Error('Failed to update entry');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update entry',
        status: 'error',
      });
    }
  };

  const generateAndSendLink = async () => {
    if (!selectedEntry) return;

    setSendingSMS(true);
    try {
      const response = await fetch('/api/waitlist/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedEntry.id,
          action: 'generate_link'
        })
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Application link generated and sent successfully',
          status: 'success',
        });
        setIsLinkOpen(false);
        loadWaitlistEntries();
      } else {
        throw new Error('Failed to generate link');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate and send link',
        status: 'error',
      });
    } finally {
      setSendingSMS(false);
    }
  };

  const getStatusVariant = (status: string): 'default' | 'secondary' | 'success' | 'error' | 'warning' => {
    switch (status) {
      case 'review': return 'warning';
      case 'approved': return 'success';
      case 'denied': return 'error';
      case 'waitlisted': return 'secondary';
      case 'link_sent': return 'default';
      default: return 'secondary';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredEntries = waitlistEntries.filter(entry => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      entry.first_name.toLowerCase().includes(searchLower) ||
      entry.last_name.toLowerCase().includes(searchLower) ||
      entry.email.toLowerCase().includes(searchLower) ||
      entry.phone.includes(searchTerm) ||
      (entry.company && entry.company.toLowerCase().includes(searchLower))
    );
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-8">
        <Spinner size="lg" />
        <p className="text-text-muted">Loading waitlist entries...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-2 w-full">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <Input
            placeholder="Search entries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="flex-1 md:max-w-[200px]"
        >
          <option value="all">All Statuses</option>
          <option value="review">Review</option>
          <option value="approved">Approved</option>
          <option value="denied">Denied</option>
          <option value="waitlisted">Waitlisted</option>
          <option value="link_sent">Link Sent</option>
        </Select>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-border-cream-1">
        <table className="w-full">
          <thead className="bg-bg-cream-1 border-b border-border-cream-1">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-[#1F1F1F]">Name</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-[#1F1F1F]">Contact</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-[#1F1F1F]">Details</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-[#1F1F1F]">Status</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-[#1F1F1F]">Submitted</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-[#1F1F1F]">Link Status</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-[#1F1F1F]">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {filteredEntries.map((entry) => (
              <tr key={entry.id} className="border-b border-border-cream-1 hover:bg-bg-cream-1/50 transition-colors">
                <td className="px-4 py-4">
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-[#1F1F1F]">
                      {entry.first_name} {entry.last_name}
                    </span>
                    {entry.company && (
                      <span className="text-xs text-text-muted">{entry.company}</span>
                    )}
                  </div>
                </td>

                <td className="px-4 py-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-[#1F1F1F]">{entry.email}</span>
                    <span className="text-sm text-text-muted">{entry.phone}</span>
                  </div>
                </td>

                <td className="px-4 py-4">
                  <div className="flex flex-col gap-1">
                    {entry.occupation && (
                      <span className="text-xs text-[#1F1F1F]">{entry.occupation}</span>
                    )}
                    {entry.referral && (
                      <span className="text-xs text-blue-600">Ref: {entry.referral}</span>
                    )}
                  </div>
                </td>

                <td className="px-4 py-4">
                  <Badge variant={getStatusVariant(entry.status)}>
                    {entry.status.replace('_', ' ')}
                  </Badge>
                </td>

                <td className="px-4 py-4">
                  <span className="text-sm text-[#1F1F1F]">{formatDate(entry.submitted_at)}</span>
                </td>

                <td className="px-4 py-4">
                  <div className="flex flex-col gap-1">
                    {entry.application_link_sent_at && (
                      <span className="text-xs text-green-600">
                        Sent {formatDate(entry.application_link_sent_at)}
                      </span>
                    )}
                    {entry.application_link_opened_at && (
                      <span className="text-xs text-blue-600">
                        Opened {formatDate(entry.application_link_opened_at)}
                      </span>
                    )}
                    {entry.application_expires_at && (
                      <span className="text-xs text-orange-600">
                        Expires {formatDate(entry.application_expires_at)}
                      </span>
                    )}
                  </div>
                </td>

                <td className="px-4 py-4">
                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleViewEntry(entry)}
                      aria-label="View entry details"
                      className="h-9 w-9"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>

                    {entry.status === 'review' && (
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => handleReview(entry)}
                        aria-label="Review entry"
                        className="h-9 w-9 border-yellow-500 text-yellow-700 hover:bg-yellow-50"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}

                    {(entry.status === 'approved' || entry.status === 'link_sent') && (
                      <Button
                        size="icon"
                        variant={entry.status === 'link_sent' ? 'outline' : 'default'}
                        onClick={() => handleGenerateLink(entry)}
                        aria-label="Generate and send application link"
                        className="h-9 w-9"
                        title="Generate and send application link"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredEntries.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-text-muted">No waitlist entries found</p>
          </div>
        )}
      </div>

      {/* Mobile Card View */}
      <div className="flex flex-col gap-3 md:hidden">
        {filteredEntries.length === 0 ? (
          <div className="py-8 text-center w-full">
            <p className="text-text-muted">No waitlist entries found</p>
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <div
              key={entry.id}
              className="p-4 rounded-xl border border-border-cream-1 bg-white shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col gap-3">
                {/* Name */}
                <div>
                  <span className="text-sm text-text-muted mb-1 block">Name</span>
                  <p className="font-semibold text-base text-[#1F1F1F]">
                    {entry.first_name} {entry.last_name}
                  </p>
                  {entry.company && (
                    <p className="text-xs text-text-muted">{entry.company}</p>
                  )}
                </div>

                {/* Contact */}
                <div>
                  <span className="text-sm text-text-muted mb-1 block">Contact</span>
                  <p className="text-sm text-[#1F1F1F]">{entry.email}</p>
                  <p className="text-sm text-text-muted">{entry.phone}</p>
                </div>

                {/* Details */}
                {(entry.occupation || entry.referral) && (
                  <div>
                    <span className="text-sm text-text-muted mb-1 block">Details</span>
                    {entry.occupation && (
                      <p className="text-sm text-[#1F1F1F]">{entry.occupation}</p>
                    )}
                    {entry.referral && (
                      <p className="text-sm text-blue-600">Ref: {entry.referral}</p>
                    )}
                  </div>
                )}

                {/* Status & Submitted */}
                <div className="flex justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-sm text-text-muted mb-1 block">Status</span>
                    <Badge variant={getStatusVariant(entry.status)}>
                      {entry.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-sm text-text-muted mb-1 block">Submitted</span>
                    <p className="text-sm text-[#1F1F1F]">{formatDate(entry.submitted_at)}</p>
                  </div>
                </div>

                {/* Link Status */}
                {(entry.application_link_sent_at || entry.application_link_opened_at || entry.application_expires_at) && (
                  <div>
                    <span className="text-sm text-text-muted mb-1 block">Link Status</span>
                    <div className="flex flex-col gap-1">
                      {entry.application_link_sent_at && (
                        <span className="text-xs text-green-600">
                          Sent {formatDate(entry.application_link_sent_at)}
                        </span>
                      )}
                      {entry.application_link_opened_at && (
                        <span className="text-xs text-blue-600">
                          Opened {formatDate(entry.application_link_opened_at)}
                        </span>
                      )}
                      {entry.application_expires_at && (
                        <span className="text-xs text-orange-600">
                          Expires {formatDate(entry.application_expires_at)}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-border-cream-1">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => handleViewEntry(entry)}
                    aria-label="View entry details"
                    className="h-11 w-11"
                  >
                    <Eye className="h-5 w-5" />
                  </Button>

                  {entry.status === 'review' && (
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleReview(entry)}
                      aria-label="Review entry"
                      className="h-11 w-11 border-yellow-500 text-yellow-700 hover:bg-yellow-50"
                    >
                      <Check className="h-5 w-5" />
                    </Button>
                  )}

                  {(entry.status === 'approved' || entry.status === 'link_sent') && (
                    <Button
                      size="icon"
                      variant={entry.status === 'link_sent' ? 'outline' : 'default'}
                      onClick={() => handleGenerateLink(entry)}
                      aria-label="Generate and send application link"
                      className="h-11 w-11"
                      title="Generate and send application link"
                    >
                      <Send className="h-5 w-5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Review Sheet */}
      <Sheet open={isReviewOpen} onOpenChange={setIsReviewOpen}>
        <SheetContent className="bg-[#ECEDE8] text-[#353535] w-full sm:max-w-[540px]">
          <SheetHeader>
            <SheetTitle className="text-[#353535]">
              Review Waitlist Entry: {selectedEntry?.first_name} {selectedEntry?.last_name}
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-4 mt-6">
            {selectedEntry && (
              <div className="bg-white p-4 rounded-lg border border-gray-300">
                <div className="flex flex-col gap-2">
                  <p className="text-sm"><strong>Email:</strong> {selectedEntry.email}</p>
                  <p className="text-sm"><strong>Phone:</strong> {selectedEntry.phone}</p>
                  {selectedEntry.company && (
                    <p className="text-sm"><strong>Company:</strong> {selectedEntry.company}</p>
                  )}
                  {selectedEntry.occupation && (
                    <p className="text-sm"><strong>Occupation:</strong> {selectedEntry.occupation}</p>
                  )}
                  {selectedEntry.why_noir && (
                    <p className="text-sm"><strong>Why Noir:</strong> {selectedEntry.why_noir}</p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="review-notes" className="text-[#353535]">Review Notes</Label>
              <Textarea
                id="review-notes"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Add notes about this review..."
                rows={3}
                className="bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          <SheetFooter className="mt-6 gap-3 sm:gap-3">
            <Button
              variant="destructive"
              onClick={() => submitReview('denied')}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Deny
            </Button>
            <Button
              variant="secondary"
              onClick={() => submitReview('waitlisted')}
            >
              Waitlist
            </Button>
            <Button
              variant="default"
              onClick={() => submitReview('approved')}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              <Check className="h-4 w-4" />
              Approve
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Application Link Sheet */}
      <Sheet open={isLinkOpen} onOpenChange={setIsLinkOpen}>
        <SheetContent className="bg-[#ECEDE8] text-[#353535] w-full sm:max-w-[540px]">
          <SheetHeader>
            <SheetTitle className="text-[#353535]">
              Send Application Link: {selectedEntry?.first_name} {selectedEntry?.last_name}
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-4 mt-6">
            <Alert variant="info">
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="flex flex-col gap-1">
                  <p className="font-bold text-[#353535]">
                    Generate and send application link via SMS
                  </p>
                  <p className="text-sm text-[#353535]">
                    This will create a unique application link that expires in 7 days and send it to {selectedEntry?.phone}
                  </p>
                </div>
              </AlertDescription>
            </Alert>

            {selectedEntry?.application_link_sent_at && (
              <Alert variant="warning">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <p className="text-sm text-[#353535]">
                    A link was previously sent on {formatDate(selectedEntry.application_link_sent_at)}.
                    Sending a new link will invalidate the previous one.
                  </p>
                </AlertDescription>
              </Alert>
            )}
          </div>

          <SheetFooter className="mt-6 gap-3 sm:gap-3">
            <Button onClick={() => setIsLinkOpen(false)} variant="outline">
              Cancel
            </Button>
            <Button
              onClick={generateAndSendLink}
              disabled={sendingSMS}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              {sendingSMS ? (
                <>
                  <Spinner size="sm" variant="light" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Generate & Send Link
                </>
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* View Entry Sheet */}
      <Sheet open={isViewOpen} onOpenChange={setIsViewOpen}>
        <SheetContent className="bg-[#ECEDE8] text-[#353535] w-full sm:max-w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-[#353535]">
              Entry Details: {selectedEntry?.first_name} {selectedEntry?.last_name}
            </SheetTitle>
          </SheetHeader>

          {selectedEntry && (
            <div className="flex flex-col gap-4 mt-6">
              <div className="bg-white p-4 rounded-lg border border-gray-300">
                <p className="font-bold mb-3 text-[#353535]">Contact Information</p>
                <div className="flex flex-col gap-2">
                  <p className="text-sm"><strong>Name:</strong> {selectedEntry.first_name} {selectedEntry.last_name}</p>
                  <p className="text-sm"><strong>Email:</strong> {selectedEntry.email}</p>
                  <p className="text-sm"><strong>Phone:</strong> {selectedEntry.phone}</p>
                  {selectedEntry.company && (
                    <p className="text-sm"><strong>Company:</strong> {selectedEntry.company}</p>
                  )}
                  {selectedEntry.occupation && (
                    <p className="text-sm"><strong>Occupation:</strong> {selectedEntry.occupation}</p>
                  )}
                  {selectedEntry.industry && (
                    <p className="text-sm"><strong>Industry:</strong> {selectedEntry.industry}</p>
                  )}
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg border border-gray-300">
                <p className="font-bold mb-3 text-[#353535]">Application Details</p>
                <div className="flex flex-col gap-2">
                  {selectedEntry.referral && (
                    <p className="text-sm"><strong>Referral:</strong> {selectedEntry.referral}</p>
                  )}
                  {selectedEntry.how_did_you_hear && (
                    <p className="text-sm"><strong>How did you hear:</strong> {selectedEntry.how_did_you_hear}</p>
                  )}
                  {selectedEntry.why_noir && (
                    <p className="text-sm"><strong>Why Noir:</strong> {selectedEntry.why_noir}</p>
                  )}
                  <p className="text-sm flex items-center gap-2">
                    <strong>Status:</strong>
                    <Badge variant={getStatusVariant(selectedEntry.status)}>
                      {selectedEntry.status.replace('_', ' ')}
                    </Badge>
                  </p>
                  <p className="text-sm"><strong>Submitted:</strong> {formatDate(selectedEntry.submitted_at)}</p>
                  {selectedEntry.reviewed_at && (
                    <p className="text-sm"><strong>Reviewed:</strong> {formatDate(selectedEntry.reviewed_at)}</p>
                  )}
                </div>
              </div>

              {selectedEntry.review_notes && (
                <div className="bg-white p-4 rounded-lg border border-gray-300">
                  <p className="font-bold mb-3 text-[#353535]">Review Notes</p>
                  <p className="text-sm">{selectedEntry.review_notes}</p>
                </div>
              )}

              <div className="bg-white p-4 rounded-lg border border-gray-300">
                <p className="font-bold mb-3 text-[#353535]">Application Link Status</p>
                <div className="flex flex-col gap-2">
                  {selectedEntry.application_link_sent_at ? (
                    <>
                      <p className="text-sm text-green-600">✓ Link sent on {formatDate(selectedEntry.application_link_sent_at)}</p>
                      {selectedEntry.application_link_opened_at && (
                        <p className="text-sm text-blue-600">✓ Link opened on {formatDate(selectedEntry.application_link_opened_at)}</p>
                      )}
                      {selectedEntry.application_expires_at && (
                        <p className="text-sm text-orange-600">⚠ Expires on {formatDate(selectedEntry.application_expires_at)}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-text-muted">No application link sent yet</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <SheetFooter className="mt-6">
            <Button onClick={() => setIsViewOpen(false)} variant="outline">
              Close
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
