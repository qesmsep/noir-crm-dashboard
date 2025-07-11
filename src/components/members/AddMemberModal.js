import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

const MEMBERSHIP_TIERS = [
  { label: 'Membership', value: 'Membership', dues: 100 },
  { label: 'Membership + Partner', value: 'Membership + Partner', dues: 125 },
  { label: 'Membership + Daytime', value: 'Membership + Daytime', dues: 350 },
  { label: 'Membership + Partner + Daytime', value: 'Membership + Partner + Daytime', dues: 375 },
  // Keep legacy support for existing members
  { label: 'Solo', value: 'Solo', dues: 100 },
  { label: 'Duo', value: 'Duo', dues: 125 },
  { label: 'Premier', value: 'Premier', dues: 250 },
  { label: 'Reserve', value: 'Reserve', dues: 1000 },
  { label: 'Host', value: 'Host', dues: 1 }
];

const ALLOWED_MEMBER_FIELDS = [
  'account_id', 'first_name', 'last_name', 'email', 'phone', 'stripe_customer_id',
  'join_date', 'company', 'address', 'address_2', 'city', 'state', 'zip', 'country',
  'referral', 'membership', 'monthly_dues', 'photo', 'dob', 'auth_code', 'token', 'created_at',
  'member_type', 'member_id'
];

function cleanMemberObject(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => ALLOWED_MEMBER_FIELDS.includes(key))
  );
}

