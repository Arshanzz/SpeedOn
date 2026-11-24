import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error('Missing SUPABASE_SECRET_KEY in .env.local');
  }

  return createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Verify the request comes from a logged-in Super Admin
async function verifySuperAdmin(req: Request) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return { error: 'Unauthorized: Missing login token', status: 401 };
  }

  const supabaseAdmin = getSupabaseAdmin();
  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return { error: 'Unauthorized: Invalid session', status: 401 };
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'super_admin') {
    return { error: 'Forbidden: Only Super Admin can manage independent admins', status: 403 };
  }

  return { superAdminUser: user, supabaseAdmin };
}

// POST: Create a brand-new independent Admin with their own isolated workspace
export async function POST(req: Request) {
  try {
    const auth = await verifySuperAdmin(req);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { fullName, email, password } = await req.json();

    if (!fullName || !email || !password || password.length < 6) {
      return NextResponse.json(
        { error: 'Admin/Agency name, valid email, and a password of at least 6 characters are required.' },
        { status: 400 }
      );
    }

    const { supabaseAdmin } = auth;

    // 1. Create the Admin's Auth login
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
    });

    if (createError || !created.user) {
      return NextResponse.json(
        { error: createError?.message || 'Could not create admin account.' },
        { status: 400 }
      );
    }

    // 2. Link admin_id to THEIR OWN user ID so their data & agents stay 100% isolated
    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: created.user.id,
      email: email.trim().toLowerCase(),
      full_name: fullName.trim(),
      role: 'admin',
      admin_id: created.user.id,
    });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

// DELETE: Remove an independent Admin along with all their agents, sheets, and vehicles
export async function DELETE(req: Request) {
  try {
    const auth = await verifySuperAdmin(req);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { adminId } = await req.json();
    if (!adminId) {
      return NextResponse.json({ error: 'Missing adminId' }, { status: 400 });
    }

    const { supabaseAdmin } = auth;

    // Ensure the target is an independent Admin (prevents deleting a super_admin)
    const { data: targetAdmin } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', adminId)
      .single();

    if (!targetAdmin || targetAdmin.role !== 'admin') {
      return NextResponse.json({ error: 'Independent admin account not found.' }, { status: 404 });
    }

    // 1. Delete all Field Agents belonging to this Admin from Auth first
    const { data: linkedAgents } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('admin_id', adminId)
      .eq('role', 'agent');

    if (linkedAgents && linkedAgents.length > 0) {
      for (const agent of linkedAgents) {
        await supabaseAdmin.auth.admin.deleteUser(agent.id);
      }
    }

    // 2. Delete the Admin from Auth (ON DELETE CASCADE removes their profile, sheets, and vehicles)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(adminId);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}