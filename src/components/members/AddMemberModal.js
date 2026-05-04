import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

// Sanitize input to prevent XSS
const sanitizeInput = (value) => {
  if (typeof value !== 'string') return value;
  // Strip HTML tags but DON'T trim during input (trim on submit instead)
  return value.replace(/<[^>]*>/g, '');
};

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

// Payment Form Component
function PaymentForm({ memberData, onSuccess, onError }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    try {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      // Create payment method
      const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
        billing_details: {
          name: `${memberData.primaryMember.first_name} ${memberData.primaryMember.last_name}`,
          email: memberData.primaryMember.email,
        },
      });

      if (pmError) {
        throw pmError;
      }

      // Create member with payment method
      const memberDataWithPayment = {
        ...memberData,
        payment_method_id: paymentMethod.id,
      };

      await onSuccess(memberDataWithPayment);
    } catch (error) {
      onError(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
          Payment Method
        </label>
        <div style={{
          padding: '0.75rem',
          border: '1px solid #ccc',
          borderRadius: '4px',
          backgroundColor: '#fff'
        }}>
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#424770',
                  '::placeholder': {
                    color: '#aab7c4',
                  },
                },
              },
            }}
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={!stripe || submitting}
        style={{
          width: '100%',
          padding: '0.75rem',
          background: submitting ? '#999' : '#2c5282',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          fontWeight: 600,
          cursor: submitting ? 'not-allowed' : 'pointer',
          fontSize: '1rem'
        }}
      >
        {submitting ? 'Processing...' : 'Complete Payment & Create Member'}
      </button>
    </form>
  );
}

