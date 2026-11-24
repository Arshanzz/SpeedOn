'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface AgentProfile {
  id: string;
  full_name: string | null;
  email: string;
  created_at: string;
}

export default function AgentManager({ accessToken }: { accessToken: string }) {
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function fetchAgents() {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, created_at')
      .eq('role', 'agent')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setAgents(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchAgents();
  }, []);

  async function handleAddAgent(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');
    setError('');

    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ fullName, email, password }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to add field agent.');
      }

      setMessage(`Field Agent "${fullName}" created! Share their email & password so they can log in.`);
      setFullName('');
      setEmail('');
      setPassword('');
      await fetchAgents();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveAgent(agent: AgentProfile) {
    const confirmed = window.confirm(
      `Remove field agent "${agent.full_name || agent.email}"?\n\nThey will immediately lose access to your vehicle data.`
    );
    if (!confirmed) return;

    setRemovingId(agent.id);
    setMessage('');
    setError('');

    try {
      const res = await fetch('/api/agents', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ agentId: agent.id }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to remove agent.');
      }

      setMessage(`Access revoked for ${agent.email}.`);
      await fetchAgents();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Add Field Agent Form */}
      <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
        <h2 className="text-base font-bold text-gray-800 mb-1">Add New Field Agent</h2>
        <p className="text-xs text-gray-500 mb-4">
          Only agents listed here can log in and view the Excel sheets you upload (strictly View-Only).
        </p>

        <form onSubmit={handleAddAgent} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            required
            placeholder="Agent Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="email"
            required
            placeholder="Agent Email (e.g. ravi@speedon.in)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            required
            minLength={6}
            placeholder="Temporary Password (6+ chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition disabled:bg-blue-300 cursor-pointer"
          >
            {submitting ? 'Creating...' : '+ Add Field Agent'}
          </button>
        </form>

        {message && (
          <div className="mt-3 p-2.5 bg-green-50 border border-green-200 text-green-700 text-xs font-medium rounded-lg">
            {message}
          </div>
        )}
        {error && (
          <div className="mt-3 p-2.5 bg-red-50 border border-red-200 text-red-600 text-xs font-medium rounded-lg">
            {error}
          </div>
        )}
      </div>

      {/* Active Field Agents List */}
      <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
        <h3 className="text-sm font-bold text-gray-800 mb-3">
          Your Authorized Field Agents ({agents.length})
        </h3>

        {loading ? (
          <p className="text-xs text-gray-500">Loading agents...</p>
        ) : agents.length === 0 ? (
          <p className="text-xs text-gray-500">No field agents added yet. Add your first agent above.</p>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-gray-600 text-xs">
                  <th className="p-3">Agent Name</th>
                  <th className="p-3">Login Email</th>
                  <th className="p-3">Added On</th>
                  <th className="p-3 text-right">Access</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => (
                  <tr key={agent.id} className="border-b last:border-b-0 hover:bg-gray-50">
                    <td className="p-3 font-semibold text-gray-800">{agent.full_name || '—'}</td>
                    <td className="p-3 text-gray-600">{agent.email}</td>
                    <td className="p-3 text-gray-500 text-xs">
                      {new Date(agent.created_at).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleRemoveAgent(agent)}
                        disabled={removingId === agent.id}
                        className="px-3 py-1 bg-red-50 text-red-600 border border-red-200 rounded-md text-xs font-semibold hover:bg-red-600 hover:text-white transition cursor-pointer disabled:opacity-50"
                      >
                        {removingId === agent.id ? 'Removing...' : 'Revoke Access'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}