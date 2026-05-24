"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, Shield, HardHat, User, Users, Loader2, ArrowLeft, Eye, EyeOff, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/hooks/use-auth"
import Link from "next/link"

type UserRole = "admin" | "pm" | "engineer" | "customer"

interface UserProfile {
  id: string
  email: string
  full_name: string
  role: UserRole
  phone?: string
  created_at: string
  password?: string | null
}

const roleConfig = {
  admin: { label: "Admin", icon: Shield, color: "bg-red-500/10 text-red-500 border-red-500/20" },
  pm: { label: "Project Manager", icon: Users, color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  engineer: { label: "Site Engineer", icon: HardHat, color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
  customer: { label: "Customer", icon: User, color: "bg-green-500/10 text-green-500 border-green-500/20" },
}

export default function AdminUsersPage() {
  const router = useRouter()
  const { user, profile, isLoading: authLoading } = useAuth()
  
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [saving, setSaving] = useState(false)
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({})
  
  // Form state
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    newPassword: "",
    full_name: "",
    phone: "",
    role: "engineer" as UserRole,
  })

  useEffect(() => {
    if (!authLoading && (!user || profile?.role !== "admin")) {
      router.push("/login")
      return
    }
    
    if (user && profile?.role === "admin") {
      fetchUsers()
    }
  }, [user, profile, authLoading, router])

  async function fetchUsers() {
    try {
      const response = await fetch("/api/admin/users")
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch users")
      }

      setUsers(result.users || [])
    } catch (error) {
      console.error("Error fetching users:", error)
      toast.error("Failed to fetch users")
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateUser() {
    if (!formData.email || !formData.password || !formData.full_name) {
      toast.error("Please fill in all required fields")
      return
    }
    
    setSaving(true)
    
    try {
      // Call server action to create user
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || "Failed to create user")
      }
      
      toast.success("User created successfully")
      setCreateDialogOpen(false)
      setFormData({ email: "", password: "", newPassword: "", full_name: "", phone: "", role: "engineer" })
      fetchUsers()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create user"
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateUser() {
    if (!selectedUser) return
    
    setSaving(true)
    const supabase = createClient()
    
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          role: formData.role,
        })
        .eq("id", selectedUser.id)
      
      if (error) {
        throw new Error("Failed to update user")
      }

      if (formData.newPassword) {
        const response = await fetch("/api/admin/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: selectedUser.id,
            password: formData.newPassword,
          }),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || "Failed to update password")
        }
      }

      toast.success(
        formData.newPassword ? "User and password updated successfully" : "User updated successfully",
      )
      setEditDialogOpen(false)
      fetchUsers()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update user"
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  function togglePasswordVisibility(userId: string) {
    setVisiblePasswords((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }))
  }

  async function handleDeleteUser() {
    if (!selectedUser) return
    
    setSaving(true)
    
    try {
      const response = await fetch(`/api/admin/users?id=${selectedUser.id}`, {
        method: "DELETE",
      })
      
      if (!response.ok) {
        throw new Error("Failed to delete user")
      }
      
      toast.success("User deleted successfully")
      setDeleteDialogOpen(false)
      fetchUsers()
    } catch {
      toast.error("Failed to delete user")
    } finally {
      setSaving(false)
    }
  }

  function openEditDialog(user: UserProfile) {
    setSelectedUser(user)
    setFormData({
      email: user.email,
      password: user.password || "",
      newPassword: "",
      full_name: user.full_name,
      phone: user.phone || "",
      role: user.role,
    })
    setEditDialogOpen(true)
  }

  function openDeleteDialog(user: UserProfile) {
    setSelectedUser(user)
    setDeleteDialogOpen(true)
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (profile?.role !== "admin") {
    return null
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">User Management</h1>
              <p className="text-muted-foreground">Create and manage user accounts</p>
            </div>
          </div>
          <Button onClick={() => {
            setFormData({ email: "", password: "", newPassword: "", full_name: "", phone: "", role: "engineer" })
            setCreateDialogOpen(true)
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>

        {/* Users Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {users.map((user) => {
            const config = roleConfig[user.role]
            const Icon = config.icon
            
            return (
              <Card key={user.id} className="bg-card border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${config.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{user.full_name}</CardTitle>
                        <CardDescription className="text-xs">{user.email}</CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className={config.color}>
                      {config.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <KeyRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground shrink-0">Password</span>
                      <span className="text-sm font-mono truncate">
                        {user.password
                          ? visiblePasswords[user.id]
                            ? user.password
                            : "••••••••"
                          : "Not set"}
                      </span>
                    </div>
                    {user.password ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => togglePasswordVisibility(user.id)}
                        aria-label={visiblePasswords[user.id] ? "Hide password" : "Show password"}
                      >
                        {visiblePasswords[user.id] ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Created {new Date(user.created_at).toLocaleDateString()}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(user)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => openDeleteDialog(user)}
                        disabled={user.id === profile?.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {users.length === 0 && (
          <Card className="bg-card border-border">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No users found</p>
              <Button className="mt-4" onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First User
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create User Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>Add a new user to the system</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name *</Label>
              <Input
                id="full_name"
                placeholder="John Doe"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                placeholder="Min 6 characters"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                placeholder="+91 98765 43210"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Select
                value={formData.role}
                onValueChange={(value: UserRole) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="pm">Project Manager</SelectItem>
                  <SelectItem value="engineer">Site Engineer</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateUser} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit_full_name">Full Name</Label>
              <Input
                id="edit_full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_email">Email</Label>
              <Input
                id="edit_email"
                type="email"
                value={formData.email}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_current_password">Current Password</Label>
              <Input
                id="edit_current_password"
                type="text"
                value={formData.password || "Not set"}
                disabled
                className="bg-muted font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_new_password">New Password</Label>
              <Input
                id="edit_new_password"
                type="password"
                placeholder="Leave blank to keep current password"
                value={formData.newPassword}
                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Enter a new password only if you want to change it (min 6 characters).
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_phone">Phone</Label>
              <Input
                id="edit_phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value: UserRole) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="pm">Project Manager</SelectItem>
                  <SelectItem value="engineer">Site Engineer</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateUser} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedUser?.full_name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
