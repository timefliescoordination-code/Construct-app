import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) }
  }

  return { user }
}

export async function GET() {
  try {
    const auth = await requireAdmin()
    if ("error" in auth) return auth.error

    const adminClient = createAdminClient()
    const { data: profiles, error: profilesError } = await adminClient
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })

    if (profilesError) {
      console.error("Error fetching users:", profilesError)
      return NextResponse.json({ error: profilesError.message }, { status: 400 })
    }

    const { data: credentials } = await adminClient.from("user_credentials").select("user_id, password")

    const passwordByUserId = new Map(
      (credentials ?? []).map((row) => [row.user_id, row.password]),
    )

    const users = (profiles ?? []).map((profile) => ({
      ...profile,
      password: passwordByUserId.get(profile.id) ?? null,
    }))

    return NextResponse.json({ users })
  } catch (error) {
    console.error("Error in list users API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdmin()
    if ("error" in auth) return auth.error

    const body = await request.json()
    const { id, password } = body

    if (!id || !password) {
      return NextResponse.json({ error: "User ID and password are required" }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
    }

    let adminClient
    try {
      adminClient = createAdminClient()
    } catch (configError) {
      const message =
        configError instanceof Error ? configError.message : "Admin API is not configured"
      return NextResponse.json({ error: message }, { status: 503 })
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(id, {
      password,
    })

    if (updateError) {
      console.error("Error updating password:", updateError)
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    const { error: credentialsError } = await adminClient.from("user_credentials").upsert(
      {
        user_id: id,
        password,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )

    if (credentialsError) {
      console.error("Error saving credentials:", credentialsError)
      return NextResponse.json({ error: credentialsError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in update password API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check if current user is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()
    
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }
    
    const body = await request.json()
    const { email, password, full_name, phone, role, company_name } = body

    if (!email || !password || !full_name || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (role === "admin") {
      if (!phone?.trim()) {
        return NextResponse.json(
          { error: "Company phone number is required for admin accounts." },
          { status: 400 },
        )
      }
      if (!company_name?.trim()) {
        return NextResponse.json(
          { error: "Company name is required for admin accounts." },
          { status: 400 },
        )
      }
    }
    
    let adminClient
    try {
      adminClient = createAdminClient()
    } catch (configError) {
      const message =
        configError instanceof Error ? configError.message : "Admin API is not configured"
      return NextResponse.json({ error: message }, { status: 503 })
    }

    // Create user using admin API (service role)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        role,
      },
    })
    
    if (createError) {
      console.error("Error creating user:", createError)
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }
    
    if (newUser.user) {
      const profileUpdate: Record<string, string> = {}
      if (phone?.trim()) profileUpdate.phone = phone.trim()
      if (role === "admin" && company_name?.trim()) {
        profileUpdate.company_name = company_name.trim()
      }

      if (Object.keys(profileUpdate).length > 0) {
        await adminClient.from("profiles").update(profileUpdate).eq("id", newUser.user.id)
      }

      await adminClient.from("user_credentials").upsert(
        {
          user_id: newUser.user.id,
          password,
        },
        { onConflict: "user_id" },
      )
    }

    return NextResponse.json({ success: true, user: newUser.user })
  } catch (error) {
    console.error("Error in create user API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check if current user is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()
    
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }
    
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("id")
    
    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }
    
    // Prevent deleting yourself
    if (userId === user.id) {
      return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 })
    }
    
    let adminClient
    try {
      adminClient = createAdminClient()
    } catch (configError) {
      const message =
        configError instanceof Error ? configError.message : "Admin API is not configured"
      return NextResponse.json({ error: message }, { status: 503 })
    }

    // Delete user using admin API
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)
    
    if (deleteError) {
      console.error("Error deleting user:", deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 400 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in delete user API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
