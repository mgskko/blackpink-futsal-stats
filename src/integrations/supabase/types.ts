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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      goal_events: {
        Row: {
          assist_player_id: number | null
          goal_player_id: number | null
          id: number
          is_own_goal: boolean
          match_id: number
          quarter: number
          team_id: number
          video_timestamp: string | null
        }
        Insert: {
          assist_player_id?: number | null
          goal_player_id?: number | null
          id?: number
          is_own_goal?: boolean
          match_id: number
          quarter: number
          team_id: number
          video_timestamp?: string | null
        }
        Update: {
          assist_player_id?: number | null
          goal_player_id?: number | null
          id?: number
          is_own_goal?: boolean
          match_id?: number
          quarter?: number
          team_id?: number
          video_timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goal_events_assist_player_id_fkey"
            columns: ["assist_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_events_goal_player_id_fkey"
            columns: ["goal_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      match_attendance: {
        Row: {
          id: string
          match_id: number
          player_id: number
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          match_id: number
          player_id: number
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          match_id?: number
          player_id?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_attendance_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_attendance_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      match_predictions: {
        Row: {
          created_at: string
          id: string
          match_id: number
          prediction: string
          voter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: number
          prediction: string
          voter_id: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: number
          prediction?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_predictions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          date: string
          has_detail_log: boolean
          id: number
          is_custom: boolean
          match_type: string
          venue_id: number | null
          youtube_link: string | null
        }
        Insert: {
          date: string
          has_detail_log?: boolean
          id?: number
          is_custom?: boolean
          match_type?: string
          venue_id?: number | null
          youtube_link?: string | null
        }
        Update: {
          date?: string
          has_detail_log?: boolean
          id?: number
          is_custom?: boolean
          match_type?: string
          venue_id?: number | null
          youtube_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      mom_votes: {
        Row: {
          created_at: string
          id: string
          match_id: number
          voted_player_id: number
          voter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: number
          voted_player_id: number
          voter_id: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: number
          voted_player_id?: number
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mom_votes_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mom_votes_voted_player_id_fkey"
            columns: ["voted_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_dues: {
        Row: {
          id: string
          is_paid: boolean
          player_id: number
          updated_at: string
          updated_by: string | null
          year_month: string
        }
        Insert: {
          id?: string
          is_paid?: boolean
          player_id: number
          updated_at?: string
          updated_by?: string | null
          year_month: string
        }
        Update: {
          id?: string
          is_paid?: boolean
          player_id?: number
          updated_at?: string
          updated_by?: string | null
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_dues_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          back_number: number | null
          id: number
          is_active: boolean
          join_date: string
          name: string
          profile_image_url: string | null
        }
        Insert: {
          back_number?: number | null
          id: number
          is_active?: boolean
          join_date: string
          name: string
          profile_image_url?: string | null
        }
        Update: {
          back_number?: number | null
          id?: number
          is_active?: boolean
          join_date?: string
          name?: string
          profile_image_url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          player_id: number | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          player_id?: number | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          player_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      results: {
        Row: {
          id: number
          match_id: number
          result: string
          score_against: number | null
          score_for: number | null
          team_id: number
        }
        Insert: {
          id?: number
          match_id: number
          result: string
          score_against?: number | null
          score_for?: number | null
          team_id: number
        }
        Update: {
          id?: number
          match_id?: number
          result?: string
          score_against?: number | null
          score_for?: number | null
          team_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "results_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      rosters: {
        Row: {
          assists: number | null
          goals: number | null
          id: number
          match_id: number
          player_id: number
          team_id: number
        }
        Insert: {
          assists?: number | null
          goals?: number | null
          id?: number
          match_id: number
          player_id: number
          team_id: number
        }
        Update: {
          assists?: number | null
          goals?: number | null
          id?: number
          match_id?: number
          player_id?: number
          team_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "rosters_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rosters_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rosters_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          age_category: string | null
          id: number
          is_ours: boolean
          match_id: number
          name: string
          original_age_desc: string | null
        }
        Insert: {
          age_category?: string | null
          id?: number
          is_ours?: boolean
          match_id: number
          name: string
          original_age_desc?: string | null
        }
        Update: {
          age_category?: string | null
          id?: number
          is_ours?: boolean
          match_id?: number
          name?: string
          original_age_desc?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      venues: {
        Row: {
          id: number
          name: string
        }
        Insert: {
          id: number
          name: string
        }
        Update: {
          id?: number
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_admin_by_email: { Args: { admin_email: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