const AddMemberModal = ({ isOpen, onClose, onSave }) => {
  const [showSecondaryMember, setShowSecondaryMember] = useState(false);
  const [primaryMember, setPrimaryMember] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    stripe_customer_id: '',
    company: '',
    address: '',
    address_2: '',
    city: '',
    state: '',
    zip: '',
    country: '',
    referral: '',
    membership: '',
    monthly_dues: 0,
    dob: '',
    photo: ''
  });

  const [secondaryMember, setSecondaryMember] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    dob: '',
    photo: '',
    membership: ''
  });

  const handlePrimaryMemberChange = (e) => {
    const { name, value } = e.target;
    let update = { [name]: value };
    if (name === 'membership') {
      const tier = MEMBERSHIP_TIERS.find(t => t.value === value);
      update.monthly_dues = tier ? tier.dues : 0;
    }
    setPrimaryMember(prev => ({ ...prev, ...update }));
  };

  const handleSecondaryMemberChange = (e) => {
    const { name, value } = e.target;
    setSecondaryMember(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Generate UUIDs
      const account_id = uuidv4();
      const primary_member_id = uuidv4();
      const secondary_member_id = showSecondaryMember ? uuidv4() : null;

      // Handle photo uploads if present
      let primaryPhotoUrl = null;
      let secondaryPhotoUrl = null;

      if (primaryMember.photo) {
        primaryPhotoUrl = primaryMember.photo;
      }

      if (showSecondaryMember && secondaryMember.photo) {
        secondaryPhotoUrl = secondaryMember.photo;
      }

      const now = new Date().toISOString();
      const today = new Date().toISOString().split('T')[0];

      // Assign monthly_dues based on membership and member_type
      let primaryDues = 0;
      let secondaryDues = 0;
      if (/duo/i.test(primaryMember.membership)) {
        primaryDues = 100;
        secondaryDues = 25;
      } else if (/solo/i.test(primaryMember.membership)) {
        primaryDues = 100;
      } else if (/premier/i.test(primaryMember.membership)) {
        primaryDues = 250;
      } else if (/reserve/i.test(primaryMember.membership)) {
        primaryDues = 1000;
      } else if (/host/i.test(primaryMember.membership)) {
        primaryDues = 1;
      }

      const primaryMemberClean = cleanMemberObject({
        ...primaryMember,
        member_id: primary_member_id,
        account_id,
        member_type: 'primary',
        created_at: now,
        join_date: today,
        monthly_dues: primaryDues
      });
      const secondaryMemberClean = showSecondaryMember ? cleanMemberObject({
        ...secondaryMember,
        member_id: secondary_member_id,
        account_id,
        member_type: 'secondary',
        created_at: now,
        join_date: today,
        membership: primaryMember.membership, // ensure membership matches
        monthly_dues: secondaryDues
      }) : null;
      const memberData = {
        account_id,
        primary_member: primaryMemberClean,
        secondary_member: secondaryMemberClean
      };

      await onSave(memberData);
      onClose();
    } catch (error) {
      console.error('Error saving member:', error);
      alert(`Failed to save member: ${error.message}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0,0,0,0.5)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        background: '#fff',
        padding: '2rem',
        borderRadius: '12px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
        width: '90%',
        maxWidth: '800px',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2 style={{ margin: 0, color: '#333' }}>Add New Member</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#666'
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Primary Member Section */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ marginBottom: '1rem', color: '#444' }}>Primary Member</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              <div>
                <label>First Name *</label>
                <input
                  type="text"
                  name="first_name"
                  value={primaryMember.first_name}
                  onChange={handlePrimaryMemberChange}
                  required
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>
              <div>
                <label>Last Name *</label>
                <input
                  type="text"
                  name="last_name"
                  value={primaryMember.last_name}
                  onChange={handlePrimaryMemberChange}
                  required
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>
              <div>
                <label>Email *</label>
                <input
                  type="email"
                  name="email"
                  value={primaryMember.email}
                  onChange={handlePrimaryMemberChange}
                  required
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>
              <div>
                <label>Phone *</label>
                <input
                  type="tel"
                  name="phone"
                  value={primaryMember.phone}
                  onChange={handlePrimaryMemberChange}
                  required
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>
              <div>
                <label>Date of Birth *</label>
                <input
                  type="date"
                  name="dob"
                  value={primaryMember.dob}
                  onChange={handlePrimaryMemberChange}
                  required
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>
              <div>
                <label>Join Date *</label>
                <input
                  type="date"
                  name="join_date"
                  value={primaryMember.join_date || ''}
                  onChange={handlePrimaryMemberChange}
                  required
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>
              <div>
                <label>Membership *</label>
                <select
                  name="membership"
                  value={primaryMember.membership}
                  onChange={handlePrimaryMemberChange}
                  required
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                >
                  <option value="">Select a tier</option>
                  {MEMBERSHIP_TIERS.map(tier => (
                    <option key={tier.value} value={tier.value}>{tier.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Stripe Customer ID</label>
                <input
                  type="text"
                  name="stripe_customer_id"
                  value={primaryMember.stripe_customer_id}
                  onChange={handlePrimaryMemberChange}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>
              <div>
                <label>Company</label>
                <input
                  type="text"
                  name="company"
                  value={primaryMember.company}
                  onChange={handlePrimaryMemberChange}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>
              <div>
                <label>Address</label>
                <input
                  type="text"
                  name="address"
                  value={primaryMember.address}
                  onChange={handlePrimaryMemberChange}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>
              <div>
                <label>Address 2</label>
                <input
                  type="text"
                  name="address_2"
                  value={primaryMember.address_2}
                  onChange={handlePrimaryMemberChange}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>
              <div>
                <label>City</label>
                <input
                  type="text"
                  name="city"
                  value={primaryMember.city}
                  onChange={handlePrimaryMemberChange}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>
              <div>
                <label>State</label>
                <input
                  type="text"
                  name="state"
                  value={primaryMember.state}
                  onChange={handlePrimaryMemberChange}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>
              <div>
                <label>ZIP</label>
                <input
                  type="text"
                  name="zip"
                  value={primaryMember.zip}
                  onChange={handlePrimaryMemberChange}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>
              <div>
                <label>Country</label>
                <input
                  type="text"
                  name="country"
                  value={primaryMember.country}
                  onChange={handlePrimaryMemberChange}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>
              <div>
                <label>Referral</label>
                <input
                  type="text"
                  name="referral"
                  value={primaryMember.referral}
                  onChange={handlePrimaryMemberChange}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>
              <div>
                <label>Photo URL</label>
                <input
                  type="url"
                  name="photo"
                  value={primaryMember.photo}
                  onChange={handlePrimaryMemberChange}
                  placeholder="https://..."
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>
            </div>
          </div>

          {/* Secondary Member Toggle */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showSecondaryMember}
                onChange={(e) => setShowSecondaryMember(e.target.checked)}
              />
              Add Secondary Member (for Duo membership)
            </label>
          </div>

          {/* Secondary Member Section */}
          {showSecondaryMember && (
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1rem', color: '#444' }}>Secondary Member</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                <div>
                  <label>First Name *</label>
                  <input
                    type="text"
                    name="first_name"
                    value={secondaryMember.first_name}
                    onChange={handleSecondaryMemberChange}
                    required
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                </div>
                <div>
                  <label>Last Name *</label>
                  <input
                    type="text"
                    name="last_name"
                    value={secondaryMember.last_name}
                    onChange={handleSecondaryMemberChange}
                    required
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                </div>
                <div>
                  <label>Email *</label>
                  <input
                    type="email"
                    name="email"
                    value={secondaryMember.email}
                    onChange={handleSecondaryMemberChange}
                    required
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                </div>
                <div>
                  <label>Phone *</label>
                  <input
                    type="tel"
                    name="phone"
                    value={secondaryMember.phone}
                    onChange={handleSecondaryMemberChange}
                    required
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                </div>
                <div>
                  <label>Date of Birth *</label>
                  <input
                    type="date"
                    name="dob"
                    value={secondaryMember.dob}
                    onChange={handleSecondaryMemberChange}
                    required
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                </div>
                <div>
                  <label>Photo URL</label>
                  <input
                    type="url"
                    name="photo"
                    value={secondaryMember.photo}
                    onChange={handleSecondaryMemberChange}
                    placeholder="https://..."
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.6rem 1.4rem',
                background: '#e2e8f0',
                color: '#4a5568',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: '0.6rem 1.4rem',
                background: '#2c5282',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Save Member
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddMemberModal; 