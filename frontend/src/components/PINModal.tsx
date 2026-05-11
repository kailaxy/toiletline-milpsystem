import React, { useState, useEffect } from 'react';

const PIN_LENGTH = 4;

interface PINModalProps {
  isOpen: boolean;
  onSubmit: (pin: string) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  error?: string;
}

export const PINModal: React.FC<PINModalProps> = ({
  isOpen,
  onSubmit,
  onCancel,
  loading = false,
  error = '',
}) => {
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Clear PIN when modal closes
  useEffect(() => {
    if (!isOpen) {
      setPin('');
    }
  }, [isOpen]);

  const handleDigitClick = (digit: string) => {
    if (pin.length < PIN_LENGTH) {
      // Limit PIN to configured number of digits
      setPin(pin + digit);
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
  };

  const handleConfirm = async () => {
    if (pin.length === 0) return;
    setIsSubmitting(true);
    try {
      await onSubmit(pin);
      setPin('');
    } catch (err) {
      // Error is handled by parent component
      console.error('PIN submission error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setPin('');
    onCancel();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-sm mx-4">
        <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
          Enter Security PIN
        </h2>

        {/* PIN Display */}
        <div className="mb-8">
          <div className="bg-gray-100 rounded-lg p-4 text-center">
            <div className="text-4xl tracking-widest font-mono">
              {'●'.repeat(pin.length)}
              {pin.length < PIN_LENGTH && '○'.repeat(PIN_LENGTH - pin.length)}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm text-center">
            {error}
          </div>
        )}

        {/* Number Pad */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
            <button
              key={digit}
              onClick={() => handleDigitClick(digit.toString())}
              disabled={isSubmitting || loading || pin.length >= PIN_LENGTH}
              className="py-4 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-bold text-lg rounded-lg transition-colors"
            >
              {digit}
            </button>
          ))}

          {/* 0 button spans 2 columns */}
          <button
            onClick={() => handleDigitClick('0')}
            disabled={isSubmitting || loading || pin.length >= PIN_LENGTH}
            className="col-span-2 py-4 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-bold text-lg rounded-lg transition-colors"
          >
            0
          </button>

          {/* Backspace button */}
          <button
            onClick={handleBackspace}
            disabled={isSubmitting || loading || pin.length === 0}
            className="py-4 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white font-bold text-lg rounded-lg transition-colors"
          >
            ⌫
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleCancel}
            disabled={isSubmitting || loading}
            className="flex-1 py-3 bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 text-gray-800 font-semibold rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={pin.length === 0 || isSubmitting || loading}
            className="flex-1 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white font-semibold rounded-lg transition-colors"
          >
            {isSubmitting || loading ? 'Verifying...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};
