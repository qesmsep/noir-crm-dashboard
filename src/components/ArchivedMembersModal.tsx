import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useToast } from '@/hooks/useToast';
import { getSupabaseClient } from '@/pages/api/supabaseClient';
import Image from 'next/image';
import styles from '../styles/ArchivedMembersModal.module.css';

interface ArchivedMember {
  member_id: string;
  account_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  photo?: string;
  member_type?: string;
  join_date?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onUnarchiveSuccess?: () => void;
}

export default function ArchivedMembersModal({ isOpen, onClose, onUnarchiveSuccess }: Props) {
  const [archivedMembers, setArchivedMembers] = useState<ArchivedMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [unarchiving, setUnarchiving] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchArchivedMembers();
    }
  }, [isOpen]);

  const fetchArchivedMembers = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('status', 'inactive')
        .order('first_name', { ascending: true });

      if (error) throw error;
      setArchivedMembers(data || []);
    } catch (err: any) {
      console.error('Error fetching archived members:', err);
      toast({
        title: 'Error',
        description: 'Failed to load archived members',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnarchive = async (memberId: string, memberName: string) => {
    if (!confirm(`Restore ${memberName} to active members?`)) {
      return;
    }

    setUnarchiving(memberId);
    try {
      const response = await fetch(`/api/members/${memberId}/unarchive`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to unarchive member');
      }

      toast({
        title: 'Member Restored',
        description: `${memberName} has been restored successfully`,
        variant: 'success',
      });

      // Refresh the list
      await fetchArchivedMembers();

      // Notify parent component
      if (onUnarchiveSuccess) {
        onUnarchiveSuccess();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to restore member',
        variant: 'error',
      });
    } finally {
      setUnarchiving(null);
    }
  };

  const handleViewProfile = (accountId: string) => {
    router.push(`/admin/members/${accountId}`);
    onClose();
  };

  const formatPhone = (phone?: string) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '').slice(-10).padStart(10, '0');
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Archived Members</h2>
          <button onClick={onClose} className={styles.closeButton} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={styles.content}>
          {loading ? (
            <div className={styles.loading}>Loading archived members...</div>
          ) : archivedMembers.length === 0 ? (
            <div className={styles.empty}>No archived members</div>
          ) : (
            <div className={styles.membersList}>
              {archivedMembers.map((member) => (
                <div key={member.member_id} className={styles.memberCard}>
                  <div className={styles.memberInfo}>
                    {member.photo ? (
                      <div className={styles.memberPhoto}>
                        <Image
                          src={member.photo}
                          alt={`${member.first_name} ${member.last_name}`}
                          width={48}
                          height={48}
                          style={{ objectFit: 'cover', borderRadius: '50%' }}
                        />
                      </div>
                    ) : (
                      <div className={styles.photoPlaceholder}>
                        {member.first_name?.[0]}{member.last_name?.[0]}
                      </div>
                    )}

                    <div className={styles.memberDetails}>
                      <div className={styles.memberName}>
                        {member.first_name} {member.last_name}
                        {member.member_type === 'primary' && (
                          <span className={styles.primaryBadge}>Primary</span>
                        )}
                      </div>
                      <div className={styles.memberContact}>
                        {member.email && <div>{member.email}</div>}
                        {member.phone && <div>{formatPhone(member.phone)}</div>}
                      </div>
                    </div>
                  </div>

                  <div className={styles.actions}>
                    <button
                      onClick={() => handleViewProfile(member.account_id)}
                      className={styles.viewButton}
                      title="View Profile"
                    >
                      View Profile
                    </button>
                    <button
                      onClick={() => handleUnarchive(member.member_id, `${member.first_name} ${member.last_name}`)}
                      disabled={unarchiving === member.member_id}
                      className={styles.unarchiveButton}
                      title="Restore Member"
                    >
                      {unarchiving === member.member_id ? 'Restoring...' : 'Restore'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
