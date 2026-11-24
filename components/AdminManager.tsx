'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface AdminProfile {
  id: string;
  full_name: string | null;
  email: string;
  created_at: string;
}

export default function AdminManager({ accessToken }: { accessToken: string }) {
  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function fetchAdmins() {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, created_at')
      .eq('role', 'admin')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setAdmins(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchAdmins();
  }, []);

  async function handleAddAdmin(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');
    setError('');

    try {
      const res = await fetch('/api/admins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ fullName, email, password }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to create admin.');
      }

      setMessage(
        `Independent Admin "${fullName}" created! They now have their own completely isolated workspace.`
      );
      setFullName('');
      setEmail('');
      setPassword('');
      await fetchAdmins();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveAdmin(admin: AdminProfile) {
    const confirmed = window.confirm(
      `Permanently remove "${admin.full_name || admin.email}"?\n\nWARNING: This will delete their login, ALL of their field agents, and ALL Excel sheets/vehicles they uploaded.`
    );
    if (!confirmed) return;

    setRemovingId(admin.id);
    setMessage('');
    setError('');

    try {
      const res = await fetch('/api/admins', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ adminId: admin.id }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to remove admin.');
      }

      setMessage(`Removed admin "${admin.email}" and all linked data.`);
      await fetchAdmins();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Add Independent Admin Form */}
      <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
        <h2 className="text-base font-bold text-gray-800 mb-1">Add Independent Admin (Agency)</h2>
        <p className="text-xs text-gray-500 mb-4">
          Each Admin gets an isolated workspace for their own Excel uploads and Field Agents. Admins cannot see each other&apos;s data.
        </p>

        <form onSubmit={handleAddAdmin} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            required
            placeholder="Agency or Admin Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <input
            type="email"
            required
            placeholder="Admin Email (e.g. raj@agency.in)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <input
            type="text"
            required
            minLength={6}
            placeholder="Password (min 6 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition disabled:bg-purple-300 cursor-pointer"
          >
            {submitting ? 'Creating...' : '+ Add Admin'}
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

      {/* Independent Admins List */}
      <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
        <h3 className="text-sm font-bold text-gray-800 mb-3">
          Independent Admins ({admins.length})
        </h3>

        {loading ? (
          <p className="text-xs text-gray-500">Loading admins...</p>
        ) : admins.length === 0 ? (
          <p className="text-xs text-gray-500">
            No independent admins added yet. Use the form above to onboard your first agency.
          </p>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-gray-600 text-xs">
                  <th className="p-3">Agency / Admin Name</th>
                  <th className="p-3">Login Email</th>
                  <th className="p-3">Created On</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => (
                  <tr key={admin.id} className="border-b last:border-b-0 hover:bg-gray-50">
                    <td className="p-3 font-semibold text-gray-800">{admin.full_name || '—'}</td>
                    <td className="p-3 text-gray-600">{admin.email}</td>
                    <td className="p-3 text-gray-500 text-xs">
                      {new Date(admin.created_at).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleRemoveAdmin(admin)}
                        disabled={removingId === admin.id}
                        className="px-3 py-1 bg-red-50 text-red-600 border border-red-200 rounded-md text-xs font-semibold hover:bg-red-600 hover:text-white transition cursor-pointer disabled:opacity-50"
                      >
                        {removingId === admin.id ? 'Removing...' : 'Remove Admin'}
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