import React, { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import '../App.css';

export default function CreditCardHoldModal({ partySize, onSuccess, onCancel }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // Create a payment method
      const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: elements.getElement(CardElement),
      });

      if (stripeError) {
        setError(stripeError.message);
        setProcessing(false);
        return;
      }

      // Calculate hold amount ($25 per guest)
      const holdAmount = partySize * 25;

      // Call your backend to create the hold
      const response = await fetch('/api/create-hold', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentMethodId: paymentMethod.id,
          amount: holdAmount,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create hold');
      }

      onSuccess(result.holdId);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <h2>Credit Card Hold Required</h2>
        <p>
          A refundable hold of ${partySize * 25} (${25} per guest) will be placed on your card.
          This hold will be released after your visit.
        </p>
        
        <form onSubmit={handleSubmit}>
          <div className="form-row">
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
          
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
          
          <div className="button-row">
            <button
              type="button"
              onClick={onCancel}
              disabled={processing}
              className="cancel-button"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!stripe || processing}
              className="submit-button"
            >
              {processing ? 'Processing...' : 'Place Hold'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 