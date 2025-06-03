import React, { useState, useEffect } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

export default function PaymentMethods({ member, onClose }) {
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddCard, setShowAddCard] = useState(false);
  const [cardError, setCardError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const stripe = useStripe();
  const elements = useElements();

  useEffect(() => {
    fetchPaymentMethods();
  }, [member.member_id]);

  const fetchPaymentMethods = async () => {
    try {
      const res = await fetch(`/api/listPaymentMethods?member_id=${member.member_id}`);
      const data = await res.json();
      if (res.ok) {
        setPaymentMethods(data.paymentMethods);
      } else {
        setError(data.error || 'Failed to load payment methods');
      }
    } catch (err) {
      setError('Failed to load payment methods');
    }
    setLoading(false);
  };

  const handleSetDefault = async (paymentMethodId) => {
    try {
      const res = await fetch('/api/setDefaultPaymentMethod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: member.member_id,
          payment_method_id: paymentMethodId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        // Refresh payment methods
        fetchPaymentMethods();
      } else {
        setError(data.error || 'Failed to set default payment method');
      }
    } catch (err) {
      setError('Failed to set default payment method');
    }
  };

  const handleAddCard = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setCardError(null);

    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: elements.getElement(CardElement),
    });

    if (error) {
      setCardError(error.message);
      setProcessing(false);
      return;
    }

    try {
      const res = await fetch('/api/setupPaymentMethod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: member.member_id,
          payment_method_id: paymentMethod.id,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowAddCard(false);
        fetchPaymentMethods();
      } else {
        setCardError(data.error || 'Failed to add card');
      }
    } catch (err) {
      setCardError('Failed to add card');
    }
    setProcessing(false);
  };

  if (loading) {
    return <div>Loading payment methods...</div>;
  }

  return (
    <div style={{ padding: '1rem' }}>
      <h3>Payment Methods</h3>
      {error && <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}
      
      {paymentMethods.length > 0 ? (
        <div style={{ marginBottom: '1rem' }}>
          {paymentMethods.map((pm) => (
            <div
              key={pm.id}
              style={{
                padding: '1rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                marginBottom: '0.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <strong>{pm.brand.toUpperCase()}</strong> ending in {pm.last4}
                <div style={{ fontSize: '0.9rem', color: '#666' }}>
                  Expires {pm.exp_month}/{pm.exp_year}
                </div>
              </div>
              {pm.isDefault ? (
                <span style={{ color: '#666' }}>Default</span>
              ) : (
                <button
                  onClick={() => handleSetDefault(pm.id)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#a59480',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Set as Default
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ marginBottom: '1rem', color: '#666' }}>No payment methods found</div>
      )}

      {showAddCard ? (
        <form onSubmit={handleAddCard} style={{ marginTop: '1rem' }}>
          <div style={{ marginBottom: '1rem' }}>
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
                  invalid: {
                    color: '#9e2146',
                  },
                },
              }}
            />
          </div>
          {cardError && <div style={{ color: 'red', marginBottom: '1rem' }}>{cardError}</div>}
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              type="submit"
              disabled={!stripe || processing}
              style={{
                padding: '0.5rem 1rem',
                background: '#a59480',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {processing ? 'Adding...' : 'Add Card'}
            </button>
            <button
              type="button"
              onClick={() => setShowAddCard(false)}
              style={{
                padding: '0.5rem 1rem',
                background: '#e5e1d8',
                color: '#555',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowAddCard(true)}
          style={{
            padding: '0.5rem 1rem',
            background: '#a59480',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Add New Card
        </button>
      )}
    </div>
  );
} 