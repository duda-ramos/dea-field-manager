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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          last_used_at: string | null
          name: string
          permissions: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          last_used_at?: string | null
          name: string
          permissions?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          last_used_at?: string | null
          name?: string
          permissions?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      budgets: {
        Row: {
          amount: number
          created_at: string
          id: string
          project_id: string
          status: string | null
          supplier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          project_id: string
          status?: string | null
          supplier: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          project_id?: string
          status?: string | null
          supplier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      collaboration_events: {
        Row: {
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          access_count: number | null
          created_at: string
          data_classification: string | null
          email: string
          id: string
          last_accessed_at: string | null
          name: string
          phone: string
          project_id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_count?: number | null
          created_at?: string
          data_classification?: string | null
          email: string
          id?: string
          last_accessed_at?: string | null
          name: string
          phone: string
          project_id: string
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_count?: number | null
          created_at?: string
          data_classification?: string | null
          email?: string
          id?: string
          last_accessed_at?: string | null
          name?: string
          phone?: string
          project_id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          created_at: string
          id: string
          installation_id: string | null
          name: string
          project_id: string | null
          size: number
          storage_path: string | null
          type: string
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          installation_id?: string | null
          name: string
          project_id?: string | null
          size: number
          storage_path?: string | null
          type: string
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          installation_id?: string | null
          name?: string
          project_id?: string | null
          size?: number
          storage_path?: string | null
          type?: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_installation_id_fkey"
            columns: ["installation_id"]
            isOneToOne: false
            referencedRelation: "installations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      installations: {
        Row: {
          codigo: number
          comentarios_fornecedor: string | null
          created_at: string
          descricao: string
          diretriz_altura_cm: number | null
          diretriz_dist_batente_cm: number | null
          id: string
          installed: boolean | null
          installed_at: string | null
          observacoes: string | null
          pavimento: string
          pendencia_descricao: string | null
          pendencia_tipo: string | null
          photos: string[] | null
          project_id: string
          quantidade: number
          revisado: boolean | null
          revisao: number | null
          tipologia: string
          updated_at: string
          user_id: string
        }
        Insert: {
          codigo: number
          comentarios_fornecedor?: string | null
          created_at?: string
          descricao: string
          diretriz_altura_cm?: number | null
          diretriz_dist_batente_cm?: number | null
          id?: string
          installed?: boolean | null
          installed_at?: string | null
          observacoes?: string | null
          pavimento: string
          pendencia_descricao?: string | null
          pendencia_tipo?: string | null
          photos?: string[] | null
          project_id: string
          quantidade: number
          revisado?: boolean | null
          revisao?: number | null
          tipologia: string
          updated_at?: string
          user_id: string
        }
        Update: {
          codigo?: number
          comentarios_fornecedor?: string | null
          created_at?: string
          descricao?: string
          diretriz_altura_cm?: number | null
          diretriz_dist_batente_cm?: number | null
          id?: string
          installed?: boolean | null
          installed_at?: string | null
          observacoes?: string | null
          pavimento?: string
          pendencia_descricao?: string | null
          pendencia_tipo?: string | null
          photos?: string[] | null
          project_id?: string
          quantidade?: number
          revisado?: boolean | null
          revisao?: number | null
          tipologia?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "installations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      item_versions: {
        Row: {
          created_at: string
          descricao_motivo: string | null
          id: string
          installation_id: string
          motivo: string
          revisao: number
          snapshot: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          descricao_motivo?: string | null
          id?: string
          installation_id: string
          motivo: string
          revisao: number
          snapshot: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          descricao_motivo?: string | null
          id?: string
          installation_id?: string
          motivo?: string
          revisao?: number
          snapshot?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_versions_installation_id_fkey"
            columns: ["installation_id"]
            isOneToOne: false
            referencedRelation: "installations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_activities: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: []
      }
      project_backups: {
        Row: {
          backup_data: Json
          backup_type: string
          created_at: string
          file_count: number | null
          id: string
          project_id: string
          restore_point: boolean | null
          total_size: number | null
        }
        Insert: {
          backup_data: Json
          backup_type?: string
          created_at?: string
          file_count?: number | null
          id?: string
          project_id: string
          restore_point?: boolean | null
          total_size?: number | null
        }
        Update: {
          backup_data?: Json
          backup_type?: string
          created_at?: string
          file_count?: number | null
          id?: string
          project_id?: string
          restore_point?: boolean | null
          total_size?: number | null
        }
        Relationships: []
      }
      project_collaborators: {
        Row: {
          accepted_at: string | null
          id: string
          invited_at: string
          invited_by: string
          permissions: Json
          project_id: string
          role: string
          status: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          id?: string
          invited_at?: string
          invited_by: string
          permissions?: Json
          project_id: string
          role?: string
          status?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          id?: string
          invited_at?: string
          invited_by?: string
          permissions?: Json
          project_id?: string
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      project_files: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_templates: {
        Row: {
          category: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_public: boolean
          name: string
          preview_image: string | null
          template_data: Json
          updated_at: string
          usage_count: number
        }
        Insert: {
          category?: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_public?: boolean
          name: string
          preview_image?: string | null
          template_data: Json
          updated_at?: string
          usage_count?: number
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name?: string
          preview_image?: string | null
          template_data?: Json
          updated_at?: string
          usage_count?: number
        }
        Relationships: []
      }
      project_versions: {
        Row: {
          change_description: string | null
          created_at: string
          id: string
          project_id: string
          size_bytes: number | null
          snapshot: Json
          user_id: string
          version_number: number
        }
        Insert: {
          change_description?: string | null
          created_at?: string
          id?: string
          project_id: string
          size_bytes?: number | null
          snapshot: Json
          user_id: string
          version_number: number
        }
        Update: {
          change_description?: string | null
          created_at?: string
          id?: string
          project_id?: string
          size_bytes?: number | null
          snapshot?: Json
          user_id?: string
          version_number?: number
        }
        Relationships: []
      }
      projects: {
        Row: {
          city: string
          client: string
          code: string | null
          created_at: string
          id: string
          inauguration_date: string | null
          installation_date: string | null
          name: string
          owner_name: string | null
          project_files_link: string | null
          status: string | null
          suppliers: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          city: string
          client: string
          code?: string | null
          created_at?: string
          id?: string
          inauguration_date?: string | null
          installation_date?: string | null
          name: string
          owner_name?: string | null
          project_files_link?: string | null
          status?: string | null
          suppliers?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string
          client?: string
          code?: string | null
          created_at?: string
          id?: string
          inauguration_date?: string | null
          installation_date?: string | null
          name?: string
          owner_name?: string | null
          project_files_link?: string | null
          status?: string | null
          suppliers?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      storage_integrations: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_active: boolean
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config: Json
          created_at?: string
          id?: string
          is_active?: boolean
          provider: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      validate_password_strength: {
        Args: { password: string }
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
