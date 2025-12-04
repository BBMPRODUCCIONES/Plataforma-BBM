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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      clients: {
        Row: {
          created_at: string
          id: string
          nit: string
          nombre: string
        }
        Insert: {
          created_at?: string
          id?: string
          nit?: string
          nombre?: string
        }
        Update: {
          created_at?: string
          id?: string
          nit?: string
          nombre?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          cargo: string
          correo: string
          created_at: string
          id: string
          nombre: string
          telefono: string
        }
        Insert: {
          cargo?: string
          correo?: string
          created_at?: string
          id?: string
          nombre?: string
          telefono?: string
        }
        Update: {
          cargo?: string
          correo?: string
          created_at?: string
          id?: string
          nombre?: string
          telefono?: string
        }
        Relationships: []
      }
      google_calendar_tokens: {
        Row: {
          access_token: string
          calendar_id: string | null
          created_at: string
          expires_at: string
          id: string
          refresh_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          calendar_id?: string | null
          created_at?: string
          expires_at: string
          id?: string
          refresh_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          calendar_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          refresh_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          allowed_panels: string[] | null
          created_at: string | null
          created_by_admin_id: string | null
          email: string
          expires_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          allowed_panels?: string[] | null
          created_at?: string | null
          created_by_admin_id?: string | null
          email: string
          expires_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          allowed_panels?: string[] | null
          created_at?: string | null
          created_by_admin_id?: string | null
          email?: string
          expires_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          a_cargo_de: string
          administrativo_responsable: string
          avanzada: string
          centro_costos: string
          cliente: string
          cotizaciones: Json
          created_at: string
          estado: string
          evento: string
          fecha_ejecucion_fin: string
          fecha_ejecucion_inicio: string
          fecha_montaje_fin: string
          fecha_montaje_inicio: string
          hora_ejecucion_fin: string
          hora_ejecucion_inicio: string
          hora_montaje_fin: string
          hora_montaje_inicio: string
          id: string
          ingreso_bruto: number
          ingreso_total: number
          inventario: Json
          jefe_operaciones: string
          notas: string
          num_factura: string
          ordenes_compra: Json
          personal: Json
          productor: string
          ubicacion: string
          updated_at: string
        }
        Insert: {
          a_cargo_de?: string
          administrativo_responsable?: string
          avanzada?: string
          centro_costos?: string
          cliente?: string
          cotizaciones?: Json
          created_at?: string
          estado?: string
          evento?: string
          fecha_ejecucion_fin?: string
          fecha_ejecucion_inicio?: string
          fecha_montaje_fin?: string
          fecha_montaje_inicio?: string
          hora_ejecucion_fin?: string
          hora_ejecucion_inicio?: string
          hora_montaje_fin?: string
          hora_montaje_inicio?: string
          id?: string
          ingreso_bruto?: number
          ingreso_total?: number
          inventario?: Json
          jefe_operaciones?: string
          notas?: string
          num_factura?: string
          ordenes_compra?: Json
          personal?: Json
          productor?: string
          ubicacion?: string
          updated_at?: string
        }
        Update: {
          a_cargo_de?: string
          administrativo_responsable?: string
          avanzada?: string
          centro_costos?: string
          cliente?: string
          cotizaciones?: Json
          created_at?: string
          estado?: string
          evento?: string
          fecha_ejecucion_fin?: string
          fecha_ejecucion_inicio?: string
          fecha_montaje_fin?: string
          fecha_montaje_inicio?: string
          hora_ejecucion_fin?: string
          hora_ejecucion_inicio?: string
          hora_montaje_fin?: string
          hora_montaje_inicio?: string
          id?: string
          ingreso_bruto?: number
          ingreso_total?: number
          inventario?: Json
          jefe_operaciones?: string
          notas?: string
          num_factura?: string
          ordenes_compra?: Json
          personal?: Json
          productor?: string
          ubicacion?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          categoria: string
          correo: string
          cotizaciones: Json
          created_at: string
          id: string
          nombre: string
          notas: string
          telefono: string
          tipo_producto_servicio: string
          updated_at: string
        }
        Insert: {
          categoria?: string
          correo?: string
          cotizaciones?: Json
          created_at?: string
          id?: string
          nombre?: string
          notas?: string
          telefono?: string
          tipo_producto_servicio?: string
          updated_at?: string
        }
        Update: {
          categoria?: string
          correo?: string
          cotizaciones?: Json
          created_at?: string
          id?: string
          nombre?: string
          notas?: string
          telefono?: string
          tipo_producto_servicio?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          allowed_panels: string[] | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          allowed_panels?: string[] | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          allowed_panels?: string[] | null
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
    }
    Enums: {
      app_role: "administrador" | "operativo" | "visual"
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
      app_role: ["administrador", "operativo", "visual"],
    },
  },
} as const
