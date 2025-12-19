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
      className={`p-4 bg-destructive/10 border border-destructive/20 rounded-lg ${className}`}
      data-testid={testId}
    >
      <p className="text-destructive text-sm">{message}</p>
    </div>
  );
}
