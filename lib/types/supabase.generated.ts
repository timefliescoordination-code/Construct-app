export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      additional_works: {
        Row: {
          amount: number
          approval_status: string
          approved_by: string | null
          approved_date: string | null
          created_at: string
          description: string
          id: string
          notes: string | null
          project_id: string
          requested_date: string
          updated_at: string
        }
        Insert: {
          amount?: number
          approval_status?: string
          approved_by?: string | null
          approved_date?: string | null
          created_at?: string
          description: string
          id?: string
          notes?: string | null
          project_id: string
          requested_date?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          approval_status?: string
          approved_by?: string | null
          approved_date?: string | null
          created_at?: string
          description?: string
          id?: string
          notes?: string | null
          project_id?: string
          requested_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "additional_works_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "additional_works_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      client_payments: {
        Row: {
          amount: number
          created_at: string
          due_date: string | null
          entered_by: string | null
          id: string
          milestone_id: string | null
          notes: string | null
          payment_method: string | null
          project_id: string
          received_date: string | null
          reference_number: string | null
          stage_name: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          due_date?: string | null
          entered_by?: string | null
          id?: string
          milestone_id?: string | null
          notes?: string | null
          payment_method?: string | null
          project_id: string
          received_date?: string | null
          reference_number?: string | null
          stage_name: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string | null
          entered_by?: string | null
          id?: string
          milestone_id?: string | null
          notes?: string | null
          payment_method?: string | null
          project_id?: string
          received_date?: string | null
          reference_number?: string | null
          stage_name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_payments_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_payments_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      company_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          description: string
          expense_date: string
          id: string
          notes: string | null
          payment_method: string | null
          updated_at: string
          vendor_name: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by?: string | null
          description: string
          expense_date?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          updated_at?: string
          vendor_name?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          expense_date?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          updated_at?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_income: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          notes: string | null
          payment_method: string | null
          received_date: string
          reference_number: string | null
          source_name: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          received_date?: string
          reference_number?: string | null
          source_name?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          received_date?: string
          reference_number?: string | null
          source_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_income_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          project_id: string
          sort_order: number
          updated_at: string
          uses_labour_teams: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          project_id: string
          sort_order?: number
          updated_at?: string
          uses_labour_teams?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          project_id?: string
          sort_order?: number
          updated_at?: string
          uses_labour_teams?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_invoices: {
        Row: {
          created_at: string
          expense_id: string
          file_mime_type: string
          file_name: string
          file_path: string
          id: string
          invoice_date: string | null
          invoice_number: string | null
          invoice_total: number | null
          processing_status: string
          updated_at: string
          vendor_name: string | null
        }
        Insert: {
          created_at?: string
          expense_id: string
          file_mime_type: string
          file_name: string
          file_path: string
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          invoice_total?: number | null
          processing_status?: string
          updated_at?: string
          vendor_name?: string | null
        }
        Update: {
          created_at?: string
          expense_id?: string
          file_mime_type?: string
          file_name?: string
          file_path?: string
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          invoice_total?: number | null
          processing_status?: string
          updated_at?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_invoices_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_split_groups: {
        Row: {
          bill_number: string | null
          category: string
          created_at: string
          description: string
          id: string
          labour_team_id: string | null
          milestone_id: string | null
          project_id: string
          subcategory_name: string | null
          total_amount: number
          updated_at: string
          vendor_name: string | null
        }
        Insert: {
          bill_number?: string | null
          category: string
          created_at?: string
          description?: string
          id?: string
          labour_team_id?: string | null
          milestone_id?: string | null
          project_id: string
          subcategory_name?: string | null
          total_amount: number
          updated_at?: string
          vendor_name?: string | null
        }
        Update: {
          bill_number?: string | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          labour_team_id?: string | null
          milestone_id?: string | null
          project_id?: string
          subcategory_name?: string | null
          total_amount?: number
          updated_at?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_split_groups_labour_team_id_fkey"
            columns: ["labour_team_id"]
            isOneToOne: false
            referencedRelation: "labour_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_split_groups_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_split_groups_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_subcategories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          approved_by: string | null
          bill_number: string | null
          category: string
          created_at: string
          description: string
          entered_by: string | null
          expense_date: string
          id: string
          labour_team_id: string | null
          manpower_week_id: string | null
          milestone_id: string | null
          project_id: string
          split_group_id: string | null
          split_number: number | null
          status: string
          submitted_by: string | null
          updated_at: string
          vendor_name: string | null
        }
        Insert: {
          amount?: number
          approved_by?: string | null
          bill_number?: string | null
          category: string
          created_at?: string
          description?: string
          entered_by?: string | null
          expense_date?: string
          id?: string
          labour_team_id?: string | null
          manpower_week_id?: string | null
          milestone_id?: string | null
          project_id: string
          split_group_id?: string | null
          split_number?: number | null
          status?: string
          submitted_by?: string | null
          updated_at?: string
          vendor_name?: string | null
        }
        Update: {
          amount?: number
          approved_by?: string | null
          bill_number?: string | null
          category?: string
          created_at?: string
          description?: string
          entered_by?: string | null
          expense_date?: string
          id?: string
          labour_team_id?: string | null
          manpower_week_id?: string | null
          milestone_id?: string | null
          project_id?: string
          split_group_id?: string | null
          split_number?: number | null
          status?: string
          submitted_by?: string | null
          updated_at?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_labour_team_id_fkey"
            columns: ["labour_team_id"]
            isOneToOne: false
            referencedRelation: "labour_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_manpower_week_id_fkey"
            columns: ["manpower_week_id"]
            isOneToOne: false
            referencedRelation: "manpower_weeks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_split_group_id_fkey"
            columns: ["split_group_id"]
            isOneToOne: false
            referencedRelation: "expense_split_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_categories: {
        Row: {
          created_at: string
          id: string
          kind: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          created_at: string
          expense_id: string
          id: string
          material_description_original: string
          material_description_standardized: string | null
          quantity: number | null
          total_amount: number
          unit: string | null
          unit_rate: number | null
        }
        Insert: {
          created_at?: string
          expense_id: string
          id?: string
          material_description_original: string
          material_description_standardized?: string | null
          quantity?: number | null
          total_amount?: number
          unit?: string | null
          unit_rate?: number | null
        }
        Update: {
          created_at?: string
          expense_id?: string
          id?: string
          material_description_original?: string
          material_description_standardized?: string | null
          quantity?: number | null
          total_amount?: number
          unit?: string | null
          unit_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      labour_entries: {
        Row: {
          count: number
          created_at: string
          entry_date: string
          id: string
          labour_type_id: string
          milestone_id: string | null
          project_id: string
          submitted_by: string | null
          total_cost: number
          updated_at: string
          wage_per_person: number
        }
        Insert: {
          count?: number
          created_at?: string
          entry_date?: string
          id?: string
          labour_type_id: string
          milestone_id?: string | null
          project_id: string
          submitted_by?: string | null
          total_cost?: number
          updated_at?: string
          wage_per_person?: number
        }
        Update: {
          count?: number
          created_at?: string
          entry_date?: string
          id?: string
          labour_type_id?: string
          milestone_id?: string | null
          project_id?: string
          submitted_by?: string | null
          total_cost?: number
          updated_at?: string
          wage_per_person?: number
        }
        Relationships: [
          {
            foreignKeyName: "labour_entries_labour_type_id_fkey"
            columns: ["labour_type_id"]
            isOneToOne: false
            referencedRelation: "labour_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labour_entries_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labour_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labour_entries_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      labour_teams: {
        Row: {
          created_at: string
          id: string
          name: string
          project_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          project_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          project_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "labour_teams_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      labour_types: {
        Row: {
          created_at: string
          default_wage: number
          id: string
          labour_team_id: string | null
          name: string
          project_id: string | null
          short_label: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          default_wage?: number
          id?: string
          labour_team_id?: string | null
          name: string
          project_id?: string | null
          short_label?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          default_wage?: number
          id?: string
          labour_team_id?: string | null
          name?: string
          project_id?: string | null
          short_label?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "labour_types_labour_team_id_fkey"
            columns: ["labour_team_id"]
            isOneToOne: false
            referencedRelation: "labour_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labour_types_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      manpower_week_rates: {
        Row: {
          daily_rate: number
          id: string
          labour_type_id: string
          week_id: string
        }
        Insert: {
          daily_rate?: number
          id?: string
          labour_type_id: string
          week_id: string
        }
        Update: {
          daily_rate?: number
          id?: string
          labour_type_id?: string
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manpower_week_rates_labour_type_id_fkey"
            columns: ["labour_type_id"]
            isOneToOne: false
            referencedRelation: "labour_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manpower_week_rates_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "manpower_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      manpower_weeks: {
        Row: {
          created_at: string
          id: string
          milestone_id: string
          project_id: string
          show_in_expense: boolean
          start_date: string
          updated_at: string
          week_number: number
        }
        Insert: {
          created_at?: string
          id?: string
          milestone_id: string
          project_id: string
          show_in_expense?: boolean
          start_date: string
          updated_at?: string
          week_number: number
        }
        Update: {
          created_at?: string
          id?: string
          milestone_id?: string
          project_id?: string
          show_in_expense?: boolean
          start_date?: string
          updated_at?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "manpower_weeks_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manpower_weeks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          actual_completion_percent: number
          actual_expenses: number
          created_at: string
          expected_cost_percent: number
          expected_duration: string | null
          id: string
          name: string
          notes: string | null
          project_id: string
          sort_order: number
          status: string
          target_budget: number
          updated_at: string
        }
        Insert: {
          actual_completion_percent?: number
          actual_expenses?: number
          created_at?: string
          expected_cost_percent?: number
          expected_duration?: string | null
          id?: string
          name: string
          notes?: string | null
          project_id: string
          sort_order?: number
          status?: string
          target_budget?: number
          updated_at?: string
        }
        Update: {
          actual_completion_percent?: number
          actual_expenses?: number
          created_at?: string
          expected_cost_percent?: number
          expected_duration?: string | null
          id?: string
          name?: string
          notes?: string | null
          project_id?: string
          sort_order?: number
          status?: string
          target_budget?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          expense_id: string | null
          id: string
          message: string
          project_id: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expense_id?: string | null
          id?: string
          message: string
          project_id?: string | null
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expense_id?: string | null
          id?: string
          message?: string
          project_id?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          description: string
          expense_date: string
          id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by?: string | null
          description: string
          expense_date?: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          expense_date?: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_name: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          role: string
          updated_at: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          email: string
          full_name?: string
          id: string
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_design_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          design_file_id: string
          id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          design_file_id: string
          id?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          design_file_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_design_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_design_comments_design_file_id_fkey"
            columns: ["design_file_id"]
            isOneToOne: false
            referencedRelation: "project_design_files"
            referencedColumns: ["id"]
          },
        ]
      }
      project_design_files: {
        Row: {
          created_at: string
          file_mime_type: string
          file_name: string
          file_path: string
          id: string
          project_id: string
          revision_label: string | null
          title: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_mime_type: string
          file_name: string
          file_path: string
          id?: string
          project_id: string
          revision_label?: string | null
          title?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_mime_type?: string
          file_name?: string
          file_path?: string
          id?: string
          project_id?: string
          revision_label?: string | null
          title?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_design_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_design_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_engineers: {
        Row: {
          created_at: string
          engineer_id: string
          id: string
          project_id: string
        }
        Insert: {
          created_at?: string
          engineer_id: string
          id?: string
          project_id: string
        }
        Update: {
          created_at?: string
          engineer_id?: string
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_engineers_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_engineers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          additional_works_value: number
          client_name: string
          client_phone: string | null
          construction_activated_at: string | null
          construction_activated_by: string | null
          contract_value: number
          created_at: string
          customer_id: string | null
          expected_completion_date: string | null
          expected_margin_percent: number
          id: string
          lifecycle_phase: string
          name: string
          pm_id: string | null
          site_address: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          additional_works_value?: number
          client_name?: string
          client_phone?: string | null
          construction_activated_at?: string | null
          construction_activated_by?: string | null
          contract_value?: number
          created_at?: string
          customer_id?: string | null
          expected_completion_date?: string | null
          expected_margin_percent?: number
          id?: string
          lifecycle_phase?: string
          name: string
          pm_id?: string | null
          site_address?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          additional_works_value?: number
          client_name?: string
          client_phone?: string | null
          construction_activated_at?: string | null
          construction_activated_by?: string | null
          contract_value?: number
          created_at?: string
          customer_id?: string | null
          expected_completion_date?: string | null
          expected_margin_percent?: number
          id?: string
          lifecycle_phase?: string
          name?: string
          pm_id?: string | null
          site_address?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_construction_activated_by_fkey"
            columns: ["construction_activated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_pm_id_fkey"
            columns: ["pm_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_accounts: {
        Row: {
          created_at: string
          id: string
          linked_at: string
          profile_id: string
          telegram_chat_id: number
          telegram_user_id: number
          telegram_username: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          linked_at?: string
          profile_id: string
          telegram_chat_id: number
          telegram_user_id: number
          telegram_username?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          linked_at?: string
          profile_id?: string
          telegram_chat_id?: number
          telegram_user_id?: number
          telegram_username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_accounts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_link_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          profile_id: string
          used_at: string | null
        }
        Insert: {
          code: string
          created_at?: string
          expires_at: string
          id?: string
          profile_id: string
          used_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          profile_id?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_link_codes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_sessions: {
        Row: {
          payload: Json
          profile_id: string | null
          state: string
          telegram_chat_id: number
          updated_at: string
        }
        Insert: {
          payload?: Json
          profile_id?: string | null
          state?: string
          telegram_chat_id: number
          updated_at?: string
        }
        Update: {
          payload?: Json
          profile_id?: string | null
          state?: string
          telegram_chat_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_credentials: {
        Row: {
          password: string
          updated_at: string
          user_id: string
        }
        Insert: {
          password: string
          updated_at?: string
          user_id: string
        }
        Update: {
          password?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_credentials_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_payments: {
        Row: {
          amount_paid: number
          category: string | null
          created_at: string
          due_date: string | null
          entered_by: string | null
          expense_split_group_id: string | null
          id: string
          notes: string | null
          pending_amount: number | null
          project_id: string
          status: string
          total_amount: number
          updated_at: string
          vendor_name: string
        }
        Insert: {
          amount_paid?: number
          category?: string | null
          created_at?: string
          due_date?: string | null
          entered_by?: string | null
          expense_split_group_id?: string | null
          id?: string
          notes?: string | null
          pending_amount?: number | null
          project_id: string
          status?: string
          total_amount?: number
          updated_at?: string
          vendor_name: string
        }
        Update: {
          amount_paid?: number
          category?: string | null
          created_at?: string
          due_date?: string | null
          entered_by?: string | null
          expense_split_group_id?: string | null
          id?: string
          notes?: string | null
          pending_amount?: number | null
          project_id?: string
          status?: string
          total_amount?: number
          updated_at?: string
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_payments_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_payments_expense_split_group_id_fkey"
            columns: ["expense_split_group_id"]
            isOneToOne: false
            referencedRelation: "expense_split_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_role: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_customer_for_project: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      is_engineer_for_project: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      is_pm_for_project: { Args: { p_project_id: string }; Returns: boolean }
      user_can_access_project: {
        Args: { p_project_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
