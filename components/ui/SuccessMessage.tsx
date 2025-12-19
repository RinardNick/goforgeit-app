/**
 * SuccessMessage Component
 *
 * Displays a standardized success message with green styling.
 * Eliminates duplicate success message markup across the application.
 */

interface SuccessMessageProps {
  message: string;
  testId?: string;
  className?: string;
}

export function SuccessMessage({ message, testId, className = '' }: SuccessMessageProps) {
  return (
    <div
      className={`p-4 bg-success/10 border border-success/20 rounded-lg ${className}`}
      data-testid={testId}
    >
      <div className="flex items-start gap-3">
        <svg className="w-5 h-5 text-success mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <p className="text-success text-sm">{message}</p>
      </div>
    </div>
  );
}
