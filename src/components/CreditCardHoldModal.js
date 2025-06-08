import React, { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const CreditCardHoldModal = ({ partySize, reservationId, onSuccess, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError(null);

    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: elements.getElement(CardElement),
    });

    if (error) {
      setError(error.message);
      setProcessing(false);
      return;
    }

    try {
      const response = await fetch('/api/createReservationHold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_method_id: paymentMethod.id,
          party_size: partySize,
          reservation_id: reservationId
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create reservation hold');
      }

      onSuccess(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="credit-card-hold-modal">
      <h3>Credit Card Hold Required</h3>
      <p>
        A refundable hold of ${(partySize * 25).toFixed(2)} will be placed on your card
        to secure your reservation. This hold will be released after your visit.
      </p>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Card Details</label>
          <div className="card-element-container">
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
        </div>
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        <div className="modal-actions">
          <button
            type="button"
            onClick={onCancel}
            className="secondary"
            disabled={processing}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="primary"
            disabled={!stripe || processing}
          >
            {processing ? 'Processing...' : 'Confirm Hold'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreditCardHoldModal; 