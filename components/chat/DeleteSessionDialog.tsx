/**
 * DeleteSessionDialog Component
 *
 * Confirmation dialog for deleting a chat session.
 * Shows a warning message and provides Cancel/Delete actions.
 */

interface DeleteSessionDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteSessionDialog({ isOpen, onCancel, onConfirm }: DeleteSessionDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        data-testid="delete-session-dialog"
        className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4"
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Session?</h3>
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to delete this session? This action cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            data-testid="confirm-delete-btn"
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
