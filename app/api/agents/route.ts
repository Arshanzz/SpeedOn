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

// Verify that the request is coming from a real logged-in Admin
async function verifyAdmin(req: Request) {
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

    if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
    return { error: 'Forbidden: Only Admins can manage field agents', status: 403 };
  }

  return { adminUser: user, supabaseAdmin };
}

// POST: Create a new Field Agent linked strictly to this Admin
export async function POST(req: Request) {
  try {
    const auth = await verifyAdmin(req);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { fullName, email, password } = await req.json();

    if (!fullName || !email || !password || password.length < 6) {
      return NextResponse.json(
        { error: 'Full name, valid email, and a password of at least 6 characters are required.' },
        { status: 400 }
      );
    }

    const { adminUser, supabaseAdmin } = auth;

    // 1. Create the agent's login account (auto-confirmed so they can log in immediately)
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
    });

    if (createError || !created.user) {
      return NextResponse.json(
        { error: createError?.message || 'Could not create agent account.' },
        { status: 400 }
      );
    }

    // 2. Link the agent to this Admin inside the profiles table
    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: created.user.id,
      email: email.trim().toLowerCase(),
      full_name: fullName.trim(),
      role: 'agent',
      admin_id: adminUser.id,
    });

    if (profileError) {
      // Roll back the Auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

// DELETE: Revoke a Field Agent's access immediately
export async function DELETE(req: Request) {
  try {
    const auth = await verifyAdmin(req);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { agentId } = await req.json();
    if (!agentId) {
      return NextResponse.json({ error: 'Missing agentId' }, { status: 400 });
    }

    const { adminUser, supabaseAdmin } = auth;

    // Security check: Ensure this agent actually belongs to the requesting Admin
    const { data: targetAgent } = await supabaseAdmin
      .from('profiles')
      .select('id, role, admin_id')
      .eq('id', agentId)
      .single();

    if (!targetAgent || targetAgent.role !== 'agent' || targetAgent.admin_id !== adminUser.id) {
      return NextResponse.json(
        { error: 'Agent not found or does not belong to your account.' },
        { status: 403 }
      );
    }

    // Deleting from auth.users automatically removes their profile via ON DELETE CASCADE
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(agentId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}