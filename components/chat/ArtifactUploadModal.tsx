/**
 * ArtifactUploadModal Component
 *
 * Modal for uploading artifacts to ADK.
 * Supports both session-scoped and user-scoped artifacts.
 */

import { LoadingButton } from '@/components/ui/LoadingButton';
import { ErrorMessage } from '@/components/ui/ErrorMessage';

interface ArtifactUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  uploadFilename: string;
  setUploadFilename: (filename: string) => void;
  uploadFile: File | null;
  setUploadFile: (file: File | null) => void;
  uploadError: string | null;
  isUploading: boolean;
  onUpload: () => void;
}

export function ArtifactUploadModal({
  isOpen,
  onClose,
  uploadFilename,
  setUploadFilename,
  uploadFile,
  setUploadFile,
  uploadError,
  isUploading,
  onUpload,
}: ArtifactUploadModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Artifact</h3>

        <div className="space-y-4">
          {/* Filename Input */}
          <div>
            <label htmlFor="artifact-filename" className="block text-sm font-medium text-gray-700 mb-1">
              Filename
            </label>
            <input
              id="artifact-filename"
              data-testid="artifact-upload-filename"
              type="text"
              value={uploadFilename}
              onChange={(e) => setUploadFilename(e.target.value)}
              placeholder="e.g., user:myfile.txt or report.pdf"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Prefix with &ldquo;user:&rdquo; for user-scoped artifacts (persist across sessions)
            </p>
          </div>

          {/* File Input */}
          <div>
            <label htmlFor="artifact-file" className="block text-sm font-medium text-gray-700 mb-1">
              File
            </label>
            <input
              id="artifact-file"
              data-testid="artifact-upload-file-input"
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setUploadFile(file);
                  // Auto-suggest filename if not already filled
                  if (!uploadFilename) {
                    setUploadFilename(file.name);
                  }
                }
              }}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"
            />
          </div>

          {/* Error Message */}
          {uploadError && <ErrorMessage message={uploadError} />}
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={isUploading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <LoadingButton
            onClick={onUpload}
            disabled={!uploadFile || !uploadFilename}
            isLoading={isUploading}
            loadingText="Uploading..."
            className="text-sm text-white bg-amber-600 hover:bg-amber-700"
            testId="artifact-upload-submit"
            variant="primary"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            }
          >
            Upload
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}
