'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import ChangePasswordModal from './ChangePasswordModal';

interface AgentDashboardProps {
  agentName: string;
  agentEmail: string;
  onLogout: () => void;
}

export default function AgentDashboard({
  agentName,
  agentEmail,
  onLogout,
}: AgentDashboardProps) {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const rowsPerPage = 30;

  const totalPages = Math.ceil(totalRows / rowsPerPage);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);

      let query = supabase.from('vehicles').select('*', { count: 'exact' });

      if (searchTerm.trim()) {
        const term = searchTerm.trim();
        query = query.or(
          `registration_number.ilike.%${term}%,chassis_number.ilike.%${term}%,customer_name.ilike.%${term}%`
        );
      }

      query = query.order('serial_number', { ascending: true });

      const from = page * rowsPerPage;
      const to = from + rowsPerPage - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (!error && data) {
        setVehicles(data);
        if (count !== null) setTotalRows(count);
      }
      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, page]);

  function getStatusBadge(status: string) {
    switch (status) {
      case 'Recovered':
        return 'bg-green-100 text-green-800';
      case 'Traced':
        return 'bg-blue-100 text-blue-800';
      case 'In Yard':
        return 'bg-purple-100 text-purple-800';
      case 'Released':
        return 'bg-gray-200 text-gray-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 font-sans pb-10">
      {/* Sticky Mobile-Friendly Header */}
      <header className="sticky top-0 z-10 bg-blue-700 text-white px-4 py-3 shadow-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight">SpeedOn Field</h1>
              <span className="text-[10px] uppercase font-bold bg-blue-900/70 px-2 py-0.5 rounded-full">
                View Only
              </span>
            </div>
            <p className="text-xs text-blue-100 truncate max-w-[200px]">
              {agentName || agentEmail}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPasswordModal(true)}
              className="px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
            >
              Password
            </button>
            <button
              onClick={onLogout}
              className="px-3 py-1.5 bg-red-500/80 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Big Thumb-Friendly Search Bar */}
        <div className="max-w-5xl mx-auto mt-3">
          <input
            type="search"
            placeholder="Type last 4 digits, Reg No, Chassis, or Name..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(0);
            }}
            className="w-full px-4 py-3 rounded-xl bg-white text-gray-900 text-base font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
        </div>
      </header>

      {/* Main Results Area */}
      <main className="max-w-5xl mx-auto px-4 mt-4">
        <div className="flex justify-between items-center text-xs text-gray-600 font-medium mb-3">
          <span>
            {loading ? 'Searching...' : `${totalRows.toLocaleString()} vehicles found`}
          </span>
          <span>
            Page {page + 1} of {totalPages || 1}
          </span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500 text-sm">Loading vehicles...</div>
        ) : vehicles.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center text-gray-500 text-sm border border-gray-200">
            No matching vehicles found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {vehicles.map((v) => (
              <div
                key={v.id}
                className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <div>
                      <p className="text-lg font-extrabold text-blue-700 tracking-wide">
                        {v.registration_number || 'NO REG NO'}
                      </p>
                      <p className="text-xs font-semibold text-gray-700">
                        {v.asset_description || 'Model Not Specified'}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${getStatusBadge(
                        v.status || 'Pending'
                      )}`}
                    >
                      {v.status || 'Pending'}
                    </span>
                  </div>

                  <div className="border-t border-gray-100 pt-2.5 mt-2 space-y-1 text-xs text-gray-600">
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-400">Customer:</span>
                      <span className="font-semibold text-gray-800 text-right">
                        {v.customer_name || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-400">Chassis:</span>
                      <span className="font-mono text-gray-800">{v.chassis_number || '—'}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-400">Engine:</span>
                      <span className="font-mono text-gray-800">{v.engine_number || '—'}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-400">LAN:</span>
                      <span className="text-gray-700">{v.lan || '—'}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-400">Branch / Region:</span>
                      <span className="text-gray-700">
                        {v.branch || '—'} ({v.region || '—'})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100 mt-3 pt-2 flex justify-between items-center text-xs">
                  <span className="text-gray-500">
                    BKT: <strong className="text-gray-800">{v.bkt ?? '—'}</strong> •{' '}
                    <span className="text-red-500 font-medium">{v.npa_stage || '—'}</span>
                  </span>
                  <span className="font-bold text-red-600">
                    Arrear: ₹{v.arrear_amount ?? 0}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-5 flex justify-between items-center gap-3">
            <button
              onClick={() => {
                setPage(page - 1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              disabled={page === 0}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-white border border-gray-300 text-gray-800 disabled:opacity-40 cursor-pointer"
            >
              Previous
            </button>
            <button
              onClick={() => {
                setPage(page + 1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              disabled={page >= totalPages - 1}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white disabled:opacity-40 cursor-pointer"
            >
              Next
            </button>
          </div>
        )}
      </main>

      {showPasswordModal && (
        <ChangePasswordModal
          userEmail={agentEmail}
          onClose={() => setShowPasswordModal(false)}
        />
      )}
    </div>
  );
}