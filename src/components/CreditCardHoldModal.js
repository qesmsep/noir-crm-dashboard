import React, { useState } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
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
  const [clientSecret, setClientSecret] = useState(null);
  const [step, setStep] = useState(1);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // Step 1: Collect non-member info, then create PaymentIntent
  const handleInfoSubmit = async (event) => {
    event.preventDefault();
    if (!formData.firstName || !formData.lastName || !formData.email) {
      setError('Please fill in all required fields');
      return;
    }
    setProcessing(true);
    setError(null);
    try {
      const holdAmount = partySize * 25;
      const response = await fetch('/api/create-hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: holdAmount })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to create hold');
      setClientSecret(result.clientSecret);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  // Step 2: Show PaymentElement and confirm payment
  const handlePaymentSubmit = async (event) => {
    event.preventDefault();
    if (!stripe || !elements) {
      setError('Stripe is not loaded. Please try again in a moment.');
      return;
    }
    setProcessing(true);
    setError(null);
    try {
      const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          payment_method_data: {
            billing_details: {
              name: `${formData.firstName} ${formData.lastName}`.trim(),
              email: formData.email
            }
          },
          // return_url: window.location.href, // Not needed for holds
        },
        redirect: 'if_required',
      });
      if (stripeError) {
        setError(stripeError.message);
        setProcessing(false);
        return;
      }
      // Success! Pass paymentIntent id and customer info
      onSuccess(paymentIntent.id, formData);
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
        {step === 1 && (
          <form onSubmit={handleInfoSubmit}>
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
            </div>
            {error && (
              <div className="error-message">{error}</div>
            )}
            <div className="button-row">
              <button type="button" onClick={onCancel} disabled={processing} className="cancel-button">Cancel</button>
              <button type="submit" disabled={processing} className="submit-button">
                {processing ? 'Processing...' : 'Continue to Payment'}
              </button>
            </div>
          </form>
        )}
        {step === 2 && clientSecret && (
          <form onSubmit={handlePaymentSubmit}>
            <div className="form-group">
              <PaymentElement options={{ layout: 'tabs' }} />
            </div>
            {error && (
              <div className="error-message">{error}</div>
            )}
            <div className="button-row">
              <button type="button" onClick={onCancel} disabled={processing} className="cancel-button">Cancel</button>
              <button type="submit" disabled={processing} className="submit-button">
                {processing ? 'Processing...' : 'Complete Reservation'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
} 