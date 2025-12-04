import { useEffect, useState } from "react";
import { Spinner, useToast } from "@chakra-ui/react";
import { useRouter } from "next/router";
import Image from "next/image";
import { getSupabaseClient } from "../api/supabaseClient";
import AdminLayout from '../../components/layouts/AdminLayout';
import AddMemberModal from '../../components/members/AddMemberModal';
import styles from '../../styles/Members.module.css';

interface Member {
  member_id: string;
  account_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  photo?: string;
  join_date?: string;
  primary?: boolean;
  dob?: string;
}

export default function MembersAdmin() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lookupQuery, setLookupQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    fetchMembers();
  }, []);

  async function fetchMembers() {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('deactivated', false)
        .order('join_date', { ascending: false });
      if (error) throw error;
      setMembers(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const formatDateLong = (date?: string) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatPhone = (phone?: string) => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '').slice(-10);
    if (cleaned.length < 10) {
      cleaned = cleaned.padStart(10, '0');
    }
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  };

  const filteredMembers = members.filter(member => {
    const searchStr = lookupQuery.toLowerCase();
    return (
      member.first_name?.toLowerCase().includes(searchStr) ||
      member.last_name?.toLowerCase().includes(searchStr) ||
      member.email?.toLowerCase().includes(searchStr) ||
      member.phone?.includes(searchStr)
    );
  });

  // Group members by account_id
  const membersByAccount: { [accountId: string]: Member[] } = filteredMembers.reduce((acc, member) => {
    if (!acc[member.account_id]) acc[member.account_id] = [];
    acc[member.account_id].push(member);
    return acc;
  }, {} as { [accountId: string]: Member[] });

  const handleSaveMember = async (memberData: any) => {
    setSaving(true);
    try {
      const response = await fetch('/api/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(memberData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create member');
      }

      await fetchMembers();

      toast({
        title: "Success",
        description: "Member created successfully",
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      setIsAddModalOpen(false);
    } catch (error: any) {
      console.error('Error creating member:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create member",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className={styles.loading}>
          <Spinner size="xl" color="#007aff" />
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className={styles.container}>
          <div className={styles.emptyState}>
            Error loading members: {error}
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className={styles.container}>
        {/* Header with Search and Add Button */}
        <div className={styles.header}>
          <input
            type="text"
            placeholder="Search by name, email, or phone"
            value={lookupQuery}
            onChange={(e) => setLookupQuery(e.target.value)}
            className={styles.searchInput}
          />
          <button
            onClick={() => setIsAddModalOpen(true)}
            disabled={saving}
            className={styles.addButton}
          >
            {saving ? 'Adding...' : 'Add Member'}
          </button>
        </div>

        {/* Members Grid */}
        {Object.entries(membersByAccount).length === 0 ? (
          <div className={styles.emptyState}>
            No members found
          </div>
        ) : (
          <div className={styles.membersGrid}>
            {Object.entries(membersByAccount).map(([accountId, accountMembers]) => (
              <div
                key={accountId}
                className={styles.memberCard}
                onClick={() => router.push(`/admin/members/${accountId}`)}
              >
                <div className={styles.cardContent}>
                  {/* Sort members: primary first */}
                  {[...accountMembers]
                    .sort((a, b) => a.primary === b.primary ? 0 : a.primary ? -1 : 1)
                    .map((member, index) => (
                      <div key={member.member_id}>
                        {/* Member Header (Photo + Name) */}
                        <div className={styles.memberHeader}>
                          {member.photo ? (
                            <div className={styles.memberPhoto}>
                              <Image
                                src={member.photo}
                                alt={`${member.first_name} ${member.last_name}`}
                                width={80}
                                height={80}
                                style={{
                                  objectFit: 'cover',
                                  borderRadius: '50%'
                                }}
                                loading="lazy"
                                placeholder="blur"
                                blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
                              />
                            </div>
                          ) : (
                            <div className={styles.photoPlaceholder}>
                              {member.first_name?.[0]}{member.last_name?.[0]}
                            </div>
                          )}
                          <h3 className={styles.memberName}>
                            {member.first_name} {member.last_name}
                          </h3>
                        </div>

                        {/* Primary Badge */}
                        {member.primary && (
                          <div className={styles.memberBadge}>
                            Primary
                          </div>
                        )}

                        {/* Contact Info */}
                        <div className={styles.contactInfo}>
                          {member.phone && (
                            <div className={styles.contactItem}>
                              <svg className={styles.contactIcon} fill="currentColor" viewBox="0 0 20 20">
                                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                              </svg>
                              <span>{formatPhone(member.phone)}</span>
                            </div>
                          )}
                          {member.email && (
                            <div className={styles.contactItem}>
                              <svg className={styles.contactIcon} fill="currentColor" viewBox="0 0 20 20">
                                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                              </svg>
                              <span>{member.email}</span>
                            </div>
                          )}
                        </div>

                        {/* Divider between members in same account */}
                        {index < accountMembers.length - 1 && (
                          <div style={{
                            height: '1px',
                            background: 'rgba(0, 0, 0, 0.06)',
                            margin: '1rem 0'
                          }} />
                        )}
                      </div>
                    ))}

                  {/* Join Date Footer */}
                  <div className={styles.joinDate}>
                    Member Since {formatDateLong(accountMembers[0].join_date)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddMemberModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleSaveMember}
      />
    </AdminLayout>
  );
}
