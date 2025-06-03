import React, { useState, useEffect } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const PaymentMethods = ({ account_id, onClose }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddCard, setShowAddCard] = useState(false);
  const [cardError, setCardError] = useState(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (account_id) {
      fetchPaymentMethods();
    }
  }, [account_id]);

  const fetchPaymentMethods = async () => {
    try {
      const response = await fetch(`/api/listPaymentMethods?account_id=${account_id}`);
      if (!response.ok) throw new Error('Failed to fetch payment methods');
      const data = await response.json();
      setPaymentMethods(data.payment_methods);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (paymentMethodId) => {
    try {
      const response = await fetch('/api/setDefaultPaymentMethod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id, payment_method_id: paymentMethodId }),
      });
      if (!response.ok) throw new Error('Failed to set default payment method');
      await fetchPaymentMethods();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddCard = async (event) => {
    event.preventDefault();
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
      const response = await fetch('/api/setupPaymentMethod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id,
          payment_method_id: paymentMethod.id,
        }),
      });

      if (!response.ok) throw new Error('Failed to add payment method');
      
      await fetchPaymentMethods();
      setShowAddCard(false);
      elements.getElement(CardElement).clear();
    } catch (err) {
      setCardError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="text-center py-4">Loading payment methods...</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Payment Methods</h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {paymentMethods.map((method) => (
          <div
            key={method.id}
            className="flex items-center justify-between p-4 border rounded-lg"
          >
            <div className="flex items-center space-x-4">
              <div className="text-gray-600">
                {method.brand.toUpperCase()} •••• {method.last4}
              </div>
              <div className="text-sm text-gray-500">
                Expires {method.exp_month}/{method.exp_year}
              </div>
              {method.is_default && (
                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                  Default
                </span>
              )}
            </div>
            {!method.is_default && (
              <button
                onClick={() => handleSetDefault(method.id)}
                className="text-blue-600 hover:text-blue-800"
              >
                Set as Default
              </button>
            )}
          </div>
        ))}

        {showAddCard ? (
          <form onSubmit={handleAddCard} className="space-y-4">
            <div className="border rounded-lg p-4">
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
            {cardError && (
              <div className="text-red-600 text-sm">{cardError}</div>
            )}
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => setShowAddCard(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                disabled={processing}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                disabled={!stripe || processing}
              >
                {processing ? 'Adding...' : 'Add Card'}
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowAddCard(true)}
            className="w-full px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
          >
            + Add New Card
          </button>
        )}
      </div>
    </div>
  );
};

export default PaymentMethods; 