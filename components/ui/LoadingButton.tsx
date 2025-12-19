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
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'custom';
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
    primary: 'bg-primary text-primary-foreground hover:opacity-90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    success: 'bg-success text-success-foreground hover:bg-success/90',
    danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    custom: '',
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
