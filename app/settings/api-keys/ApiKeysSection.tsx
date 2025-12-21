'use client';

import React, { useState, useEffect } from 'react';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { SuccessMessage } from '@/components/ui/SuccessMessage';
import ForgeApiKeysSection from './ForgeApiKeysSection';

type Provider = 'google' | 'openai' | 'anthropic';

interface ProviderKeyInfo {
  provider: Provider;
  label: string | null;
  maskedKey: string;
  isValid: boolean;
  lastValidatedAt: string | null;
  createdAt: string;
}

interface ProviderConfig {
  id: Provider;
  name: string;
  description: string;
  keyPrefix: string;
  docsUrl: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'google',
    name: 'Google (Gemini)',
    description: 'Access Gemini models including 2.5 Flash, 1.5 Pro, and more.',
    keyPrefix: 'AIza...',
    docsUrl: 'https://ai.google.dev/tutorials/setup',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    ),
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'Access GPT-4o, GPT-4 Turbo, and other OpenAI models.',
    keyPrefix: 'sk-...',
    docsUrl: 'https://platform.openai.com/api-keys',
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364l2.0201-1.1638a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6099-1.4997Z"/>
      </svg>
    ),
  },
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    description: 'Access Claude 3.5 Sonnet, Claude 3 Opus, and other Claude models.',
    keyPrefix: 'sk-ant-...',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.304 3.498l-5.303 17.004h-3.317L14.027 3.498h3.277zm-6.292 0L5.71 20.502H2.39L7.735 3.498h3.277z"/>
      </svg>
    ),
  },
];

export default function ApiKeysSection() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [keys, setKeys] = useState<ProviderKeyInfo[]>([]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ProviderConfig | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<Provider | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchKeys();
  }, []);

  async function fetchKeys() {
    try {
      setLoading(true);
      const response = await fetch('/api/settings/provider-keys');
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Failed to fetch keys');

      setKeys(data.keys || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  }

  function getKeyForProvider(provider: Provider): ProviderKeyInfo | undefined {
    return keys.find((k) => k.provider === provider);
  }

  function openModal(provider: ProviderConfig) {
    setSelectedProvider(provider);
    setApiKeyInput('');
    setLabelInput('');
    setModalError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setSelectedProvider(null);
    setApiKeyInput('');
    setLabelInput('');
    setModalError(null);
  }

  async function handleSaveKey() {
    if (!selectedProvider) return;

    setSaving(true);
    setModalError(null);

    try {
      const response = await fetch('/api/settings/provider-keys', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider.id,
          apiKey: apiKeyInput,
          label: labelInput || undefined,
          validate: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save key');
      }

      setSuccess(`${selectedProvider.name} API key saved successfully!`);
      closeModal();
      await fetchKeys();

      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to save key');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteKey(provider: Provider) {
    setDeleting(true);

    try {
      const response = await fetch('/api/settings/provider-keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete key');
      }

      setSuccess('API key deleted successfully!');
      setDeleteConfirm(null);
      await fetchKeys();

      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete key');
    } finally {
      setDeleting(false);
    }
  }

  const hasAnyKeys = keys.length > 0;

  return (
    <div>
      <h2 className="text-2xl font-heading font-bold text-foreground mb-2">LLM Provider Keys</h2>
      <p className="text-muted-foreground mb-6">
        Configure your own API keys to use AI models. All organization members share these keys.
      </p>

      {error && <ErrorMessage message={error} className="mb-6" />}
      {success && <SuccessMessage message={success} className="mb-6" />}

      {!hasAnyKeys && !loading && (
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="font-semibold text-amber-800 dark:text-amber-200">No API keys configured</h3>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                You must add at least one provider API key to use AI agents. Choose a provider below to get started.
              </p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {PROVIDERS.map((provider) => {
            const keyInfo = getKeyForProvider(provider.id);
            const isConnected = !!keyInfo;

            return (
              <div
                key={provider.id}
                data-testid={`provider-card-${provider.id}`}
                className={`p-6 rounded-xl border transition-all ${
                  isConnected
                    ? 'bg-card border-border shadow-sm'
                    : 'bg-card/50 border-dashed border-border/50'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${provider.bgColor} ${provider.color}`}>
                    {provider.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-semibold text-foreground">{provider.name}</h3>
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          isConnected
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {isConnected ? 'Connected' : 'Not Connected'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{provider.description}</p>

                    {isConnected && keyInfo && (
                      <div className="flex items-center gap-4 text-sm">
                        <span className="font-mono bg-muted px-2 py-1 rounded text-foreground">
                          {keyInfo.maskedKey}
                        </span>
                        {keyInfo.label && (
                          <span className="text-muted-foreground">{keyInfo.label}</span>
                        )}
                        {keyInfo.lastValidatedAt && (
                          <span className="text-muted-foreground text-xs">
                            Validated {new Date(keyInfo.lastValidatedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isConnected ? (
                      <>
                        <button
                          onClick={() => openModal(provider)}
                          className="px-3 py-1.5 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 rounded-md transition-colors"
                        >
                          Update
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(provider.id)}
                          className="px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-colors"
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => openModal(provider)}
                        className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md transition-colors"
                      >
                        Configure
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ForgeApiKeysSection />

      {/* Modal for adding/updating key */}
      {modalOpen && selectedProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative bg-card rounded-xl shadow-xl border border-border w-full max-w-md mx-4 p-6">
            <h2 className="text-xl font-semibold text-foreground mb-1">
              Configure {selectedProvider.name}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Enter your API key to connect this provider.{' '}
              <a
                href={selectedProvider.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Get an API key
              </a>
            </p>

            {modalError && <ErrorMessage message={modalError} className="mb-4" />}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  name="apiKey"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={selectedProvider.keyPrefix}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Label (optional)
                </label>
                <input
                  type="text"
                  name="label"
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  placeholder="e.g., Production Key"
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveKey}
                disabled={!apiKeyInput || saving}
                className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-card rounded-xl shadow-xl border border-border w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-semibold text-foreground mb-2">Delete API Key?</h2>
            <p className="text-sm text-muted-foreground mb-4">
              This will remove the {PROVIDERS.find((p) => p.id === deleteConfirm)?.name} API key.
              Agents using this provider will stop working until a new key is added.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteKey(deleteConfirm)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
