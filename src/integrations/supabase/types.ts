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
      budgets: {
        Row: {
          budgeted_amount: number
          category: string
          created_at: string
          id: string
          notes: string | null
          year: number
        }
        Insert: {
          budgeted_amount?: number
          category: string
          created_at?: string
          id?: string
          notes?: string | null
          year: number
        }
        Update: {
          budgeted_amount?: number
          category?: string
          created_at?: string
          id?: string
          notes?: string | null
          year?: number
        }
        Relationships: []
      }
      building_leases: {
        Row: {
          building_id: string | null
          contract_end: string | null
          contract_start: string | null
          created_at: string
          deposit: number | null
          id: string
          monthly_rent: number
          notes: string | null
          status: string | null
          tenant_id: string | null
        }
        Insert: {
          building_id?: string | null
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string
          deposit?: number | null
          id?: string
          monthly_rent?: number
          notes?: string | null
          status?: string | null
          tenant_id?: string | null
        }
        Update: {
          building_id?: string | null
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string
          deposit?: number | null
          id?: string
          monthly_rent?: number
          notes?: string | null
          status?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "building_leases_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "building_leases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      buildings: {
        Row: {
          area_m2_gross: number | null
          area_m2_net: number | null
          build_year: number | null
          building_nr: string | null
          condition: string | null
          created_at: string
          description: string | null
          estimated_monthly_rent: number | null
          floors: number | null
          has_electricity: boolean | null
          has_heating: boolean | null
          has_internet: boolean | null
          has_sewage: boolean | null
          has_water: boolean | null
          heating_type: string | null
          id: string
          internal_notes: string | null
          last_inspection: string | null
          lease_status: string | null
          lease_status_note: string | null
          map_color: string | null
          map_h: number | null
          map_section: string | null
          map_shape: string | null
          map_w: number | null
          map_x: number | null
          map_y: number | null
          name: string
          parcel_id: string | null
          type: string
        }
        Insert: {
          area_m2_gross?: number | null
          area_m2_net?: number | null
          build_year?: number | null
          building_nr?: string | null
          condition?: string | null
          created_at?: string
          description?: string | null
          estimated_monthly_rent?: number | null
          floors?: number | null
          has_electricity?: boolean | null
          has_heating?: boolean | null
          has_internet?: boolean | null
          has_sewage?: boolean | null
          has_water?: boolean | null
          heating_type?: string | null
          id?: string
          internal_notes?: string | null
          last_inspection?: string | null
          lease_status?: string | null
          lease_status_note?: string | null
          map_color?: string | null
          map_h?: number | null
          map_section?: string | null
          map_shape?: string | null
          map_w?: number | null
          map_x?: number | null
          map_y?: number | null
          name: string
          parcel_id?: string | null
          type: string
        }
        Update: {
          area_m2_gross?: number | null
          area_m2_net?: number | null
          build_year?: number | null
          building_nr?: string | null
          condition?: string | null
          created_at?: string
          description?: string | null
          estimated_monthly_rent?: number | null
          floors?: number | null
          has_electricity?: boolean | null
          has_heating?: boolean | null
          has_internet?: boolean | null
          has_sewage?: boolean | null
          has_water?: boolean | null
          heating_type?: string | null
          id?: string
          internal_notes?: string | null
          last_inspection?: string | null
          lease_status?: string | null
          lease_status_note?: string | null
          map_color?: string | null
          map_h?: number | null
          map_section?: string | null
          map_shape?: string | null
          map_w?: number | null
          map_x?: number | null
          map_y?: number | null
          name?: string
          parcel_id?: string | null
          type?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          address: string | null
          created_at: string
          cvr: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          type: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          cvr?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          type: string
        }
        Update: {
          address?: string | null
          created_at?: string
          cvr?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          type?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          category: string | null
          created_at: string
          file_url: string | null
          id: string
          name: string
          notes: string | null
          related_contact_id: string | null
          upload_date: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          file_url?: string | null
          id?: string
          name: string
          notes?: string | null
          related_contact_id?: string | null
          upload_date?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          file_url?: string | null
          id?: string
          name?: string
          notes?: string | null
          related_contact_id?: string | null
          upload_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_related_contact_id_fkey"
            columns: ["related_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          attachment_url: string | null
          category: string | null
          created_at: string
          description: string | null
          dinero_voucher_id: string | null
          expense_date: string | null
          id: string
          supplier_id: string | null
        }
        Insert: {
          amount?: number
          attachment_url?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          dinero_voucher_id?: string | null
          expense_date?: string | null
          id?: string
          supplier_id?: string | null
        }
        Update: {
          amount?: number
          attachment_url?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          dinero_voucher_id?: string | null
          expense_date?: string | null
          id?: string
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      fields: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          updated_at: string
          use_type: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
          use_type?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
          use_type?: string | null
        }
        Relationships: []
      }
      forest_activities: {
        Row: {
          activity_date: string | null
          activity_type: string
          contractor_id: string | null
          cost: number | null
          created_at: string
          id: string
          notes: string | null
          parcel_id: string | null
          quantity_units: number | null
          revenue: number | null
          volume_m3: number | null
        }
        Insert: {
          activity_date?: string | null
          activity_type: string
          contractor_id?: string | null
          cost?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          parcel_id?: string | null
          quantity_units?: number | null
          revenue?: number | null
          volume_m3?: number | null
        }
        Update: {
          activity_date?: string | null
          activity_type?: string
          contractor_id?: string | null
          cost?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          parcel_id?: string | null
          quantity_units?: number | null
          revenue?: number | null
          volume_m3?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "forest_activities_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forest_activities_parcel_id_fkey"
            columns: ["parcel_id"]
            isOneToOne: false
            referencedRelation: "forest_parcels"
            referencedColumns: ["id"]
          },
        ]
      }
      forest_parcels: {
        Row: {
          area_ha: number | null
          average_age_years: number | null
          created_at: string
          estimated_harvest_year_from: number | null
          estimated_harvest_year_to: number | null
          id: string
          name: string
          notes: string | null
          status: string | null
          tree_species: string | null
        }
        Insert: {
          area_ha?: number | null
          average_age_years?: number | null
          created_at?: string
          estimated_harvest_year_from?: number | null
          estimated_harvest_year_to?: number | null
          id?: string
          name: string
          notes?: string | null
          status?: string | null
          tree_species?: string | null
        }
        Update: {
          area_ha?: number | null
          average_age_years?: number | null
          created_at?: string
          estimated_harvest_year_from?: number | null
          estimated_harvest_year_to?: number | null
          id?: string
          name?: string
          notes?: string | null
          status?: string | null
          tree_species?: string | null
        }
        Relationships: []
      }
      hunting_leases: {
        Row: {
          annual_fee: number | null
          area_ha: number | null
          contract_end: string | null
          contract_start: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          tenant_id: string | null
        }
        Insert: {
          annual_fee?: number | null
          area_ha?: number | null
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          tenant_id?: string | null
        }
        Update: {
          annual_fee?: number | null
          area_ha?: number | null
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hunting_leases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      hunting_records: {
        Row: {
          created_at: string
          harvested: number | null
          id: string
          lease_id: string | null
          notes: string | null
          quota: number | null
          season: string | null
          species: string | null
        }
        Insert: {
          created_at?: string
          harvested?: number | null
          id?: string
          lease_id?: string | null
          notes?: string | null
          quota?: number | null
          season?: string | null
          species?: string | null
        }
        Update: {
          created_at?: string
          harvested?: number | null
          id?: string
          lease_id?: string | null
          notes?: string | null
          quota?: number | null
          season?: string | null
          species?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hunting_records_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "hunting_leases"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_excl_vat: number
          category: string | null
          contact_id: string | null
          created_at: string
          description: string | null
          dinero_invoice_id: string | null
          due_date: string | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          notes: string | null
          status: string | null
          total_amount: number | null
          vat_amount: number
        }
        Insert: {
          amount_excl_vat?: number
          category?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          dinero_invoice_id?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          notes?: string | null
          status?: string | null
          total_amount?: number | null
          vat_amount?: number
        }
        Update: {
          amount_excl_vat?: number
          category?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          dinero_invoice_id?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          notes?: string | null
          status?: string | null
          total_amount?: number | null
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      land_leases: {
        Row: {
          annual_fee: number | null
          area_ha: number
          contract_end: string | null
          contract_start: string | null
          created_at: string
          id: string
          leaseholder_id: string | null
          notes: string | null
          price_per_ha: number
        }
        Insert: {
          annual_fee?: number | null
          area_ha?: number
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string
          id?: string
          leaseholder_id?: string | null
          notes?: string | null
          price_per_ha?: number
        }
        Update: {
          annual_fee?: number | null
          area_ha?: number
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string
          id?: string
          leaseholder_id?: string | null
          notes?: string | null
          price_per_ha?: number
        }
        Relationships: [
          {
            foreignKeyName: "land_leases_leaseholder_id_fkey"
            columns: ["leaseholder_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_tasks: {
        Row: {
          actual_cost: number | null
          assigned_contact_id: string | null
          building_id: string | null
          category: string | null
          completed_date: string | null
          created_at: string
          description: string | null
          due_date: string | null
          estimated_cost: number | null
          id: string
          notes: string | null
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          actual_cost?: number | null
          assigned_contact_id?: string | null
          building_id?: string | null
          category?: string | null
          completed_date?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          estimated_cost?: number | null
          id?: string
          notes?: string | null
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          actual_cost?: number | null
          assigned_contact_id?: string | null
          building_id?: string | null
          category?: string | null
          completed_date?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          estimated_cost?: number | null
          id?: string
          notes?: string | null
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_tasks_assigned_contact_id_fkey"
            columns: ["assigned_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tasks_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      parcels: {
        Row: {
          created_at: string
          ejerlav: string
          field_area_ha: number | null
          field_id: string | null
          id: string
          land_lease_id: string | null
          matrikel_id: string
          net_area_ha: number | null
          notes: string | null
          updated_at: string
          use_type: string | null
        }
        Insert: {
          created_at?: string
          ejerlav?: string
          field_area_ha?: number | null
          field_id?: string | null
          id?: string
          land_lease_id?: string | null
          matrikel_id: string
          net_area_ha?: number | null
          notes?: string | null
          updated_at?: string
          use_type?: string | null
        }
        Update: {
          created_at?: string
          ejerlav?: string
          field_area_ha?: number | null
          field_id?: string | null
          id?: string
          land_lease_id?: string | null
          matrikel_id?: string
          net_area_ha?: number | null
          notes?: string | null
          updated_at?: string
          use_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parcels_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcels_land_lease_id_fkey"
            columns: ["land_lease_id"]
            isOneToOne: false
            referencedRelation: "land_leases"
            referencedColumns: ["id"]
          },
        ]
      }
      straw_inventory: {
        Row: {
          bale_type: string
          harvest_year: number | null
          id: string
          notes: string | null
          price_per_unit: number
          quantity: number
          updated_at: string
        }
        Insert: {
          bale_type: string
          harvest_year?: number | null
          id?: string
          notes?: string | null
          price_per_unit?: number
          quantity?: number
          updated_at?: string
        }
        Update: {
          bale_type?: string
          harvest_year?: number | null
          id?: string
          notes?: string | null
          price_per_unit?: number
          quantity?: number
          updated_at?: string
        }
        Relationships: []
      }
      straw_movements: {
        Row: {
          bale_type: string
          contact_id: string | null
          created_at: string
          direction: string
          id: string
          invoice_id: string | null
          movement_date: string | null
          notes: string | null
          quantity: number
          total_amount: number | null
          unit_price: number
        }
        Insert: {
          bale_type: string
          contact_id?: string | null
          created_at?: string
          direction: string
          id?: string
          invoice_id?: string | null
          movement_date?: string | null
          notes?: string | null
          quantity?: number
          total_amount?: number | null
          unit_price?: number
        }
        Update: {
          bale_type?: string
          contact_id?: string | null
          created_at?: string
          direction?: string
          id?: string
          invoice_id?: string | null
          movement_date?: string | null
          notes?: string | null
          quantity?: number
          total_amount?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "straw_movements_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "straw_movements_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_member: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "member"
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
    Enums: {
      app_role: ["admin", "member"],
    },
  },
} as const
