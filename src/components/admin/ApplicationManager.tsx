import React, { useState, useEffect } from 'react';
import { Search, Eye, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet';
import { Select } from '@/components/ui/select';
import { useToast } from '@/hooks/useToast';
import styles from '../../styles/ApplicationManager.module.css';

interface Application {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  status: string;
  created_at: string;
  questionnaire_completed_at?: string;
  agreement_completed_at?: string;
  payment_completed_at?: string;
  payment_amount?: number;
  waitlist_id?: string;
  questionnaire_responses?: any;
  agreement_signed?: boolean;
}

export default function ApplicationManager() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadApplications();
  }, [statusFilter]);

  const loadApplications = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/membership/applications?${params}`);
      if (response.ok) {
        const data = await response.json();
        setApplications(data);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load applications',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewApplication = async (application: Application) => {
    try {
      const response = await fetch(`/api/membership/applications/${application.id}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedApplication(data);
        setIsOpen(true);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load application details',
        variant: 'error',
      });
    }
  };

  const handleApproveApplication = async (applicationId: string) => {
    try {
      const response = await fetch(`/api/membership/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' })
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Application approved successfully',
        });
        setIsOpen(false);
        loadApplications();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to approve application',
        variant: 'error',
      });
    }
  };

  const handleRejectApplication = async (applicationId: string) => {
    try {
      const response = await fetch(`/api/membership/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' })
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Application rejected successfully',
        });
        setIsOpen(false);
        loadApplications();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to reject application',
        variant: 'error',
      });
    }
  };

  const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'questionnaire_completed': return 'default';
      case 'agreement_completed': return 'secondary';
      case 'payment_completed': return 'default';
      case 'approved': return 'default';
      case 'rejected': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'questionnaire_completed': return 'bg-blue-100 text-blue-800 hover:bg-blue-100';
      case 'agreement_completed': return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100';
      case 'payment_completed': return 'bg-green-100 text-green-800 hover:bg-green-100';
      case 'approved': return 'bg-green-100 text-green-800 hover:bg-green-100';
      case 'rejected': return 'bg-red-100 text-red-800 hover:bg-red-100';
      default: return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
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

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount / 100);
  };

  const filteredApplications = applications.filter(app => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      app.first_name.toLowerCase().includes(searchLower) ||
      app.last_name.toLowerCase().includes(searchLower) ||
      app.email.toLowerCase().includes(searchLower) ||
      (app.phone && app.phone.includes(searchTerm))
    );
  });

  if (loading) {
    return <p className="text-[#1F1F1F]">Loading applications...</p>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <h2>Applications</h2>
          <p>Track membership applications and onboarding progress</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 w-full mb-6">
        <div className="relative flex-1 md:max-w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search applications..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full md:w-[200px]"
        >
          <option value="all">All Statuses</option>
          <option value="questionnaire_pending">Questionnaire Pending</option>
          <option value="questionnaire_completed">Questionnaire Completed</option>
          <option value="agreement_pending">Agreement Pending</option>
          <option value="agreement_completed">Agreement Completed</option>
          <option value="payment_pending">Payment Pending</option>
          <option value="payment_completed">Payment Completed</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </Select>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto border border-border-cream-1 rounded-lg">
        <table className="w-full bg-white">
          <thead className="bg-bg-cream-1 border-b border-border-cream-1">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#1F1F1F] uppercase tracking-wider">Applicant</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#1F1F1F] uppercase tracking-wider">Contact</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#1F1F1F] uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#1F1F1F] uppercase tracking-wider">Progress</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#1F1F1F] uppercase tracking-wider">Payment</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#1F1F1F] uppercase tracking-wider">Submitted</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#1F1F1F] uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-cream-1">
            {filteredApplications.map((application) => (
              <tr key={application.id} className="hover:bg-bg-cream-1 transition-colors">
                <td className="px-4 py-4">
                  <div className="flex flex-col gap-1">
                    <p className="font-bold text-[#1F1F1F]">
                      {application.first_name} {application.last_name}
                    </p>
                    {application.waitlist_id && (
                      <Badge className="w-fit bg-purple-100 text-purple-800 hover:bg-purple-100">From Waitlist</Badge>
                    )}
                  </div>
                </td>

                <td className="px-4 py-4">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm text-[#1F1F1F]">{application.email}</p>
                    {application.phone && (
                      <p className="text-sm text-gray-500">{application.phone}</p>
                    )}
                  </div>
                </td>

                <td className="px-4 py-4">
                  <Badge className={getStatusColor(application.status)}>
                    {application.status.replace('_', ' ')}
                  </Badge>
                </td>

                <td className="px-4 py-4">
                  <div className="flex flex-col gap-1">
                    {application.questionnaire_completed_at && (
                      <p className="text-xs text-green-600">✓ Questionnaire</p>
                    )}
                    {application.agreement_completed_at && (
                      <p className="text-xs text-green-600">✓ Agreement</p>
                    )}
                    {application.payment_completed_at && (
                      <p className="text-xs text-green-600">✓ Payment</p>
                    )}
                  </div>
                </td>

                <td className="px-4 py-4">
                  {application.payment_amount ? (
                    <p className="font-bold text-green-600">
                      {formatAmount(application.payment_amount)}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500">Pending</p>
                  )}
                </td>

                <td className="px-4 py-4">
                  <p className="text-sm text-[#1F1F1F]">{formatDate(application.created_at)}</p>
                </td>

                <td className="px-4 py-4">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewApplication(application)}
                      className="min-w-[44px] min-h-[44px] p-2"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {application.status === 'payment_completed' && (
                      <Button
                        size="sm"
                        onClick={() => handleApproveApplication(application.id)}
                        className="min-w-[44px] min-h-[44px] p-2 bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredApplications.length === 0 && (
          <div className="py-8 text-center bg-white">
            <p className="text-gray-500">No applications found</p>
          </div>
        )}
      </div>

      {/* Mobile Card View */}
      <div className="flex md:hidden flex-col gap-3">
        {filteredApplications.length === 0 ? (
          <div className={styles.emptyState}>
            <h3>No applications found</h3>
            <p>Applications will appear here when members apply</p>
          </div>
        ) : (
          filteredApplications.map((application) => (
            <div key={application.id} className={styles.appCard} onClick={() => handleViewApplication(application)}>
              <div className={styles.appContent}>
                <div className={styles.appRow1}>
                  <div>
                    <h3 className={styles.appName}>{application.first_name} {application.last_name}</h3>
                    {application.waitlist_id && (
                      <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 text-xs">From Waitlist</Badge>
                    )}
                  </div>
                  <span className={`${styles.appStatus} ${styles[application.status.replace('_', '')]}`}>
                    {application.status.replace('_', ' ')}
                  </span>
                </div>

                <div>
                  <p className={styles.appEmail}>{application.email}</p>
                  {application.phone && (
                    <p className={styles.appPhone}>{application.phone}</p>
                  )}
                </div>

                <div className={styles.appProgress}>
                  <div className={styles.progressItem}>
                    <span className={`${styles.progressIcon} ${application.questionnaire_completed_at ? styles.complete : styles.incomplete}`}>
                      {application.questionnaire_completed_at ? '✓' : '○'}
                    </span>
                    <p className={`text-xs ${application.questionnaire_completed_at ? 'text-green-600' : 'text-gray-400'}`}>
                      Questionnaire
                    </p>
                  </div>
                  <div className={styles.progressItem}>
                    <span className={`${styles.progressIcon} ${application.agreement_completed_at ? styles.complete : styles.incomplete}`}>
                      {application.agreement_completed_at ? '✓' : '○'}
                    </span>
                    <p className={`text-xs ${application.agreement_completed_at ? 'text-green-600' : 'text-gray-400'}`}>
                      Agreement
                    </p>
                  </div>
                  <div className={styles.progressItem}>
                    <span className={`${styles.progressIcon} ${application.payment_completed_at ? styles.complete : styles.incomplete}`}>
                      {application.payment_completed_at ? '✓' : '○'}
                    </span>
                    <p className={`text-xs ${application.payment_completed_at ? 'text-green-600' : 'text-gray-400'}`}>
                      Payment {application.payment_amount && `(${formatAmount(application.payment_amount)})`}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-[#8C7C6D]">
                  Submitted {formatDate(application.created_at)}
                </p>

                <div className={styles.appActions}>
                  <button className={`${styles.actionButton} ${styles.view}`} onClick={(e) => { e.stopPropagation(); handleViewApplication(application); }}>
                    <Eye size={18} />
                    <span>View</span>
                  </button>
                  {application.status === 'payment_completed' && (
                    <button className={`${styles.actionButton} ${styles.approve}`} onClick={(e) => { e.stopPropagation(); handleApproveApplication(application.id); }}>
                      <Check size={18} />
                      <span>Approve</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Application Details Sheet */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent className="bg-[#ECEDE8] text-[#353535] w-full sm:max-w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-[#353535]">
              Application Details: {selectedApplication?.first_name} {selectedApplication?.last_name}
            </SheetTitle>
          </SheetHeader>

          {selectedApplication && (
            <div className="flex flex-col gap-6 pt-6">
              {/* Basic Information */}
              <div className="bg-white p-4 rounded-md border border-gray-300">
                <p className="font-bold mb-3 text-[#353535]">Basic Information</p>
                <div className="flex flex-col gap-2">
                  <p className="text-[#353535]">
                    <strong>Name:</strong> {selectedApplication.first_name} {selectedApplication.last_name}
                  </p>
                  <p className="text-[#353535]">
                    <strong>Email:</strong> {selectedApplication.email}
                  </p>
                  {selectedApplication.phone && (
                    <p className="text-[#353535]">
                      <strong>Phone:</strong> {selectedApplication.phone}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <strong>Status:</strong>
                    <Badge className={getStatusColor(selectedApplication.status)}>
                      {selectedApplication.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-[#353535]">
                    <strong>Submitted:</strong> {formatDate(selectedApplication.created_at)}
                  </p>
                </div>
              </div>

              {/* Progress */}
              <div className="bg-white p-4 rounded-md border border-gray-300">
                <p className="font-bold mb-3 text-[#353535]">Application Progress</p>
                <div className="flex flex-col gap-2">
                  {selectedApplication.questionnaire_completed_at && (
                    <p className="text-green-600">
                      ✓ Questionnaire completed on {formatDate(selectedApplication.questionnaire_completed_at)}
                    </p>
                  )}
                  {selectedApplication.agreement_completed_at && (
                    <p className="text-green-600">
                      ✓ Agreement signed on {formatDate(selectedApplication.agreement_completed_at)}
                    </p>
                  )}
                  {selectedApplication.payment_completed_at && (
                    <p className="text-green-600">
                      ✓ Payment completed on {formatDate(selectedApplication.payment_completed_at)}
                    </p>
                  )}
                  {selectedApplication.payment_amount && (
                    <p className="text-[#353535]">
                      <strong>Payment Amount:</strong> {formatAmount(selectedApplication.payment_amount)}
                    </p>
                  )}
                </div>
              </div>

              {/* Questionnaire Responses */}
              {selectedApplication.questionnaire_responses && (
                <div className="bg-white p-4 rounded-md border border-gray-300">
                  <p className="font-bold mb-3 text-[#353535]">Questionnaire Responses</p>
                  <div className="flex flex-col gap-3">
                    {Object.entries(selectedApplication.questionnaire_responses).map(([question, answer]) => (
                      <div key={question} className="w-full">
                        <p className="font-semibold text-[#353535]">{question}</p>
                        <p className="text-sm text-gray-600">{String(answer)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <SheetFooter className="mt-6 border-t border-gray-300 pt-4">
            <div className="flex gap-3 w-full flex-col sm:flex-row sm:justify-end">
              {selectedApplication?.status === 'payment_completed' && (
                <>
                  <Button
                    variant="destructive"
                    onClick={() => handleRejectApplication(selectedApplication.id)}
                    className="w-full sm:w-auto"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                  <Button
                    onClick={() => handleApproveApplication(selectedApplication.id)}
                    className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                </>
              )}
              <Button
                onClick={() => setIsOpen(false)}
                variant="outline"
                className="w-full sm:w-auto"
              >
                Close
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
