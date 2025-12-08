/**
 * ErrorMessage Component
 *
 * Standardized error display component used across the application.
 * Provides consistent styling and behavior for error messages.
 */

interface ErrorMessageProps {
  message: string;
  testId?: string;
  className?: string;
}

export function ErrorMessage({ message, testId, className = '' }: ErrorMessageProps) {
  return (
    <div
      className={`p-4 bg-red-50 border border-red-200 rounded-lg ${className}`}
      data-testid={testId}
    >
      <p className="text-red-600 text-sm">{message}</p>
    </div>
  );
}
