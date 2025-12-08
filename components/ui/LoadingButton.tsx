/**
 * LoadingButton Component
 *
 * Standardized button with loading state support.
 * Provides consistent styling and behavior for action buttons across the application.
 */

interface LoadingButtonProps {
  isLoading: boolean;
  loadingText?: string;
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  className?: string;
  testId?: string;
  variant?: 'primary' | 'secondary' | 'success';
  icon?: React.ReactNode;
  type?: 'button' | 'submit' | 'reset';
}

export function LoadingButton({
  isLoading,
  loadingText = 'Loading...',
  children,
  onClick,
  disabled = false,
  className = '',
  testId,
  variant = 'primary',
  icon,
  type = 'button',
}: LoadingButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold rounded-lg transition-opacity disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    primary: 'bg-vibrant-orange text-white hover:opacity-90',
    secondary: 'bg-boulder-blue text-white hover:opacity-90',
    success: 'bg-green-600 hover:bg-green-700 text-white',
  };

  return (
    <button
      type={type}
      data-testid={testId}
      onClick={onClick}
      disabled={isLoading || disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    >
      {icon && !isLoading && <span>{icon}</span>}
      {isLoading ? loadingText : children}
    </button>
  );
}
