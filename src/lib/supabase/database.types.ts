
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "activity_logs": {
                  Row: {
                    "amount": number | null,"commitment_id": string | null,"created_at": string,"description": string | null,"goal_id": string,"id": string,"note": string | null,"occurred_on": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount"?: number | null,"commitment_id"?: string | null,"created_at"?: string,"description"?: string | null,"goal_id": string,"id"?: string,"note"?: string | null,"occurred_on": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "amount"?: number | null,"commitment_id"?: string | null,"created_at"?: string,"description"?: string | null,"goal_id"?: string,"id"?: string,"note"?: string | null,"occurred_on"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_logs_commitment_fk"
      columns: ["commitment_id","goal_id","user_id"]
isOneToOne: false
      referencedRelation: "commitment_progress"
      referencedColumns: ["id","goal_id","user_id"]
    },{
      foreignKeyName: "activity_logs_commitment_fk"
      columns: ["commitment_id","goal_id","user_id"]
isOneToOne: false
      referencedRelation: "commitments"
      referencedColumns: ["id","goal_id","user_id"]
    },{
      foreignKeyName: "activity_logs_goal_fk"
      columns: ["goal_id","user_id"]
isOneToOne: false
      referencedRelation: "goals"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "activity_logs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"commitments": {
                  Row: {
                    "created_at": string,"goal_id": string,"id": string,"measure": string,"minimum_value": number | null,"position": number,"target_value": number | null,"title": string,"unit": string | null,"updated_at": string,"user_id": string,"week_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"goal_id": string,"id"?: string,"measure": string,"minimum_value"?: number | null,"position"?: number,"target_value"?: number | null,"title": string,"unit"?: string | null,"updated_at"?: string,"user_id"?: string,"week_start": string
                  }
                  Update: {
                    "created_at"?: string,"goal_id"?: string,"id"?: string,"measure"?: string,"minimum_value"?: number | null,"position"?: number,"target_value"?: number | null,"title"?: string,"unit"?: string | null,"updated_at"?: string,"user_id"?: string,"week_start"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "commitments_goal_fk"
      columns: ["goal_id","user_id"]
isOneToOne: false
      referencedRelation: "goals"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "commitments_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"evidence": {
                  Row: {
                    "caption": string | null,"created_at": string,"id": string,"log_id": string,"mime_type": string,"size_bytes": number,"storage_path": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "caption"?: string | null,"created_at"?: string,"id"?: string,"log_id": string,"mime_type": string,"size_bytes": number,"storage_path": string,"user_id"?: string
                  }
                  Update: {
                    "caption"?: string | null,"created_at"?: string,"id"?: string,"log_id"?: string,"mime_type"?: string,"size_bytes"?: number,"storage_path"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "evidence_log_fk"
      columns: ["log_id","user_id"]
isOneToOne: false
      referencedRelation: "activity_logs"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "evidence_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"goal_checkins": {
                  Row: {
                    "created_at": string,"goal_id": string,"id": string,"note": string | null,"status": string,"updated_at": string,"user_id": string,"week_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"goal_id": string,"id"?: string,"note"?: string | null,"status": string,"updated_at"?: string,"user_id"?: string,"week_start": string
                  }
                  Update: {
                    "created_at"?: string,"goal_id"?: string,"id"?: string,"note"?: string | null,"status"?: string,"updated_at"?: string,"user_id"?: string,"week_start"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "goal_checkins_goal_fk"
      columns: ["goal_id","user_id"]
isOneToOne: false
      referencedRelation: "goals"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "goal_checkins_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"goals": {
                  Row: {
                    "capital": string,"created_at": string,"id": string,"is_primary": boolean,"kind": string,"outcome": string | null,"reward": string | null,"shared_with_partners": boolean,"show_numbers": boolean,"start_date": string,"status": string,"target_date": string,"target_value": number | null,"title": string,"unit": string | null,"updated_at": string,"user_id": string,"weekly_minimum": number | null,"weekly_target": number | null,"why": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "capital": string,"created_at"?: string,"id"?: string,"is_primary"?: boolean,"kind": string,"outcome"?: string | null,"reward"?: string | null,"shared_with_partners"?: boolean,"show_numbers"?: boolean,"start_date"?: string,"status"?: string,"target_date"?: string,"target_value"?: number | null,"title": string,"unit"?: string | null,"updated_at"?: string,"user_id"?: string,"weekly_minimum"?: number | null,"weekly_target"?: number | null,"why"?: string | null
                  }
                  Update: {
                    "capital"?: string,"created_at"?: string,"id"?: string,"is_primary"?: boolean,"kind"?: string,"outcome"?: string | null,"reward"?: string | null,"shared_with_partners"?: boolean,"show_numbers"?: boolean,"start_date"?: string,"status"?: string,"target_date"?: string,"target_value"?: number | null,"title"?: string,"unit"?: string | null,"updated_at"?: string,"user_id"?: string,"weekly_minimum"?: number | null,"weekly_target"?: number | null,"why"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "goals_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"milestones": {
                  Row: {
                    "achieved_at": string | null,"created_at": string,"goal_id": string,"id": string,"quarter_start": string,"reward": string | null,"target_value": number | null,"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "achieved_at"?: string | null,"created_at"?: string,"goal_id": string,"id"?: string,"quarter_start": string,"reward"?: string | null,"target_value"?: number | null,"title": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "achieved_at"?: string | null,"created_at"?: string,"goal_id"?: string,"id"?: string,"quarter_start"?: string,"reward"?: string | null,"target_value"?: number | null,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "milestones_goal_fk"
      columns: ["goal_id","user_id"]
isOneToOne: false
      referencedRelation: "goals"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "milestones_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"partner_notes": {
                  Row: {
                    "author_id": string,"body": string,"created_at": string,"id": string,"reflection_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string,"body": string,"created_at"?: string,"id"?: string,"reflection_id": string,"updated_at"?: string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"created_at"?: string,"id"?: string,"reflection_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "partner_notes_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "partner_notes_reflection_id_fkey"
      columns: ["reflection_id"]
isOneToOne: false
      referencedRelation: "reflections"
      referencedColumns: ["id"]
    }
                  ]
                },"partnerships": {
                  Row: {
                    "accepted_at": string | null,"created_at": string,"ended_at": string | null,"id": string,"invite_email": string | null,"invite_expires_at": string,"invite_label": string | null,"invite_token_hash": string,"member_id": string,"partner_id": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"created_at"?: string,"ended_at"?: string | null,"id"?: string,"invite_email"?: string | null,"invite_expires_at"?: string,"invite_label"?: string | null,"invite_token_hash": string,"member_id"?: string,"partner_id"?: string | null,"status"?: string
                  }
                  Update: {
                    "accepted_at"?: string | null,"created_at"?: string,"ended_at"?: string | null,"id"?: string,"invite_email"?: string | null,"invite_expires_at"?: string,"invite_label"?: string | null,"invite_token_hash"?: string,"member_id"?: string,"partner_id"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "partnerships_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "partnerships_partner_id_fkey"
      columns: ["partner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string,"focus_capitals": (unknown)[],"id": string,"onboarded_at": string | null,"timezone": string,"updated_at": string,"vision": string | null,"vision_why": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string,"focus_capitals"?: (unknown)[],"id": string,"onboarded_at"?: string | null,"timezone"?: string,"updated_at"?: string,"vision"?: string | null,"vision_why"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"focus_capitals"?: (unknown)[],"id"?: string,"onboarded_at"?: string | null,"timezone"?: string,"updated_at"?: string,"vision"?: string | null,"vision_why"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"reflections": {
                  Row: {
                    "challenges": string | null,"created_at": string,"id": string,"learned": string | null,"next_steps": string | null,"period_start": string,"period_type": string,"published_at": string | null,"snapshot": Json | null,"support_needed": string | null,"updated_at": string,"user_id": string,"wins": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "challenges"?: string | null,"created_at"?: string,"id"?: string,"learned"?: string | null,"next_steps"?: string | null,"period_start": string,"period_type": string,"published_at"?: string | null,"snapshot"?: Json | null,"support_needed"?: string | null,"updated_at"?: string,"user_id"?: string,"wins"?: string | null
                  }
                  Update: {
                    "challenges"?: string | null,"created_at"?: string,"id"?: string,"learned"?: string | null,"next_steps"?: string | null,"period_start"?: string,"period_type"?: string,"published_at"?: string | null,"snapshot"?: Json | null,"support_needed"?: string | null,"updated_at"?: string,"user_id"?: string,"wins"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "reflections_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "commitment_progress": {
                  Row: {
                    "actual": number | null,"goal_id": string | null,"id": string | null,"result": string | null,"user_id": string | null,"week_start": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "commitments_goal_fk"
      columns: ["goal_id","user_id"]
isOneToOne: false
      referencedRelation: "goals"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "commitments_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "accept_partner_invite":
{ Args: { "p_token": string }; Returns: string
                           },
"can_partner_read_checkin":
{ Args: { "p_reflection_id": string }; Returns: boolean
                           },
"end_partnership":
{ Args: { "p_partnership_id": string }; Returns: undefined
                           },
"invite_preview":
{ Args: { "p_token": string }; Returns: {
              "invited_email": string,"inviter_name": string,"valid": boolean
            }[]
                           },
"is_quarter_start":
{ Args: { "d": string }; Returns: boolean
                           },
"is_week_start":
{ Args: { "d": string }; Returns: boolean
                           },
"my_partnerships":
{ Args: Record<PropertyKey, never>; Returns: {
              "accepted_at": string,"created_at": string,"invite_email": string,"invite_expires_at": string,"invite_label": string,"other_display_name": string,"other_user_id": string,"partnership_id": string,"role": string,"status": string
            }[]
                           },
"partner_checkins":
{ Args: { "p_member_id"?: string }; Returns: {
              "member_display_name": string,"member_id": string,"period_start": string,"period_type": string,"published_at": string,"reflection_id": string,"snapshot": Json
            }[]
                           },
"publish_checkin":
{ Args: { "p_commitment_ids": (string)[],"p_reflection_id": string }; Returns: undefined
                           },
"unpublish_checkin":
{ Args: { "p_reflection_id": string }; Returns: undefined
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
