'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { SuccessMessage } from '@/components/ui/SuccessMessage';
import { Plus, Trash2, Key, Shield, ShieldCheck, Check, X } from 'lucide-react';

interface ForgeApiKey {
  id: string;
  name: string;
  description?: string;
  key_prefix: string;
  scoped_agents: string[] | null;
  org_id: string;
  created_at: string;
  last_used_at?: string;
  revoked_at?: string;
}

interface Agent {
  id: string; // The slug/name
  uuid: string; // The DB UUID
  name: string; // The display name
}

export default function ForgeApiKeysSection() {
  const [loading, setLoading] = useState(true);
  const [keys, setKeys] = useState<ForgeApiKey[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyDescription, setNewKeyDescription] = useState('');
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [isOrgWide, setIsOrgWide] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [keysRes, agentsRes] = await Promise.all([
        fetch('/api/api-keys'),
        fetch('/api/agents')
      ]);

      const keysData = await keysRes.json();
      const agentsData = await agentsRes.json();

      if (!keysRes.ok) throw new Error(keysData.error || 'Failed to fetch API keys');
      if (!agentsRes.ok) throw new Error(agentsData.error || 'Failed to fetch agents');

      setKeys(keysData.keys || []);
      // Map agents to simple list
      setAgents(agentsData.agents || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateKey = async () => {
    setSaving(true);
    setError(null);
    try {
      // For scoping, we need the UUIDs of the agents, not just the names.
      // Wait, /api/agents returns { id: name, name: display_name, projectId }.
      // But the scoped_agents column in DB is UUID[].
      // I need to make sure /api/agents returns the UUID as well.
      // Looking back at app/api/agents/route.ts, it DOES NOT return the UUID from agents table!
      // It returns name as ID.
      
      // I need to fix app/api/agents/route.ts to return the UUID.
      
      const response = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newKeyName,
          description: newKeyDescription,
          scopedAgents: isOrgWide ? [] : selectedAgentIds
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create key');

      setCreatedKey(data.apiKey);
      await fetchData();
      setSuccess('API key created successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create key');
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) return;

    try {
      const response = await fetch('/api/api-keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to revoke key');
      }

      setSuccess('API key revoked.');
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke key');
    }
  };

  const toggleAgent = (agentId: string) => {
    setSelectedAgentIds(prev => 
      prev.includes(agentId) 
        ? prev.filter(id => id !== agentId) 
        : [...prev, agentId]
    );
  };

  const openModal = () => {
    setNewKeyName('');
    setNewKeyDescription('');
    setSelectedAgentIds([]);
    setIsOrgWide(true);
    setCreatedKey(null);
    setIsModalOpen(true);
  };

  return (
    <div className="mt-12 pt-12 border-t border-border">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-heading font-bold text-foreground mb-2">Forge API Keys</h2>
          <p className="text-muted-foreground">
            Manage keys for external applications to securely access your agents via API.
          </p>
        </div>
        <button
          onClick={openModal}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          New API Key
        </button>
      </div>

      {error && <ErrorMessage message={error} className="mb-6" />}
      {success && <SuccessMessage message={success} className="mb-6" />}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="px-6 py-4 text-sm font-semibold text-foreground">Name</th>
                <th className="px-6 py-4 text-sm font-semibold text-foreground">Status</th>
                <th className="px-6 py-4 text-sm font-semibold text-foreground">Scope</th>
                <th className="px-6 py-4 text-sm font-semibold text-foreground">Last Used</th>
                <th className="px-6 py-4 text-sm font-semibold text-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y border-border">
              {keys.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Key className="w-8 h-8 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground font-medium">No Forge API keys found</p>
                      <p className="text-xs text-muted-foreground/60">Create one to start integrating with external apps.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                keys.map((key) => (
                  <tr key={key.id} className={key.revoked_at ? 'opacity-50 grayscale' : ''}>
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground">{key.name}</div>
                      <div className="text-xs font-mono text-muted-foreground">{key.key_prefix}</div>
                    </td>
                    <td className="px-6 py-4">
                      {key.revoked_at ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                          Revoked
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {(!key.scoped_agents || key.scoped_agents.length === 0) ? (
                        <div className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400 font-medium">
                          <ShieldCheck className="w-4 h-4" />
                          Org-Wide
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-sm text-primary font-medium">
                          <Shield className="w-4 h-4" />
                          {key.scoped_agents.length} Agent{key.scoped_agents.length > 1 ? 's' : ''}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {!key.revoked_at && (
                        <button
                          onClick={() => handleRevokeKey(key.id)}
                          className="p-2 text-muted-foreground hover:text-red-600 transition-colors"
                          title="Revoke Key"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !createdKey && setIsModalOpen(false)} />
          <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="text-xl font-bold text-foreground">Create Forge API Key</h3>
              {!createdKey && (
                <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="p-6">
              {createdKey ? (
                <div className="space-y-6">
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-200 text-sm">
                    <strong>Important:</strong> Copy this key now. It will not be shown again for security reasons.
                  </div>
                  <div className="relative group">
                    <div className="p-4 bg-muted font-mono break-all pr-12 rounded-lg border border-border">
                      {createdKey}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(createdKey);
                        setSuccess('Copied to clipboard!');
                      }}
                      className="absolute top-1/2 -translate-y-1/2 right-3 p-2 bg-background border border-border rounded hover:bg-muted transition-colors"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="w-full py-2 bg-primary text-primary-foreground rounded-lg font-medium"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Key Name</label>
                      <input
                        type="text"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        placeholder="e.g. Mobile-App-Integration"
                        className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Description (Optional)</label>
                      <input
                        type="text"
                        value={newKeyDescription}
                        onChange={(e) => setNewKeyDescription(e.target.value)}
                        placeholder="What is this key for?"
                        className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold">Key Scoping</label>
                      <div className="flex bg-muted rounded-lg p-1">
                        <button
                          onClick={() => setIsOrgWide(true)}
                          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${isOrgWide ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
                        >
                          Org-Wide
                        </button>
                        <button
                          onClick={() => setIsOrgWide(false)}
                          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${!isOrgWide ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
                        >
                          Specific Agents
                        </button>
                      </div>
                    </div>

                    {!isOrgWide && (
                      <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border border-border rounded-lg bg-muted/20">
                        {agents.map((agent) => (
                          <button
                            key={agent.uuid}
                            onClick={() => toggleAgent(agent.uuid)}
                            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-all ${
                              selectedAgentIds.includes(agent.uuid)
                                ? 'bg-primary/10 border-primary text-primary'
                                : 'bg-background border-border text-muted-foreground hover:border-primary/50'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedAgentIds.includes(agent.uuid) ? 'bg-primary border-primary' : 'border-border'}`}>
                              {selectedAgentIds.includes(agent.uuid) && <Check className="w-3 h-3 text-white" />}
                            </div>
                            {agent.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-border">
                    <button
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateKey}
                      disabled={!newKeyName || saving || (!isOrgWide && selectedAgentIds.length === 0)}
                      className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {saving ? 'Creating...' : 'Create API Key'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
