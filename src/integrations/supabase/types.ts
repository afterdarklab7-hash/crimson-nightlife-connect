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
      chat_settings: {
        Row: {
          free_chat_enabled: boolean
          free_message_quota: number
          id: number
          message_cost_kes: number
          updated_at: string
        }
        Insert: {
          free_chat_enabled?: boolean
          free_message_quota?: number
          id?: number
          message_cost_kes?: number
          updated_at?: string
        }
        Update: {
          free_chat_enabled?: boolean
          free_message_quota?: number
          id?: number
          message_cost_kes?: number
          updated_at?: string
        }
        Relationships: []
      }
      location_logs: {
        Row: {
          accuracy: number | null
          created_at: string
          id: string
          lat: number
          lng: number
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          created_at?: string
          id?: string
          lat: number
          lng: number
          user_id: string
        }
        Update: {
          accuracy?: number | null
          created_at?: string
          id?: string
          lat?: number
          lng?: number
          user_id?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          created_at: string
          id: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string | null
          created_at: string
          id: string
          match_id: string
          read_at: string | null
          recipient_id: string
          reply_to_id: string | null
          sender_id: string
          voice_duration_ms: number | null
          voice_url: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          match_id: string
          read_at?: string | null
          recipient_id: string
          reply_to_id?: string | null
          sender_id: string
          voice_duration_ms?: number | null
          voice_url?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          match_id?: string
          read_at?: string | null
          recipient_id?: string
          reply_to_id?: string | null
          sender_id?: string
          voice_duration_ms?: number | null
          voice_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          position: number
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          position?: number
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          position?: number
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          bio: string | null
          city: string | null
          county: string | null
          created_at: string
          dob: string | null
          full_name: string | null
          gender: Database["public"]["Enums"]["gender_t"] | null
          hosting: Database["public"]["Enums"]["hosting_pref"] | null
          id: string
          interested_in: Database["public"]["Enums"]["gender_t"][] | null
          is_banned: boolean
          is_hidden: boolean
          is_verified: boolean
          is_vip: boolean
          last_active: string
          lat: number | null
          lng: number | null
          onboarded: boolean
          updated_at: string
          username: string | null
        }
        Insert: {
          bio?: string | null
          city?: string | null
          county?: string | null
          created_at?: string
          dob?: string | null
          full_name?: string | null
          gender?: Database["public"]["Enums"]["gender_t"] | null
          hosting?: Database["public"]["Enums"]["hosting_pref"] | null
          id: string
          interested_in?: Database["public"]["Enums"]["gender_t"][] | null
          is_banned?: boolean
          is_hidden?: boolean
          is_verified?: boolean
          is_vip?: boolean
          last_active?: string
          lat?: number | null
          lng?: number | null
          onboarded?: boolean
          updated_at?: string
          username?: string | null
        }
        Update: {
          bio?: string | null
          city?: string | null
          county?: string | null
          created_at?: string
          dob?: string | null
          full_name?: string | null
          gender?: Database["public"]["Enums"]["gender_t"] | null
          hosting?: Database["public"]["Enums"]["hosting_pref"] | null
          id?: string
          interested_in?: Database["public"]["Enums"]["gender_t"][] | null
          is_banned?: boolean
          is_hidden?: boolean
          is_verified?: boolean
          is_vip?: boolean
          last_active?: string
          lat?: number | null
          lng?: number | null
          onboarded?: boolean
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string
          status: string
          target_id: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id: string
          status?: string
          target_id: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          status?: string
          target_id?: string
        }
        Relationships: []
      }
      room_bookings: {
        Row: {
          confirmation_code: string | null
          created_at: string
          ends_at: string
          guests: number
          id: string
          room_id: string
          starts_at: string
          status: string
          total_kes: number
          user_id: string
        }
        Insert: {
          confirmation_code?: string | null
          created_at?: string
          ends_at: string
          guests?: number
          id?: string
          room_id: string
          starts_at: string
          status?: string
          total_kes: number
          user_id: string
        }
        Update: {
          confirmation_code?: string | null
          created_at?: string
          ends_at?: string
          guests?: number
          id?: string
          room_id?: string
          starts_at?: string
          status?: string
          total_kes?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          address: string | null
          amenities: string[] | null
          capacity: number
          city: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          price_kes: number
        }
        Insert: {
          address?: string | null
          amenities?: string[] | null
          capacity?: number
          city?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          price_kes: number
        }
        Update: {
          address?: string | null
          amenities?: string[] | null
          capacity?: number
          city?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price_kes?: number
        }
        Relationships: []
      }
      swipes: {
        Row: {
          action: Database["public"]["Enums"]["swipe_action"]
          created_at: string
          id: string
          swiper_id: string
          target_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["swipe_action"]
          created_at?: string
          id?: string
          swiper_id: string
          target_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["swipe_action"]
          created_at?: string
          id?: string
          swiper_id?: string
          target_id?: string
        }
        Relationships: []
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
      wallet_transactions: {
        Row: {
          amount_kes: number
          created_at: string
          id: string
          kind: string
          ref: string | null
          user_id: string
        }
        Insert: {
          amount_kes: number
          created_at?: string
          id?: string
          kind: string
          ref?: string | null
          user_id: string
        }
        Update: {
          amount_kes?: number
          created_at?: string
          id?: string
          kind?: string
          ref?: string | null
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance_kes: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_kes?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_kes?: number
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
      claim_first_admin: { Args: never; Returns: Json }
      distance_km: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "user" | "moderator" | "admin"
      gender_t: "male" | "female" | "non_binary" | "other"
      hosting_pref: "hosting" | "to_be_hosted" | "lets_get_a_room"
      swipe_action: "like" | "super_like" | "pass"
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
      app_role: ["user", "moderator", "admin"],
      gender_t: ["male", "female", "non_binary", "other"],
      hosting_pref: ["hosting", "to_be_hosted", "lets_get_a_room"],
      swipe_action: ["like", "super_like", "pass"],
    },
  },
} as const
