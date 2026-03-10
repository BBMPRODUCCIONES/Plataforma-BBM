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
      aprobacion_undo_log: {
        Row: {
          changed_at: string
          changed_by: string
          expires_at: string
          id: string
          item_id: string
          new_estado: string
          previous_estado: string
          previous_revisado_por: string | null
          project_id: string | null
          source: string
          undone: boolean
        }
        Insert: {
          changed_at?: string
          changed_by: string
          expires_at?: string
          id?: string
          item_id: string
          new_estado: string
          previous_estado: string
          previous_revisado_por?: string | null
          project_id?: string | null
          source: string
          undone?: boolean
        }
        Update: {
          changed_at?: string
          changed_by?: string
          expires_at?: string
          id?: string
          item_id?: string
          new_estado?: string
          previous_estado?: string
          previous_revisado_por?: string | null
          project_id?: string | null
          source?: string
          undone?: boolean
        }
        Relationships: []
      }
      caja_menor_cierres: {
        Row: {
          cambios_base: string | null
          created_at: string
          desembolsado_por: string | null
          estado: string
          fecha_cierre: string
          id: string
          responsable_nombre: string
          responsable_user_id: string | null
          valor_total: number
        }
        Insert: {
          cambios_base?: string | null
          created_at?: string
          desembolsado_por?: string | null
          estado?: string
          fecha_cierre?: string
          id?: string
          responsable_nombre?: string
          responsable_user_id?: string | null
          valor_total?: number
        }
        Update: {
          cambios_base?: string | null
          created_at?: string
          desembolsado_por?: string | null
          estado?: string
          fecha_cierre?: string
          id?: string
          responsable_nombre?: string
          responsable_user_id?: string | null
          valor_total?: number
        }
        Relationships: []
      }
      caja_menor_config: {
        Row: {
          base_asignada: number
          created_at: string
          desembolsado_por: string | null
          desembolso: number
          estado_cierre: string
          fecha_cierre: string | null
          id: string
          responsable_nombre: string | null
          responsable_timestamp: string | null
          responsable_user_id: string | null
          updated_at: string
        }
        Insert: {
          base_asignada?: number
          created_at?: string
          desembolsado_por?: string | null
          desembolso?: number
          estado_cierre?: string
          fecha_cierre?: string | null
          id?: string
          responsable_nombre?: string | null
          responsable_timestamp?: string | null
          responsable_user_id?: string | null
          updated_at?: string
        }
        Update: {
          base_asignada?: number
          created_at?: string
          desembolsado_por?: string | null
          desembolso?: number
          estado_cierre?: string
          fecha_cierre?: string | null
          id?: string
          responsable_nombre?: string | null
          responsable_timestamp?: string | null
          responsable_user_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
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
          banco: string
          cargo: string
          cedula: string
          correo: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          nombre: string
          numero_cuenta: string
          telefono: string
          tipo_cuenta: string
        }
        Insert: {
          banco?: string
          cargo?: string
          cedula?: string
          correo?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          nombre?: string
          numero_cuenta?: string
          telefono?: string
          tipo_cuenta?: string
        }
        Update: {
          banco?: string
          cargo?: string
          cedula?: string
          correo?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          nombre?: string
          numero_cuenta?: string
          telefono?: string
          tipo_cuenta?: string
        }
        Relationships: []
      }
      gastos_menores: {
        Row: {
          aprobado_por_id: string | null
          aprobado_por_nombre: string | null
          categoria: string
          centro_costos: string
          concepto: string
          created_at: string
          estado: string
          evento_id: string | null
          id: string
          imagen_url: string | null
          nit_cc: string | null
          nombre_comercio: string | null
          restaurada: boolean | null
          restaurada_en: string | null
          restaurada_por: string | null
          restaurada_razon: string | null
          tipo_centro: string | null
          updated_at: string
          usuario_id: string
          usuario_nombre: string
          valor: number
        }
        Insert: {
          aprobado_por_id?: string | null
          aprobado_por_nombre?: string | null
          categoria?: string
          centro_costos?: string
          concepto?: string
          created_at?: string
          estado?: string
          evento_id?: string | null
          id?: string
          imagen_url?: string | null
          nit_cc?: string | null
          nombre_comercio?: string | null
          restaurada?: boolean | null
          restaurada_en?: string | null
          restaurada_por?: string | null
          restaurada_razon?: string | null
          tipo_centro?: string | null
          updated_at?: string
          usuario_id: string
          usuario_nombre?: string
          valor?: number
        }
        Update: {
          aprobado_por_id?: string | null
          aprobado_por_nombre?: string | null
          categoria?: string
          centro_costos?: string
          concepto?: string
          created_at?: string
          estado?: string
          evento_id?: string | null
          id?: string
          imagen_url?: string | null
          nit_cc?: string | null
          nombre_comercio?: string | null
          restaurada?: boolean | null
          restaurada_en?: string | null
          restaurada_por?: string | null
          restaurada_razon?: string | null
          tipo_centro?: string | null
          updated_at?: string
          usuario_id?: string
          usuario_nombre?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "gastos_menores_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_events: {
        Row: {
          created_at: string
          event_type: string
          google_event_id: string
          id: string
          last_synced_at: string
          project_hash: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          google_event_id: string
          id?: string
          last_synced_at?: string
          project_hash?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          google_event_id?: string
          id?: string
          last_synced_at?: string
          project_hash?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
      horarios: {
        Row: {
          cargo: string
          categoria: string
          contingencia_accuracy_m: number | null
          contingencia_contexto: Json | null
          contingencia_foto: string | null
          contingencia_hora: string | null
          contingencia_lat: number | null
          contingencia_lng: number | null
          contingencia_location_status: string | null
          contingencia_maps_url: string | null
          contingencia_ubicacion: string | null
          created_at: string
          dia: string
          empleado_id: string | null
          evento_id: string | null
          evento_nombre: string
          foto_llegada: string | null
          foto_salida: string | null
          id: string
          llegada: string
          otro_comentario: string | null
          salida: string
          ubicacion_llegada: string
          ubicacion_salida: string
          updated_at: string
        }
        Insert: {
          cargo?: string
          categoria?: string
          contingencia_accuracy_m?: number | null
          contingencia_contexto?: Json | null
          contingencia_foto?: string | null
          contingencia_hora?: string | null
          contingencia_lat?: number | null
          contingencia_lng?: number | null
          contingencia_location_status?: string | null
          contingencia_maps_url?: string | null
          contingencia_ubicacion?: string | null
          created_at?: string
          dia: string
          empleado_id?: string | null
          evento_id?: string | null
          evento_nombre?: string
          foto_llegada?: string | null
          foto_salida?: string | null
          id?: string
          llegada?: string
          otro_comentario?: string | null
          salida?: string
          ubicacion_llegada?: string
          ubicacion_salida?: string
          updated_at?: string
        }
        Update: {
          cargo?: string
          categoria?: string
          contingencia_accuracy_m?: number | null
          contingencia_contexto?: Json | null
          contingencia_foto?: string | null
          contingencia_hora?: string | null
          contingencia_lat?: number | null
          contingencia_lng?: number | null
          contingencia_location_status?: string | null
          contingencia_maps_url?: string | null
          contingencia_ubicacion?: string | null
          created_at?: string
          dia?: string
          empleado_id?: string | null
          evento_id?: string | null
          evento_nombre?: string
          foto_llegada?: string | null
          foto_salida?: string | null
          id?: string
          llegada?: string
          otro_comentario?: string | null
          salida?: string
          ubicacion_llegada?: string
          ubicacion_salida?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "horarios_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horarios_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
          permissions: Json | null
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
          permissions?: Json | null
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
          permissions?: Json | null
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          message: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      panel_column_configs: {
        Row: {
          columns: Json
          created_at: string
          id: string
          panel_key: string
          updated_at: string
          updated_by: string | null
          updated_by_email: string | null
        }
        Insert: {
          columns?: Json
          created_at?: string
          id?: string
          panel_key: string
          updated_at?: string
          updated_by?: string | null
          updated_by_email?: string | null
        }
        Update: {
          columns?: Json
          created_at?: string
          id?: string
          panel_key?: string
          updated_at?: string
          updated_by?: string | null
          updated_by_email?: string | null
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
          caja_menor: Json
          centro_costos: string
          cliente: string
          cotizaciones: Json
          cotizaciones_proveedor: Json
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          deleted_by_email: string | null
          estado: string
          evento: string
          fecha_desmontaje_fin: string
          fecha_desmontaje_inicio: string
          fecha_ejecucion_fin: string
          fecha_ejecucion_inicio: string
          fecha_montaje_fin: string
          fecha_montaje_inicio: string
          feedback: string | null
          feedback_adjuntos: Json | null
          hora_desmontaje_fin: string
          hora_desmontaje_inicio: string
          hora_ejecucion_fin: string
          hora_ejecucion_inicio: string
          hora_montaje_fin: string
          hora_montaje_inicio: string
          id: string
          ingreso_bruto: number
          ingreso_total: number
          inventario: Json
          inventario_responsable_entrada_nombre: string | null
          inventario_responsable_entrada_timestamp: string | null
          inventario_responsable_entrada_user_id: string | null
          inventario_responsable_entradas_salidas_id: string | null
          inventario_responsable_entradas_salidas_nombre: string | null
          inventario_responsable_entradas_salidas_tipo: string | null
          inventario_responsable_evento_nombre: string | null
          inventario_responsable_evento_timestamp: string | null
          inventario_responsable_evento_user_id: string | null
          inventario_responsable_material_evento_id: string | null
          inventario_responsable_material_evento_nombre: string | null
          inventario_responsable_material_evento_tipo: string | null
          inventario_responsable_salida_nombre: string | null
          inventario_responsable_salida_timestamp: string | null
          inventario_responsable_salida_user_id: string | null
          is_deleted: boolean
          jefe_operaciones: string
          legalizacion: Json | null
          notas: string
          notas_cotizacion_proveedor: string
          notas_imagenes: Json | null
          num_factura: string
          ordenes_compra: Json
          personal: Json
          productor: string
          solicitud_anticipo_num: number | null
          ubicacion: string
          updated_at: string
        }
        Insert: {
          a_cargo_de?: string
          administrativo_responsable?: string
          avanzada?: string
          caja_menor?: Json
          centro_costos?: string
          cliente?: string
          cotizaciones?: Json
          cotizaciones_proveedor?: Json
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_by_email?: string | null
          estado?: string
          evento?: string
          fecha_desmontaje_fin?: string
          fecha_desmontaje_inicio?: string
          fecha_ejecucion_fin?: string
          fecha_ejecucion_inicio?: string
          fecha_montaje_fin?: string
          fecha_montaje_inicio?: string
          feedback?: string | null
          feedback_adjuntos?: Json | null
          hora_desmontaje_fin?: string
          hora_desmontaje_inicio?: string
          hora_ejecucion_fin?: string
          hora_ejecucion_inicio?: string
          hora_montaje_fin?: string
          hora_montaje_inicio?: string
          id?: string
          ingreso_bruto?: number
          ingreso_total?: number
          inventario?: Json
          inventario_responsable_entrada_nombre?: string | null
          inventario_responsable_entrada_timestamp?: string | null
          inventario_responsable_entrada_user_id?: string | null
          inventario_responsable_entradas_salidas_id?: string | null
          inventario_responsable_entradas_salidas_nombre?: string | null
          inventario_responsable_entradas_salidas_tipo?: string | null
          inventario_responsable_evento_nombre?: string | null
          inventario_responsable_evento_timestamp?: string | null
          inventario_responsable_evento_user_id?: string | null
          inventario_responsable_material_evento_id?: string | null
          inventario_responsable_material_evento_nombre?: string | null
          inventario_responsable_material_evento_tipo?: string | null
          inventario_responsable_salida_nombre?: string | null
          inventario_responsable_salida_timestamp?: string | null
          inventario_responsable_salida_user_id?: string | null
          is_deleted?: boolean
          jefe_operaciones?: string
          legalizacion?: Json | null
          notas?: string
          notas_cotizacion_proveedor?: string
          notas_imagenes?: Json | null
          num_factura?: string
          ordenes_compra?: Json
          personal?: Json
          productor?: string
          solicitud_anticipo_num?: number | null
          ubicacion?: string
          updated_at?: string
        }
        Update: {
          a_cargo_de?: string
          administrativo_responsable?: string
          avanzada?: string
          caja_menor?: Json
          centro_costos?: string
          cliente?: string
          cotizaciones?: Json
          cotizaciones_proveedor?: Json
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_by_email?: string | null
          estado?: string
          evento?: string
          fecha_desmontaje_fin?: string
          fecha_desmontaje_inicio?: string
          fecha_ejecucion_fin?: string
          fecha_ejecucion_inicio?: string
          fecha_montaje_fin?: string
          fecha_montaje_inicio?: string
          feedback?: string | null
          feedback_adjuntos?: Json | null
          hora_desmontaje_fin?: string
          hora_desmontaje_inicio?: string
          hora_ejecucion_fin?: string
          hora_ejecucion_inicio?: string
          hora_montaje_fin?: string
          hora_montaje_inicio?: string
          id?: string
          ingreso_bruto?: number
          ingreso_total?: number
          inventario?: Json
          inventario_responsable_entrada_nombre?: string | null
          inventario_responsable_entrada_timestamp?: string | null
          inventario_responsable_entrada_user_id?: string | null
          inventario_responsable_entradas_salidas_id?: string | null
          inventario_responsable_entradas_salidas_nombre?: string | null
          inventario_responsable_entradas_salidas_tipo?: string | null
          inventario_responsable_evento_nombre?: string | null
          inventario_responsable_evento_timestamp?: string | null
          inventario_responsable_evento_user_id?: string | null
          inventario_responsable_material_evento_id?: string | null
          inventario_responsable_material_evento_nombre?: string | null
          inventario_responsable_material_evento_tipo?: string | null
          inventario_responsable_salida_nombre?: string | null
          inventario_responsable_salida_timestamp?: string | null
          inventario_responsable_salida_user_id?: string | null
          is_deleted?: boolean
          jefe_operaciones?: string
          legalizacion?: Json | null
          notas?: string
          notas_cotizacion_proveedor?: string
          notas_imagenes?: Json | null
          num_factura?: string
          ordenes_compra?: Json
          personal?: Json
          productor?: string
          solicitud_anticipo_num?: number | null
          ubicacion?: string
          updated_at?: string
        }
        Relationships: []
      }
      supplier_cotizacion_history: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          deleted_by_email: string | null
          evento_id: string | null
          fecha: string
          feedback: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_url: string
          id: string
          migrated: boolean | null
          migrated_at: string | null
          personal_item_id: string | null
          proveedor_categoria: string
          proveedor_correo: string
          proveedor_id: string
          proveedor_nombre: string
          proveedor_telefono: string
          proveedor_tipo_producto_servicio: string
          updated_at: string
          uploaded_by: string | null
          uploaded_by_email: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_by_email?: string | null
          evento_id?: string | null
          fecha?: string
          feedback?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_url: string
          id?: string
          migrated?: boolean | null
          migrated_at?: string | null
          personal_item_id?: string | null
          proveedor_categoria?: string
          proveedor_correo?: string
          proveedor_id: string
          proveedor_nombre: string
          proveedor_telefono?: string
          proveedor_tipo_producto_servicio?: string
          updated_at?: string
          uploaded_by?: string | null
          uploaded_by_email?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_by_email?: string | null
          evento_id?: string | null
          fecha?: string
          feedback?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_url?: string
          id?: string
          migrated?: boolean | null
          migrated_at?: string | null
          personal_item_id?: string | null
          proveedor_categoria?: string
          proveedor_correo?: string
          proveedor_id?: string
          proveedor_nombre?: string
          proveedor_telefono?: string
          proveedor_tipo_producto_servicio?: string
          updated_at?: string
          uploaded_by?: string | null
          uploaded_by_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_cotizacion_history_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_cotizacion_history_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          banco: string
          categoria: string
          certificado_bancario: string | null
          correo: string
          cotizaciones: Json
          created_at: string
          id: string
          nombre: string
          notas: string
          numero_cuenta: string
          telefono: string
          tipo_cuenta: string
          tipo_producto_servicio: string
          updated_at: string
        }
        Insert: {
          banco?: string
          categoria?: string
          certificado_bancario?: string | null
          correo?: string
          cotizaciones?: Json
          created_at?: string
          id?: string
          nombre?: string
          notas?: string
          numero_cuenta?: string
          telefono?: string
          tipo_cuenta?: string
          tipo_producto_servicio?: string
          updated_at?: string
        }
        Update: {
          banco?: string
          categoria?: string
          certificado_bancario?: string | null
          correo?: string
          cotizaciones?: Json
          created_at?: string
          id?: string
          nombre?: string
          notas?: string
          numero_cuenta?: string
          telefono?: string
          tipo_cuenta?: string
          tipo_producto_servicio?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_audit_log: {
        Row: {
          action: string
          actor_email: string
          actor_id: string
          created_at: string
          details: Json | null
          id: string
          panel: string | null
          target_email: string | null
          target_id: string | null
          target_role: string | null
        }
        Insert: {
          action: string
          actor_email: string
          actor_id: string
          created_at?: string
          details?: Json | null
          id?: string
          panel?: string | null
          target_email?: string | null
          target_id?: string | null
          target_role?: string | null
        }
        Update: {
          action?: string
          actor_email?: string
          actor_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          panel?: string | null
          target_email?: string | null
          target_id?: string | null
          target_role?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          allowed_panels: string[] | null
          email: string | null
          id: string
          puede_acceder_agentes: boolean | null
          puede_acceder_clientes: boolean | null
          puede_acceder_constructor: boolean | null
          puede_acceder_empleados: boolean | null
          puede_acceder_usuarios: boolean | null
          puede_aprobar_caja_menor: boolean | null
          puede_asignar_responsables: boolean | null
          puede_crear_anticipos: boolean | null
          puede_editar_directivo: boolean | null
          puede_editar_feedback: boolean | null
          puede_editar_general: boolean | null
          puede_editar_inventario: boolean | null
          puede_editar_operaciones: boolean | null
          puede_editar_personal: boolean | null
          puede_restaurar_solicitudes: boolean | null
          puede_ver_feedback: boolean | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          allowed_panels?: string[] | null
          email?: string | null
          id?: string
          puede_acceder_agentes?: boolean | null
          puede_acceder_clientes?: boolean | null
          puede_acceder_constructor?: boolean | null
          puede_acceder_empleados?: boolean | null
          puede_acceder_usuarios?: boolean | null
          puede_aprobar_caja_menor?: boolean | null
          puede_asignar_responsables?: boolean | null
          puede_crear_anticipos?: boolean | null
          puede_editar_directivo?: boolean | null
          puede_editar_feedback?: boolean | null
          puede_editar_general?: boolean | null
          puede_editar_inventario?: boolean | null
          puede_editar_operaciones?: boolean | null
          puede_editar_personal?: boolean | null
          puede_restaurar_solicitudes?: boolean | null
          puede_ver_feedback?: boolean | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          allowed_panels?: string[] | null
          email?: string | null
          id?: string
          puede_acceder_agentes?: boolean | null
          puede_acceder_clientes?: boolean | null
          puede_acceder_constructor?: boolean | null
          puede_acceder_empleados?: boolean | null
          puede_acceder_usuarios?: boolean | null
          puede_aprobar_caja_menor?: boolean | null
          puede_asignar_responsables?: boolean | null
          puede_crear_anticipos?: boolean | null
          puede_editar_directivo?: boolean | null
          puede_editar_feedback?: boolean | null
          puede_editar_general?: boolean | null
          puede_editar_inventario?: boolean | null
          puede_editar_operaciones?: boolean | null
          puede_editar_personal?: boolean | null
          puede_restaurar_solicitudes?: boolean | null
          puede_ver_feedback?: boolean | null
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
      assign_solicitud_anticipo_num: {
        Args: { p_project_id: string }
        Returns: number
      }
      get_employee_name_by_id: {
        Args: { _employee_id: string }
        Returns: string
      }
      get_employees_for_role: {
        Args: never
        Returns: {
          banco: string
          cargo: string
          cedula: string
          correo: string
          created_at: string
          id: string
          nombre: string
          numero_cuenta: string
          telefono: string
          tipo_cuenta: string
        }[]
      }
      get_my_employee: {
        Args: never
        Returns: {
          cargo: string
          correo: string
          id: string
          nombre: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      validate_invitation_by_token: {
        Args: { _token: string }
        Returns: {
          allowed_panels: string[]
          email: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
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
