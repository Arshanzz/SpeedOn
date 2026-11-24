'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import LoginForm from '../components/LoginForm';
import ExcelUpload from '../components/ExcelUpload';
import AgentManager from '../components/AgentManager';
import AgentDashboard from '../components/AgentDashboard';
import AdminManager from '../components/AdminManager';
import ChangePasswordModal from '../components/ChangePasswordModal';

const STATUS_OPTIONS = ['Pending', 'Traced', 'Recovered', 'In Yard', 'Released'];

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'super_admin' | 'admin' | 'agent';
  admin_id: string;
}

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'vehicles' | 'agents' | 'admins'>('vehicles');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const loadedUserIdRef = useRef<string | null>(null);

  // Admin Dashboard Data State
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [totalRows, setTotalRows] = useState(0);
  const [jumpSno, setJumpSno] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    recovered: 0,
    inYard: 0,
  });

  const totalPages = Math.ceil(totalRows / rowsPerPage);

  // 1. Check session & fetch user's role from 'profiles'
  async function loadUserProfile(currentSession: any) {
    if (!currentSession) {
      loadedUserIdRef.current = null;
      setProfile(null);
      setAuthLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentSession.user.id)
      .single();

    if (!error && data) {
      loadedUserIdRef.current = currentSession.user.id;
      setProfile(data as UserProfile);
    } else {
      loadedUserIdRef.current = null;
      setProfile(null);
    }
    setAuthLoading(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      loadUserProfile(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'SIGNED_OUT' || !newSession) {
        loadedUserIdRef.current = null;
        setProfile(null);
        setAuthLoading(false);
      } else if (loadedUserIdRef.current !== newSession.user.id) {
        setAuthLoading(true);
        loadUserProfile(newSession);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Fetch Admin stats (runs for both Admin and Super Admin)
  async function fetchStats() {
    const [totalRes, pendingRes, recoveredRes, inYardRes] = await Promise.all([
      supabase.from('vehicles').select('*', { count: 'exact', head: true }),
      supabase.from('vehicles').select('*', { count: 'exact', head: true }).eq('status', 'Pending'),
      supabase.from('vehicles').select('*', { count: 'exact', head: true }).eq('status', 'Recovered'),
      supabase.from('vehicles').select('*', { count: 'exact', head: true }).eq('status', 'In Yard'),
    ]);

    setStats({
      total: totalRes.count || 0,
      pending: pendingRes.count || 0,
      recovered: recoveredRes.count || 0,
      inYard: inYardRes.count || 0,
    });
  }

  useEffect(() => {
    if (session && (profile?.role === 'admin' || profile?.role === 'super_admin')) {
      fetchStats();
    }
  }, [session, profile, refreshKey]);

  // 3. Fetch Admin vehicle table (runs for both Admin and Super Admin)
  useEffect(() => {
    if (!session || (profile?.role !== 'admin' && profile?.role !== 'super_admin')) return;

    const timer = setTimeout(async () => {
      setLoading(true);

      let query = supabase.from('vehicles').select('*', { count: 'exact' });

      if (searchTerm) {
        query = query.or(
          `registration_number.ilike.%${searchTerm}%,customer_name.ilike.%${searchTerm}%,chassis_number.ilike.%${searchTerm}%`
        );
      }

      if (statusFilter !== 'All') {
        query = query.eq('status', statusFilter);
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
  }, [session, profile, page, searchTerm, rowsPerPage, statusFilter, refreshKey]);

  async function handleStatusChange(vehicleId: string, newStatus: string) {
    const { error } = await supabase
      .from('vehicles')
      .update({ status: newStatus })
      .eq('id', vehicleId);

    if (error) {
      alert('Failed to update status: ' + error.message);
      return;
    }

    setVehicles((prev) =>
      prev.map((v) => (v.id === vehicleId ? { ...v, status: newStatus } : v))
    );
    fetchStats();
  }

  function handleUploadComplete() {
    setPage(0);
    setRefreshKey((prev) => prev + 1);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  function getStatusStyle(status: string) {
    switch (status) {
      case 'Recovered':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'Traced':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'In Yard':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'Released':
        return 'bg-gray-200 text-gray-800 border-gray-300';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
        Loading SpeedOn...
      </div>
    );
  }

  if (!session) {
    return <LoginForm />;
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Access Not Configured</h2>
        <p className="text-sm text-gray-600 mb-4">
          Your account is not linked to an Admin profile. Please contact your administrator.
        </p>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg cursor-pointer"
        >
          Logout
        </button>
      </div>
    );
  }

  // FIELD AGENT VIEW (Strictly View-Only & Mobile-First)
  if (profile.role === 'agent') {
    return (
      <AgentDashboard
        agentName={profile.full_name || ''}
        agentEmail={profile.email}
        onLogout={handleLogout}
      />
    );
  }

  // ADMIN & SUPER ADMIN DASHBOARD VIEW
  return (
    <main className="p-4 md:p-8 font-sans bg-gray-50 min-h-screen">
      {/* Top Header */}
      <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">SpeedOn Admin</h1>
          <p className="text-xs text-gray-500">Multi-tenant recovery management console</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs md:text-sm text-gray-600 bg-white px-3 py-1.5 rounded-lg border border-gray-200">
            {session.user.email}
          </span>
          <button
            onClick={() => setShowPasswordModal(true)}
            className="px-3 py-1.5 bg-white text-gray-700 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-100 transition cursor-pointer"
          >
            Change Password
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition cursor-pointer"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab('vehicles')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
            activeTab === 'vehicles'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
          }`}
        >
          Vehicles &amp; Excel Sheets
        </button>
        <button
          onClick={() => setActiveTab('agents')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
            activeTab === 'agents'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
          }`}
        >
          Manage Field Agents
        </button>
        {profile.role === 'super_admin' && (
          <button
            onClick={() => setActiveTab('admins')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
              activeTab === 'admins'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-white text-purple-700 border border-purple-200 hover:bg-purple-50'
            }`}
          >
            Manage Admins (Super Admin)
          </button>
        )}
      </div>

      {/* Active Tab Content */}
      {activeTab === 'admins' && profile.role === 'super_admin' ? (
        <AdminManager accessToken={session.access_token} />
      ) : activeTab === 'agents' ? (
        <AgentManager accessToken={session.access_token} />
      ) : (
        <>
          {/* Live Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <p className="text-xs font-semibold text-gray-500 uppercase">Total Vehicles</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{stats.total.toLocaleString()}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-yellow-200 shadow-sm">
              <p className="text-xs font-semibold text-yellow-700 uppercase">Pending</p>
              <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.pending.toLocaleString()}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-green-200 shadow-sm">
              <p className="text-xs font-semibold text-green-700 uppercase">Recovered</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.recovered.toLocaleString()}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-purple-200 shadow-sm">
              <p className="text-xs font-semibold text-purple-700 uppercase">In Yard</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">{stats.inYard.toLocaleString()}</p>
            </div>
          </div>

          {/* Excel Sheet Manager */}
          <ExcelUpload
            onUploadComplete={handleUploadComplete}
            userId={session.user.id}
            userEmail={session.user.email}
          />

          {/* Search Bar & Status Filter */}
          <div className="mb-6 flex flex-wrap gap-4 items-center">
            <input
              type="text"
              placeholder="Search by Reg No, Chassis No, or Customer Name..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(0);
                setJumpSno('');
              }}
              className="w-full max-w-xl px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
            />

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
                setJumpSno('');
              }}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Statuses</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          {/* Data Table */}
          <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm mb-4">
            <table className="w-full text-left border-collapse bg-white whitespace-nowrap">
              <thead>
                <tr className="bg-gray-100 border-b text-gray-600 text-sm">
                  <th className="p-4">S.No</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Reg No.</th>
                  <th className="p-4">Customer Name</th>
                  <th className="p-4">Chassis Number</th>
                  <th className="p-4">Engine Number</th>
                  <th className="p-4">Asset Model</th>
                  <th className="p-4">LAN</th>
                  <th className="p-4">Region</th>
                  <th className="p-4">Branch</th>
                  <th className="p-4">Product</th>
                  <th className="p-4">BKT</th>
                  <th className="p-4">NPA Stage</th>
                  <th className="p-4">EMI (₹)</th>
                  <th className="p-4">Arrear (₹)</th>
                  <th className="p-4">POS (₹)</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={16} className="p-10 text-center text-gray-500">
                      Loading data...
                    </td>
                  </tr>
                ) : vehicles.length === 0 ? (
                  <tr>
                    <td colSpan={16} className="p-10 text-center text-gray-500">
                      No vehicles found.
                    </td>
                  </tr>
                ) : (
                  vehicles.map((vehicle) => (
                    <tr key={vehicle.id} className="border-b hover:bg-gray-50">
                      <td className="p-4 text-gray-800 font-bold">{vehicle.serial_number}</td>
                      <td className="p-4">
                        <select
                          value={vehicle.status || 'Pending'}
                          onChange={(e) => handleStatusChange(vehicle.id, e.target.value)}
                          className={`px-2.5 py-1 rounded-full text-xs font-bold border cursor-pointer focus:outline-none ${getStatusStyle(
                            vehicle.status || 'Pending'
                          )}`}
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status} className="bg-white text-gray-800">
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-4 font-semibold text-blue-600">{vehicle.registration_number}</td>
                      <td className="p-4 text-gray-800 font-medium">{vehicle.customer_name}</td>
                      <td className="p-4 text-gray-600">{vehicle.chassis_number}</td>
                      <td className="p-4 text-gray-600">{vehicle.engine_number}</td>
                      <td className="p-4 text-gray-600">{vehicle.asset_description}</td>
                      <td className="p-4 text-gray-500">{vehicle.lan}</td>
                      <td className="p-4 text-gray-600">{vehicle.region}</td>
                      <td className="p-4 text-gray-600">{vehicle.branch}</td>
                      <td className="p-4 text-gray-600">{vehicle.product}</td>
                      <td className="p-4 text-gray-600">{vehicle.bkt}</td>
                      <td className="p-4 text-red-500 font-medium">{vehicle.npa_stage}</td>
                      <td className="p-4 text-gray-600">{vehicle.emi}</td>
                      <td className="p-4 text-red-600 font-bold">{vehicle.arrear_amount}</td>
                      <td className="p-4 text-gray-600">{vehicle.pos}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Bar */}
          <div className="flex flex-wrap justify-between items-center gap-4 bg-white p-4 border border-gray-200 rounded-lg shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm text-gray-600 font-medium">Rows:</label>
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setPage(0);
                  setJumpSno('');
                }}
                className="border border-gray-300 rounded-md p-1.5 text-sm text-gray-800"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value={500}>500</option>
              </select>
              <span className="text-sm text-blue-600 font-semibold border-l pl-3">
                Showing: {totalRows.toLocaleString()}
              </span>
              <div className="text-sm text-gray-600 flex items-center gap-2 font-medium border-l pl-3">
                Jump to S.No:
                <input
                  type="number"
                  min={1}
                  max={totalRows || 1}
                  value={jumpSno}
                  placeholder="500"
                  onChange={(e) => {
                    const val = e.target.value;
                    setJumpSno(val);
                    const sno = Number(val);
                    if (sno > 0 && sno <= totalRows) {
                      setPage(Math.floor((sno - 1) / rowsPerPage));
                    }
                  }}
                  className="border border-gray-300 rounded-md w-20 text-center p-1.5 text-gray-800"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setPage(page - 1);
                  setJumpSno('');
                }}
                disabled={page === 0}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  page === 0
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                Prev
              </button>

              <span className="text-sm text-gray-600 font-medium">
                Page {page + 1} of {totalPages || 1}
              </span>

              <button
                onClick={() => {
                  setPage(page + 1);
                  setJumpSno('');
                }}
                disabled={page >= totalPages - 1}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  page >= totalPages - 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {showPasswordModal && (
        <ChangePasswordModal
          userEmail={session.user.email || ''}
          onClose={() => setShowPasswordModal(false)}
        />
      )}
    </main>
  );
}