const AddMemberModal = ({ isOpen, onClose, onSave }) => {
  const [step, setStep] = useState(1); // 1: Client Info, 2: Membership Info, 3: Payment
  const [membershipPlans, setMembershipPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [showSecondaryMember, setShowSecondaryMember] = useState(false);
  const [primaryMember, setPrimaryMember] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
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

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setStep(1);
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Fetch membership plans on mount
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        // Get Supabase client and session for authentication
        const { getSupabaseClient } = await import('../../pages/api/supabaseClient');
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error('Not authenticated');
        }

        const response = await fetch('/api/admin/subscription-plans', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) throw new Error('Failed to fetch plans');
        const result = await response.json();
        // Filter to only active plans that should show in onboarding
        const activePlans = (result.data || []).filter(plan => plan.is_active);
        setMembershipPlans(activePlans);
      } catch (error) {
        console.error('Error fetching membership plans:', error);
        alert('Failed to load membership plans. Please try again.');
      } finally {
        setLoadingPlans(false);
      }
    };

    if (isOpen) {
      fetchPlans();
    }
  }, [isOpen]);

  const handlePrimaryMemberChange = (e) => {
    const { name, value } = e.target;
    const sanitizedValue = sanitizeInput(value);
    let update = { [name]: sanitizedValue };
    if (name === 'membership') {
      const selectedPlan = membershipPlans.find(p => p.plan_name === sanitizedValue);
      update.monthly_dues = selectedPlan ? selectedPlan.monthly_price : 0;
    }
    setPrimaryMember(prev => ({ ...prev, ...update }));
  };

  const handleSecondaryMemberChange = (e) => {
    const { name, value } = e.target;
    const sanitizedValue = sanitizeInput(value);
    setSecondaryMember(prev => ({ ...prev, [name]: sanitizedValue }));
  };

  const handleStep1Submit = (e) => {
    e.preventDefault();

    // Validate step 1 required fields (client info)
    if (!primaryMember.first_name || !primaryMember.last_name || !primaryMember.email || !primaryMember.phone || !primaryMember.dob) {
      alert('Please fill in all required fields for the primary member');
      return;
    }

    if (!primaryMember.address || !primaryMember.city || !primaryMember.state || !primaryMember.zip) {
      alert('Please complete the address information');
      return;
    }

    if (showSecondaryMember) {
      if (!secondaryMember.first_name || !secondaryMember.last_name || !secondaryMember.email || !secondaryMember.phone || !secondaryMember.dob) {
        alert('Please fill in all required fields for the secondary member');
        return;
      }
    }

    // Move to membership info step
    setStep(2);
  };

  const handleStep2Submit = (e) => {
    e.preventDefault();

    // Validate step 2 required fields (membership info)
    if (!primaryMember.membership) {
      alert('Please select a membership plan');
      return;
    }

    // Move to payment step
    setStep(3);
  };

  const handlePaymentSuccess = async (memberDataWithPayment) => {
    try {
      // Generate UUIDs
      const account_id = uuidv4();
      const primary_member_id = uuidv4();
      const secondary_member_id = showSecondaryMember ? uuidv4() : null;

      const now = new Date().toISOString();
      const today = new Date().toISOString().split('T')[0];

      // Get selected plan
      const selectedPlan = membershipPlans.find(p => p.plan_name === primaryMember.membership);
      const primaryDues = selectedPlan ? selectedPlan.monthly_price : 0;
      const secondaryDues = selectedPlan && selectedPlan.additional_member_fee ? selectedPlan.additional_member_fee : 25;

      const primaryMemberClean = cleanMemberObject({
        ...primaryMember,
        member_id: primary_member_id,
        account_id,
        member_type: 'primary',
        created_at: now,
        join_date: primaryMember.join_date || today,
        monthly_dues: primaryDues
      });

      const secondaryMemberClean = showSecondaryMember ? cleanMemberObject({
        ...secondaryMember,
        member_id: secondary_member_id,
        account_id,
        member_type: 'secondary',
        created_at: now,
        join_date: primaryMember.join_date || today,
        membership: primaryMember.membership,
        monthly_dues: secondaryDues
      }) : null;

      const memberData = {
        account_id,
        primary_member: primaryMemberClean,
        secondary_member: secondaryMemberClean,
        payment_method_id: memberDataWithPayment.payment_method_id,
        membership_plan_id: selectedPlan?.id
      };

      await onSave(memberData);

      // Reset form and close
      setStep(1);
      setPrimaryMember({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
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
      setSecondaryMember({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        dob: '',
        photo: '',
        membership: ''
      });
      setShowSecondaryMember(false);
      onClose();
    } catch (error) {
      console.error('Error saving member:', error);
      alert(`Failed to save member: ${error.message}`);
    }
  };

  const handlePaymentError = (error) => {
    console.error('Payment error:', error);
    alert(`Payment failed: ${error.message}`);
  };

  if (!isOpen) return null;

  const selectedPlan = membershipPlans.find(p => p.plan_name === primaryMember.membership);

  return (
    <div
      onClick={(e) => {
        // Close modal if clicking on backdrop
        if (e.target === e.currentTarget) {
          setStep(1);
          onClose();
        }
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0,0,0,0.5)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '1rem 0.5rem',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch'
      }}>
      <div style={{
        background: '#fff',
        padding: window.innerWidth < 768 ? '1rem' : '1.25rem',
        borderRadius: '8px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
        width: '100%',
        maxWidth: '550px',
        margin: window.innerWidth < 768 ? '0 auto' : '2rem auto',
        maxHeight: window.innerWidth < 768 ? 'calc(100vh - 2rem)' : 'calc(100vh - 4rem)',
        overflowY: 'auto',
        position: 'relative'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
          <div>
            <h2 style={{ margin: 0, color: '#333', fontSize: window.innerWidth < 768 ? '1.125rem' : '1.25rem' }}>
              {step === 1 ? 'Client Information' : step === 2 ? 'Membership Information' : 'Payment & Confirmation'}
            </h2>
            <p style={{ margin: '0.125rem 0 0 0', fontSize: '0.75rem', color: '#666' }}>
              Step {step} of 3
            </p>
          </div>
          <button
            onClick={() => {
              setStep(1);
              onClose();
            }}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.75rem',
              cursor: 'pointer',
              color: '#999',
              padding: '0',
              lineHeight: '1',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
        </div>

        {loadingPlans ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <p>Loading membership plans...</p>
          </div>
        ) : step === 1 ? (
          /* Step 1: Client Information */
          <form onSubmit={handleStep1Submit} autoComplete="off">
          {/* Primary Member Section */}
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ marginBottom: '0.75rem', color: '#444', fontSize: '1rem', fontWeight: '600' }}>Primary Member</h3>
            <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth < 768 ? '1fr' : 'repeat(2, 1fr)', gap: window.innerWidth < 768 ? '0.75rem' : '0.875rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>First Name *</label>
                <input
                  type="text"
                  name="first_name"
                  value={primaryMember.first_name}
                  onChange={handlePrimaryMemberChange}
                  required
                  autoComplete="off"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Last Name *</label>
                <input
                  type="text"
                  name="last_name"
                  value={primaryMember.last_name}
                  onChange={handlePrimaryMemberChange}
                  required
                  autoComplete="off"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Email *</label>
                <input
                  type="email"
                  name="email"
                  value={primaryMember.email}
                  onChange={handlePrimaryMemberChange}
                  required
                  autoComplete="off"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Phone *</label>
                <input
                  type="tel"
                  name="phone"
                  value={primaryMember.phone}
                  onChange={handlePrimaryMemberChange}
                  required
                  autoComplete="off"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Date of Birth *</label>
                <input
                  type="date"
                  name="dob"
                  value={primaryMember.dob}
                  onChange={handlePrimaryMemberChange}
                  required
                  autoComplete="off"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Join Date *</label>
                <input
                  type="date"
                  name="join_date"
                  value={primaryMember.join_date || ''}
                  onChange={handlePrimaryMemberChange}
                  required
                  autoComplete="off"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Company</label>
                <input
                  type="text"
                  name="company"
                  value={primaryMember.company}
                  onChange={handlePrimaryMemberChange}
                  autoComplete="off"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Address *</label>
                <input
                  type="text"
                  name="address"
                  value={primaryMember.address}
                  onChange={handlePrimaryMemberChange}
                  required
                  autoComplete="off"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Address 2</label>
                <input
                  type="text"
                  name="address_2"
                  value={primaryMember.address_2}
                  onChange={handlePrimaryMemberChange}
                  autoComplete="off"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>City *</label>
                <input
                  type="text"
                  name="city"
                  value={primaryMember.city}
                  onChange={handlePrimaryMemberChange}
                  required
                  autoComplete="off"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>State *</label>
                <input
                  type="text"
                  name="state"
                  value={primaryMember.state}
                  onChange={handlePrimaryMemberChange}
                  required
                  maxLength={2}
                  autoComplete="off"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.875rem', textTransform: 'uppercase' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>ZIP *</label>
                <input
                  type="text"
                  name="zip"
                  value={primaryMember.zip}
                  onChange={handlePrimaryMemberChange}
                  required
                  maxLength={10}
                  autoComplete="off"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Country</label>
                <input
                  type="text"
                  name="country"
                  value={primaryMember.country}
                  onChange={handlePrimaryMemberChange}
                  placeholder="USA"
                  autoComplete="off"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                />
              </div>
            </div>
          </div>

          {/* Secondary Member Toggle */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
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
            <div style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ marginBottom: '0.75rem', color: '#444', fontSize: '1rem', fontWeight: '600' }}>Secondary Member</h3>
              <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth < 768 ? '1fr' : 'repeat(2, 1fr)', gap: window.innerWidth < 768 ? '0.75rem' : '0.875rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>First Name *</label>
                  <input
                    type="text"
                    name="first_name"
                    value={secondaryMember.first_name}
                    onChange={handleSecondaryMemberChange}
                    required
                    autoComplete="off"
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Last Name *</label>
                  <input
                    type="text"
                    name="last_name"
                    value={secondaryMember.last_name}
                    onChange={handleSecondaryMemberChange}
                    required
                    autoComplete="off"
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Email *</label>
                  <input
                    type="email"
                    name="email"
                    value={secondaryMember.email}
                    onChange={handleSecondaryMemberChange}
                    required
                    autoComplete="off"
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Phone *</label>
                  <input
                    type="tel"
                    name="phone"
                    value={secondaryMember.phone}
                    onChange={handleSecondaryMemberChange}
                    required
                    autoComplete="off"
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Date of Birth *</label>
                  <input
                    type="date"
                    name="dob"
                    value={secondaryMember.dob}
                    onChange={handleSecondaryMemberChange}
                    required
                    autoComplete="off"
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Photo URL</label>
                  <input
                    type="url"
                    name="photo"
                    value={secondaryMember.photo}
                    onChange={handleSecondaryMemberChange}
                    placeholder="https://..."
                    autoComplete="off"
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.5rem 1.25rem',
                background: '#f3f4f6',
                color: '#4b5563',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 500,
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: '0.5rem 1.25rem',
                background: '#2c5282',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 500,
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              Continue to Membership
            </button>
          </div>
        </form>
        ) : step === 2 ? (
          /* Step 2: Membership Information */
          <form onSubmit={handleStep2Submit} autoComplete="off">
            <div style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ marginBottom: '0.75rem', color: '#444', fontSize: '1rem', fontWeight: '600' }}>Membership Plan</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.875rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Membership Plan *</label>
                  <select
                    name="membership"
                    value={primaryMember.membership}
                    onChange={handlePrimaryMemberChange}
                    required
                    autoComplete="off"
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                  >
                    <option value="">Select a membership plan</option>
                    {membershipPlans.map(plan => (
                      <option key={plan.id} value={plan.plan_name}>
                        {plan.plan_name} - ${plan.monthly_price}/{plan.interval}
                        {plan.beverage_credit && ` (${plan.beverage_credit} beverage credit)`}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedPlan && (
                  <div style={{
                    padding: '0.75rem',
                    background: '#f7fafc',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <h4 style={{ margin: '0 0 0.375rem 0', fontSize: '0.8125rem', color: '#666', fontWeight: '600' }}>Plan Details</h4>
                    <div style={{ fontSize: '0.8125rem', color: '#333', lineHeight: '1.5' }}>
                      <div>💵 Price: <strong>${selectedPlan.monthly_price}/{selectedPlan.interval}</strong></div>
                      {selectedPlan.beverage_credit > 0 && (
                        <div>🍷 Beverage Credit: <strong>${selectedPlan.beverage_credit}</strong></div>
                      )}
                      {selectedPlan.additional_member_fee > 0 && (
                        <div>👥 Additional Member: <strong>${selectedPlan.additional_member_fee}/{selectedPlan.interval}</strong></div>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Referral Source</label>
                  <input
                    type="text"
                    name="referral"
                    value={primaryMember.referral}
                    onChange={handlePrimaryMemberChange}
                    placeholder="How did they hear about us?"
                    autoComplete="off"
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Photo URL</label>
                  <input
                    type="url"
                    name="photo"
                    value={primaryMember.photo}
                    onChange={handlePrimaryMemberChange}
                    placeholder="https://... (optional)"
                    autoComplete="off"
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                  />
                  <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem', marginBottom: 0 }}>
                    Optional: Direct link to member photo
                  </p>
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                style={{
                  padding: '0.5rem 1.25rem',
                  background: '#f3f4f6',
                  color: '#4b5563',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                ← Back
              </button>
              <button
                type="submit"
                style={{
                  padding: '0.5rem 1.25rem',
                  background: '#2c5282',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                Continue to Payment
              </button>
            </div>
          </form>
        ) : (
          /* Step 3: Payment */
          <div>
            {/* Membership Summary */}
            <div style={{
              padding: '0.875rem',
              background: '#f7fafc',
              borderRadius: '6px',
              marginBottom: '1.25rem',
              border: '1px solid #e2e8f0'
            }}>
              <h3 style={{ margin: '0 0 0.625rem 0', fontSize: '0.9375rem', color: '#333', fontWeight: '600' }}>
                Membership Summary
              </h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Primary Member:</span>
                <span style={{ fontWeight: '600', fontSize: '0.875rem' }}>{primaryMember.first_name} {primaryMember.last_name}</span>
              </div>
              {showSecondaryMember && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                  <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Secondary Member:</span>
                  <span style={{ fontWeight: '600', fontSize: '0.875rem' }}>{secondaryMember.first_name} {secondaryMember.last_name}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Membership Plan:</span>
                <span style={{ fontWeight: '600', fontSize: '0.875rem' }}>{primaryMember.membership}</span>
              </div>
              <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '0.625rem', paddingTop: '0.625rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: '700', fontSize: '1rem' }}>Total:</span>
                  <span style={{ fontWeight: '700', fontSize: '1rem', color: '#2c5282' }}>
                    ${selectedPlan ? (
                      selectedPlan.monthly_price + (showSecondaryMember ? (selectedPlan.additional_member_fee || 25) : 0)
                    ).toFixed(2) : '0.00'}/{selectedPlan?.interval || 'month'}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Form */}
            <Elements stripe={stripePromise}>
              <PaymentForm
                memberData={{
                  primaryMember,
                  secondaryMember: showSecondaryMember ? secondaryMember : null
                }}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
              />
            </Elements>

            {/* Back Button */}
            <button
              type="button"
              onClick={() => setStep(2)}
              style={{
                width: '100%',
                marginTop: '0.75rem',
                padding: '0.5rem 1.25rem',
                background: 'transparent',
                color: '#4b5563',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontWeight: 500,
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              ← Back to Membership Info
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddMemberModal; 