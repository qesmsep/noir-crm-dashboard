import React, { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import '../App.css';

export default function CreditCardHoldModal({ partySize, onSuccess, onCancel }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }

    // Validate form data
    if (!formData.firstName || !formData.lastName || !formData.email) {
      setError('Please fill in all required fields');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // Create a payment method
      const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: elements.getElement(CardElement),
        billing_details: {
          name: `${formData.firstName} ${formData.lastName}`,
          email: formData.email
        }
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
          customerInfo: formData
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create hold');
      }

      onSuccess(result.holdId, formData);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <h2>Complete Your Reservation</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>First Name *</label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              required
              placeholder="Enter your first name"
            />
          </div>

          <div className="form-group">
            <label>Last Name *</label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              required
              placeholder="Enter your last name"
            />
          </div>

          <div className="form-group">
            <label>Email *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="Enter your email"
            />
          </div>

          <div className="form-group">
            <p className="hold-notice">
              Thank you for your reservation. To hold your reservation we request a hold on the credit card. 
              This will be released upon your arrival.
            </p>
            <p className="hold-amount">
              A refundable hold of ${partySize * 25} (${25} per guest) will be placed on your card.
            </p>
            <label>Credit Card Information *</label>
            <div className="card-element-container" style={{ 
              padding: '12px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: 'white'
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
                      backgroundColor: 'white',
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
              {processing ? 'Processing...' : 'Complete Reservation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 