import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/admins - List all admins
export async function GET() {
  try {
    // Fetch all admins from the admins table
    const { data: admins, error } = await supabase
      .from('admins')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching admins:', error);
      return NextResponse.json(
        { error: 'Failed to fetch admins' },
        { status: 500 }
      );
    }

    // Format admin data
    const formattedAdmins = admins.map(admin => ({
      id: admin.id,
      auth_user_id: admin.auth_user_id,
      email: admin.email,
      phone: admin.phone || '',
      first_name: admin.first_name,
      last_name: admin.last_name,
      access_level: admin.access_level,
      status: admin.status,
      created_at: admin.created_at,
      last_login_at: admin.last_login_at,
    }));

    return NextResponse.json({ data: formattedAdmins });
  } catch (error) {
    console.error('Error in GET /api/admins:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/admins - Create new admin
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, phone, first_name, last_name, access_level } = body;

    // Validate required fields
    if (!email || !password || !first_name || !last_name) {
      return NextResponse.json(
        { error: 'Email, password, first name, and last name are required' },
        { status: 400 }
      );
    }

    // Validate access level
    if (access_level && !['admin', 'super_admin'].includes(access_level)) {
      return NextResponse.json(
        { error: 'Invalid access level. Must be "admin" or "super_admin"' },
        { status: 400 }
      );
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        phone,
      },
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      );
    }

    // Create admin record in admins table
    const { data: adminData, error: adminError } = await supabase
      .from('admins')
      .insert({
        id: authData.user.id, // Set id to be the same as auth_user_id
        auth_user_id: authData.user.id,
        first_name,
        last_name,
        email,
        phone,
        access_level: access_level || 'admin',
        status: 'active',
        created_by: authData.user.id, // For now, self-created
      })
      .select()
      .single();

    if (adminError) {
      console.error('Error creating admin record:', adminError);
      // Try to clean up the created user
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: 'Failed to create admin record' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Admin created successfully',
      data: {
        id: adminData.id,
        auth_user_id: adminData.auth_user_id,
        email: adminData.email,
        phone: adminData.phone,
        first_name: adminData.first_name,
        last_name: adminData.last_name,
        access_level: adminData.access_level,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/admins:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/admins - Update admin
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, email, phone, first_name, last_name, access_level } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Admin ID is required' },
        { status: 400 }
      );
    }

    // Validate access level if provided
    if (access_level && !['admin', 'super_admin'].includes(access_level)) {
      return NextResponse.json(
        { error: 'Invalid access level. Must be "admin" or "super_admin"' },
        { status: 400 }
      );
    }

    // Update admin record
    const { error: updateError } = await supabase
      .from('admins')
      .update({
        email,
        phone,
        first_name,
        last_name,
        access_level,
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating admin:', updateError);
      return NextResponse.json(
        { error: 'Failed to update admin' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Admin updated successfully',
    });
  } catch (error) {
    console.error('Error in PUT /api/admins:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/admins - Remove admin
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Admin ID is required' },
        { status: 400 }
      );
    }

    // Get admin info before deletion for audit purposes
    const { data: adminData, error: fetchError } = await supabase
      .from('admins')
      .select('auth_user_id, email')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching admin for deletion:', fetchError);
      return NextResponse.json(
        { error: 'Admin not found' },
        { status: 404 }
      );
    }

    // Delete admin record (this will trigger audit logging)
    const { error: deleteError } = await supabase
      .from('admins')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting admin:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete admin' },
        { status: 500 }
      );
    }

    // Note: We don't delete the auth user - they can still log in as a regular user
    // If you want to completely remove the user, uncomment the following:
    // await supabase.auth.admin.deleteUser(adminData.auth_user_id);

    return NextResponse.json({
      success: true,
      message: 'Admin removed successfully',
    });
  } catch (error) {
    console.error('Error in DELETE /api/admins:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 