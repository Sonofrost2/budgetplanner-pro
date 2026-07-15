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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          feature: string
          hits: number
          id: string
          response: Json
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at?: string
          feature: string
          hits?: number
          id?: string
          response: Json
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          feature?: string
          hits?: number
          id?: string
          response?: Json
        }
        Relationships: []
      }
      ai_conversations: {
        Row: {
          archived: boolean
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_resolutions: {
        Row: {
          alert_type: string
          cancelled_count: number
          id: string
          reason: string
          reference_id: string
          resolved_at: string
          user_id: string
        }
        Insert: {
          alert_type: string
          cancelled_count?: number
          id?: string
          reason: string
          reference_id: string
          resolved_at?: string
          user_id: string
        }
        Update: {
          alert_type?: string
          cancelled_count?: number
          id?: string
          reason?: string
          reference_id?: string
          resolved_at?: string
          user_id?: string
        }
        Relationships: []
      }
      asset_valuations: {
        Row: {
          asset_id: string
          created_at: string
          id: string
          notes: string | null
          source: string | null
          user_id: string
          value: number
          valued_at: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          id?: string
          notes?: string | null
          source?: string | null
          user_id: string
          value: number
          valued_at?: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          source?: string | null
          user_id?: string
          value?: number
          valued_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_valuations_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_valuations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_overview"
            referencedColumns: ["user_id"]
          },
        ]
      }
      assets: {
        Row: {
          acquisition_cost: number | null
          acquisition_date: string | null
          asset_type: string
          category: string
          created_at: string
          currency: string
          current_value: number
          icon: string
          id: string
          location: string | null
          metadata: Json
          name: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          acquisition_cost?: number | null
          acquisition_date?: string | null
          asset_type?: string
          category?: string
          created_at?: string
          currency?: string
          current_value?: number
          icon?: string
          id?: string
          location?: string | null
          metadata?: Json
          name: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          acquisition_cost?: number | null
          acquisition_date?: string | null
          asset_type?: string
          category?: string
          created_at?: string
          currency?: string
          current_value?: number
          icon?: string
          id?: string
          location?: string | null
          metadata?: Json
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_overview"
            referencedColumns: ["user_id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          actor_id: string | null
          created_at: string
          event_subtype: string | null
          event_type: string
          id: string
          ip_address: unknown
          metadata: Json
          reason: string | null
          resource_id: string | null
          status: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_subtype?: string | null
          event_type: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          reason?: string | null
          resource_id?: string | null
          status?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_subtype?: string | null
          event_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          reason?: string | null
          resource_id?: string | null
          status?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      budget_cycle_history: {
        Row: {
          amount_budgeted: number
          amount_spent: number
          budget_id: string
          carry_over_amount: number
          closed_at: string
          created_at: string
          cycle_end: string
          cycle_start: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          amount_budgeted: number
          amount_spent?: number
          budget_id: string
          carry_over_amount?: number
          closed_at?: string
          created_at?: string
          cycle_end: string
          cycle_start: string
          id?: string
          status: string
          user_id: string
        }
        Update: {
          amount_budgeted?: number
          amount_spent?: number
          budget_id?: string
          carry_over_amount?: number
          closed_at?: string
          created_at?: string
          cycle_end?: string
          cycle_start?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_cycle_history_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          active_days: string | null
          alert_threshold: number | null
          amount: number
          archived_at: string | null
          budget_type: string
          carried_amount: number
          carry_over: boolean
          category_id: string | null
          control_type: string
          created_at: string
          deleted_at: string | null
          expected_day: number | null
          id: string
          is_renewable: boolean
          linked_savings_goal_id: string | null
          name: string
          notes: string | null
          occurrence_frequency: string | null
          paused_at: string | null
          payment_account_id: string | null
          period: string
          priority: string
          reference_date: string | null
          tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          active_days?: string | null
          alert_threshold?: number | null
          amount: number
          archived_at?: string | null
          budget_type?: string
          carried_amount?: number
          carry_over?: boolean
          category_id?: string | null
          control_type?: string
          created_at?: string
          deleted_at?: string | null
          expected_day?: number | null
          id?: string
          is_renewable?: boolean
          linked_savings_goal_id?: string | null
          name: string
          notes?: string | null
          occurrence_frequency?: string | null
          paused_at?: string | null
          payment_account_id?: string | null
          period?: string
          priority?: string
          reference_date?: string | null
          tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          active_days?: string | null
          alert_threshold?: number | null
          amount?: number
          archived_at?: string | null
          budget_type?: string
          carried_amount?: number
          carry_over?: boolean
          category_id?: string | null
          control_type?: string
          created_at?: string
          deleted_at?: string | null
          expected_day?: number | null
          id?: string
          is_renewable?: boolean
          linked_savings_goal_id?: string | null
          name?: string
          notes?: string | null
          occurrence_frequency?: string | null
          paused_at?: string | null
          payment_account_id?: string | null
          period?: string
          priority?: string
          reference_date?: string | null
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_linked_savings_goal_id_fkey"
            columns: ["linked_savings_goal_id"]
            isOneToOne: false
            referencedRelation: "savings_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_payment_account_id_fkey"
            columns: ["payment_account_id"]
            isOneToOne: false
            referencedRelation: "payment_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_overview"
            referencedColumns: ["user_id"]
          },
        ]
      }
      cash_counts: {
        Row: {
          account_id: string | null
          counted_at: string | null
          denominations: Json
          discrepancy: number | null
          expected_balance: number | null
          id: string
          notes: string | null
          total_counted: number | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          counted_at?: string | null
          denominations?: Json
          discrepancy?: number | null
          expected_balance?: number | null
          id?: string
          notes?: string | null
          total_counted?: number | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          counted_at?: string | null
          denominations?: Json
          discrepancy?: number | null
          expected_balance?: number | null
          id?: string
          notes?: string | null
          total_counted?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_counts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "payment_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          archived_at: string | null
          color: string
          created_at: string
          deleted_at: string | null
          icon: string
          id: string
          is_family_root: boolean
          name: string
          parent_category_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          color?: string
          created_at?: string
          deleted_at?: string | null
          icon?: string
          id?: string
          is_family_root?: boolean
          name: string
          parent_category_id?: string | null
          type?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          color?: string
          created_at?: string
          deleted_at?: string | null
          icon?: string
          id?: string
          is_family_root?: boolean
          name?: string
          parent_category_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_category_id_fkey"
            columns: ["parent_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_overview"
            referencedColumns: ["user_id"]
          },
        ]
      }
      debts: {
        Row: {
          account_id: string | null
          created_at: string | null
          creditor_name: string
          deleted_at: string | null
          due_date: string | null
          id: string
          interest_rate: number
          interest_type: string
          notes: string | null
          paid_amount: number | null
          payment_schedule: Json
          total_amount: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          creditor_name: string
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          interest_rate?: number
          interest_type?: string
          notes?: string | null
          paid_amount?: number | null
          payment_schedule?: Json
          total_amount: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          creditor_name?: string
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          interest_rate?: number
          interest_type?: string
          notes?: string | null
          paid_amount?: number | null
          payment_schedule?: Json
          total_amount?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "payment_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      device_fingerprints: {
        Row: {
          fingerprint: string
          first_seen_at: string
          id: string
          ip_address: unknown
          last_seen_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          fingerprint: string
          first_seen_at?: string
          id?: string
          ip_address?: unknown
          last_seen_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          fingerprint?: string
          first_seen_at?: string
          id?: string
          ip_address?: unknown
          last_seen_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      family_categories: {
        Row: {
          color: string
          created_at: string
          created_by: string
          group_id: string
          icon: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by: string
          group_id: string
          icon?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string
          group_id?: string
          icon?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_categories_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      family_groups: {
        Row: {
          created_at: string
          currency: string
          id: string
          large_tx_threshold: number
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          large_tx_threshold?: number
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          large_tx_threshold?: number
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_groups_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "admin_user_overview"
            referencedColumns: ["user_id"]
          },
        ]
      }
      family_invitations: {
        Row: {
          created_at: string
          expires_at: string
          group_id: string
          id: string
          invited_by: string
          invited_email: string
          status: string
          token: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          group_id: string
          id?: string
          invited_by: string
          invited_email: string
          status?: string
          token?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          group_id?: string
          id?: string
          invited_by?: string
          invited_email?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_invitations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "admin_user_overview"
            referencedColumns: ["user_id"]
          },
        ]
      }
      family_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_overview"
            referencedColumns: ["user_id"]
          },
        ]
      }
      message_template_overrides: {
        Row: {
          body_en: string
          body_fr: string
          channel: string
          created_at: string
          html_en: string | null
          html_fr: string | null
          subject_en: string | null
          subject_fr: string | null
          template_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body_en: string
          body_fr: string
          channel?: string
          created_at?: string
          html_en?: string | null
          html_fr?: string | null
          subject_en?: string | null
          subject_fr?: string | null
          template_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body_en?: string
          body_fr?: string
          channel?: string
          created_at?: string
          html_en?: string | null
          html_fr?: string | null
          subject_en?: string | null
          subject_fr?: string | null
          template_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      notification_history: {
        Row: {
          body: string | null
          channel: string
          dedup_key: string | null
          id: string
          notification_type: string
          reference_id: string | null
          sent_at: string
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          channel?: string
          dedup_key?: string | null
          id?: string
          notification_type: string
          reference_id?: string | null
          sent_at?: string
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          channel?: string
          dedup_key?: string | null
          id?: string
          notification_type?: string
          reference_id?: string | null
          sent_at?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          balance_discrepancy: boolean
          budget_alerts: boolean
          budget_projections: boolean
          coach_channels: string[]
          created_at: string
          daily_budget: boolean
          deadline_lead_days: number[]
          debt_alerts: boolean
          evening_capture_enabled: boolean
          evening_capture_hour: number
          evening_digest_enabled: boolean
          evening_digest_hour: number
          factual_delivery_mode: string
          goal_reached: boolean
          id: string
          large_transaction: boolean
          large_transaction_threshold: number
          low_balance: boolean
          low_balance_threshold: number
          max_email_per_day: number
          max_push_per_day: number
          max_sms_per_day: number
          max_whatsapp_per_day: number
          morning_digest_enabled: boolean
          morning_digest_hour: number
          notify_payment_failure: boolean
          notify_payment_receipts: boolean
          notify_subscription_expiry: boolean
          notify_via_sms: boolean
          notify_via_whatsapp: boolean
          quiet_hours_enabled: boolean
          quiet_hours_end: number
          quiet_hours_mode: string
          quiet_hours_start: number
          recurring_reminders: boolean
          reminder_delivery_mode: string
          savings_deadline_alerts: boolean
          savings_reminders: boolean
          smart_grouping_enabled: boolean
          status_reminder_frequency: string
          updated_at: string
          user_id: string
          weekly_summary: boolean
        }
        Insert: {
          balance_discrepancy?: boolean
          budget_alerts?: boolean
          budget_projections?: boolean
          coach_channels?: string[]
          created_at?: string
          daily_budget?: boolean
          deadline_lead_days?: number[]
          debt_alerts?: boolean
          evening_capture_enabled?: boolean
          evening_capture_hour?: number
          evening_digest_enabled?: boolean
          evening_digest_hour?: number
          factual_delivery_mode?: string
          goal_reached?: boolean
          id?: string
          large_transaction?: boolean
          large_transaction_threshold?: number
          low_balance?: boolean
          low_balance_threshold?: number
          max_email_per_day?: number
          max_push_per_day?: number
          max_sms_per_day?: number
          max_whatsapp_per_day?: number
          morning_digest_enabled?: boolean
          morning_digest_hour?: number
          notify_payment_failure?: boolean
          notify_payment_receipts?: boolean
          notify_subscription_expiry?: boolean
          notify_via_sms?: boolean
          notify_via_whatsapp?: boolean
          quiet_hours_enabled?: boolean
          quiet_hours_end?: number
          quiet_hours_mode?: string
          quiet_hours_start?: number
          recurring_reminders?: boolean
          reminder_delivery_mode?: string
          savings_deadline_alerts?: boolean
          savings_reminders?: boolean
          smart_grouping_enabled?: boolean
          status_reminder_frequency?: string
          updated_at?: string
          user_id: string
          weekly_summary?: boolean
        }
        Update: {
          balance_discrepancy?: boolean
          budget_alerts?: boolean
          budget_projections?: boolean
          coach_channels?: string[]
          created_at?: string
          daily_budget?: boolean
          deadline_lead_days?: number[]
          debt_alerts?: boolean
          evening_capture_enabled?: boolean
          evening_capture_hour?: number
          evening_digest_enabled?: boolean
          evening_digest_hour?: number
          factual_delivery_mode?: string
          goal_reached?: boolean
          id?: string
          large_transaction?: boolean
          large_transaction_threshold?: number
          low_balance?: boolean
          low_balance_threshold?: number
          max_email_per_day?: number
          max_push_per_day?: number
          max_sms_per_day?: number
          max_whatsapp_per_day?: number
          morning_digest_enabled?: boolean
          morning_digest_hour?: number
          notify_payment_failure?: boolean
          notify_payment_receipts?: boolean
          notify_subscription_expiry?: boolean
          notify_via_sms?: boolean
          notify_via_whatsapp?: boolean
          quiet_hours_enabled?: boolean
          quiet_hours_end?: number
          quiet_hours_mode?: string
          quiet_hours_start?: number
          recurring_reminders?: boolean
          reminder_delivery_mode?: string
          savings_deadline_alerts?: boolean
          savings_reminders?: boolean
          smart_grouping_enabled?: boolean
          status_reminder_frequency?: string
          updated_at?: string
          user_id?: string
          weekly_summary?: boolean
        }
        Relationships: []
      }
      notification_queue: {
        Row: {
          attempts: number
          body: string | null
          channel: string
          created_at: string
          dedup_key: string | null
          id: string
          last_error: string | null
          notification_type: string
          payload: Json
          processed_at: string | null
          reference_id: string | null
          scheduled_for: string
          status: string
          title: string
          user_id: string
        }
        Insert: {
          attempts?: number
          body?: string | null
          channel: string
          created_at?: string
          dedup_key?: string | null
          id?: string
          last_error?: string | null
          notification_type: string
          payload?: Json
          processed_at?: string | null
          reference_id?: string | null
          scheduled_for: string
          status?: string
          title: string
          user_id: string
        }
        Update: {
          attempts?: number
          body?: string | null
          channel?: string
          created_at?: string
          dedup_key?: string | null
          id?: string
          last_error?: string | null
          notification_type?: string
          payload?: Json
          processed_at?: string | null
          reference_id?: string | null
          scheduled_for?: string
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_accounts: {
        Row: {
          archived_at: string | null
          created_at: string
          deleted_at: string | null
          icon: string
          id: string
          last_activity_at: string | null
          name: string
          opening_balance: number
          real_balance: number
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          deleted_at?: string | null
          icon?: string
          id?: string
          last_activity_at?: string | null
          name: string
          opening_balance?: number
          real_balance?: number
          status?: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          deleted_at?: string | null
          icon?: string
          id?: string
          last_activity_at?: string | null
          name?: string
          opening_balance?: number
          real_balance?: number
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_receipts: {
        Row: {
          amount: number
          created_at: string
          currency: string
          display_amount: number | null
          display_currency: string | null
          id: string
          payment_token: string | null
          plan_name: string
          refund_reason: string | null
          refunded_at: string | null
          refunded_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          display_amount?: number | null
          display_currency?: string | null
          id?: string
          payment_token?: string | null
          plan_name: string
          refund_reason?: string | null
          refunded_at?: string | null
          refunded_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          display_amount?: number | null
          display_currency?: string | null
          id?: string
          payment_token?: string | null
          plan_name?: string
          refund_reason?: string | null
          refunded_at?: string | null
          refunded_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_receipts_refunded_by_fkey"
            columns: ["refunded_by"]
            isOneToOne: false
            referencedRelation: "admin_user_overview"
            referencedColumns: ["user_id"]
          },
        ]
      }
      period_closures: {
        Row: {
          created_at: string
          id: string
          locked: boolean
          notes: string | null
          period_end: string
          period_start: string
          snapshot: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          locked?: boolean
          notes?: string | null
          period_end: string
          period_start: string
          snapshot?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          locked?: boolean
          notes?: string | null
          period_end?: string
          period_start?: string
          snapshot?: Json
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activation_completed_at: string | null
          activation_dismissed_at: string | null
          activation_reminders_sent: Json
          avatar_url: string | null
          categories_visited_at: string | null
          consent_updated_at: string | null
          country_code: string | null
          created_at: string
          currency: string
          display_name: string | null
          id: string
          locale: string
          marketing_consent: boolean
          onboarding_completed: boolean
          phone: string | null
          referral_code: string | null
          referred_by: string | null
          signup_country: string | null
          signup_ip: unknown
          sms_consent: boolean
          terms_accepted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activation_completed_at?: string | null
          activation_dismissed_at?: string | null
          activation_reminders_sent?: Json
          avatar_url?: string | null
          categories_visited_at?: string | null
          consent_updated_at?: string | null
          country_code?: string | null
          created_at?: string
          currency?: string
          display_name?: string | null
          id?: string
          locale?: string
          marketing_consent?: boolean
          onboarding_completed?: boolean
          phone?: string | null
          referral_code?: string | null
          referred_by?: string | null
          signup_country?: string | null
          signup_ip?: unknown
          sms_consent?: boolean
          terms_accepted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activation_completed_at?: string | null
          activation_dismissed_at?: string | null
          activation_reminders_sent?: Json
          avatar_url?: string | null
          categories_visited_at?: string | null
          consent_updated_at?: string | null
          country_code?: string | null
          created_at?: string
          currency?: string
          display_name?: string | null
          id?: string
          locale?: string
          marketing_consent?: boolean
          onboarding_completed?: boolean
          phone?: string | null
          referral_code?: string | null
          referred_by?: string | null
          signup_country?: string | null
          signup_ip?: unknown
          sms_consent?: boolean
          terms_accepted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "admin_user_overview"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "admin_user_overview"
            referencedColumns: ["user_id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_overview"
            referencedColumns: ["user_id"]
          },
        ]
      }
      recurring_transactions: {
        Row: {
          account_id: string | null
          active: boolean | null
          amount: number
          category_id: string | null
          created_at: string | null
          deleted_at: string | null
          description: string
          end_date: string | null
          frequency: string | null
          id: string
          next_date: string
          savings_goal_id: string | null
          skipped_dates: string[]
          type: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          active?: boolean | null
          amount: number
          category_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description: string
          end_date?: string | null
          frequency?: string | null
          id?: string
          next_date: string
          savings_goal_id?: string | null
          skipped_dates?: string[]
          type?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          active?: boolean | null
          amount?: number
          category_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string
          end_date?: string | null
          frequency?: string | null
          id?: string
          next_date?: string
          savings_goal_id?: string | null
          skipped_dates?: string[]
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "payment_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_savings_goal_id_fkey"
            columns: ["savings_goal_id"]
            isOneToOne: false
            referencedRelation: "savings_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_filters: {
        Row: {
          created_at: string
          filters: Json
          id: string
          name: string
          scope: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          name: string
          scope?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          name?: string
          scope?: string
          user_id?: string
        }
        Relationships: []
      }
      savings_goal_transactions: {
        Row: {
          amount: number
          created_at: string
          goal_id: string
          id: string
          kind: string
          note: string | null
          source_account_id: string | null
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          goal_id: string
          id?: string
          kind: string
          note?: string | null
          source_account_id?: string | null
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          goal_id?: string
          id?: string
          kind?: string
          note?: string | null
          source_account_id?: string | null
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_goal_transactions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "savings_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_goal_transactions_source_account_id_fkey"
            columns: ["source_account_id"]
            isOneToOne: false
            referencedRelation: "payment_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_goal_transactions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_goals: {
        Row: {
          account_id: string | null
          bank_name: string | null
          contribution_day: number | null
          contribution_frequency: string
          created_at: string
          current_amount: number
          deadline: string | null
          deleted_at: string | null
          icon: string
          id: string
          interest_frequency: string | null
          interest_rate: number | null
          is_locked: boolean
          is_renewable: boolean
          last_capitalized_at: string | null
          last_renewed_at: string | null
          linked_budget_id: string | null
          monthly_contribution: number | null
          name: string
          notes: string | null
          opening_balance: number
          paused_at: string | null
          priority: number
          purpose: string
          renewal_count: number
          renewal_frequency: string
          start_date: string | null
          status: string
          target_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          bank_name?: string | null
          contribution_day?: number | null
          contribution_frequency?: string
          created_at?: string
          current_amount?: number
          deadline?: string | null
          deleted_at?: string | null
          icon?: string
          id?: string
          interest_frequency?: string | null
          interest_rate?: number | null
          is_locked?: boolean
          is_renewable?: boolean
          last_capitalized_at?: string | null
          last_renewed_at?: string | null
          linked_budget_id?: string | null
          monthly_contribution?: number | null
          name: string
          notes?: string | null
          opening_balance?: number
          paused_at?: string | null
          priority?: number
          purpose?: string
          renewal_count?: number
          renewal_frequency?: string
          start_date?: string | null
          status?: string
          target_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          bank_name?: string | null
          contribution_day?: number | null
          contribution_frequency?: string
          created_at?: string
          current_amount?: number
          deadline?: string | null
          deleted_at?: string | null
          icon?: string
          id?: string
          interest_frequency?: string | null
          interest_rate?: number | null
          is_locked?: boolean
          is_renewable?: boolean
          last_capitalized_at?: string | null
          last_renewed_at?: string | null
          linked_budget_id?: string | null
          monthly_contribution?: number | null
          name?: string
          notes?: string | null
          opening_balance?: number
          paused_at?: string | null
          priority?: number
          purpose?: string
          renewal_count?: number
          renewal_frequency?: string
          start_date?: string | null
          status?: string
          target_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_goals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "payment_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_goals_linked_budget_id_fkey"
            columns: ["linked_budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_overview"
            referencedColumns: ["user_id"]
          },
        ]
      }
      security_check_ratelimit: {
        Row: {
          count: number
          ip: string
          updated_at: string
          window_start: string
        }
        Insert: {
          count?: number
          ip: string
          updated_at?: string
          window_start?: string
        }
        Update: {
          count?: number
          ip?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      security_signals: {
        Row: {
          created_at: string
          declared_country: string | null
          detected_country: string | null
          event_type: string
          id: string
          ip_address: unknown
          is_hosting: boolean
          is_proxy: boolean
          is_tor: boolean
          is_vpn: boolean
          metadata: Json
          risk_score: number
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          declared_country?: string | null
          detected_country?: string | null
          event_type: string
          id?: string
          ip_address?: unknown
          is_hosting?: boolean
          is_proxy?: boolean
          is_tor?: boolean
          is_vpn?: boolean
          metadata?: Json
          risk_score?: number
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          declared_country?: string | null
          detected_country?: string | null
          event_type?: string
          id?: string
          ip_address?: unknown
          is_hosting?: boolean
          is_proxy?: boolean
          is_tor?: boolean
          is_vpn?: boolean
          metadata?: Json
          risk_score?: number
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      shared_budgets: {
        Row: {
          budget_id: string
          created_at: string
          group_id: string
          id: string
          shared_by: string
        }
        Insert: {
          budget_id: string
          created_at?: string
          group_id: string
          id?: string
          shared_by: string
        }
        Update: {
          budget_id?: string
          created_at?: string
          group_id?: string
          id?: string
          shared_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_budgets_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_budgets_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_budgets_shared_by_fkey"
            columns: ["shared_by"]
            isOneToOne: false
            referencedRelation: "admin_user_overview"
            referencedColumns: ["user_id"]
          },
        ]
      }
      sms_send_logs: {
        Row: {
          body: string
          channel: string
          created_at: string
          error_code: string | null
          error_message: string | null
          id: string
          last_status_at: string | null
          recipient: string
          sent_by: string | null
          status: string
          status_delivered_at: string | null
          status_failed_at: string | null
          status_queued_at: string | null
          status_sent_at: string | null
          status_undelivered_at: string | null
          template_id: string | null
          twilio_sid: string | null
        }
        Insert: {
          body: string
          channel?: string
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          last_status_at?: string | null
          recipient: string
          sent_by?: string | null
          status?: string
          status_delivered_at?: string | null
          status_failed_at?: string | null
          status_queued_at?: string | null
          status_sent_at?: string | null
          status_undelivered_at?: string | null
          template_id?: string | null
          twilio_sid?: string | null
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          last_status_at?: string | null
          recipient?: string
          sent_by?: string | null
          status?: string
          status_delivered_at?: string | null
          status_failed_at?: string | null
          status_queued_at?: string | null
          status_sent_at?: string | null
          status_undelivered_at?: string | null
          template_id?: string | null
          twilio_sid?: string | null
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          active: boolean
          base_price: number
          created_at: string
          currency_prices: Json
          features: Json
          id: string
          name: string
          trial_days: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          base_price?: number
          created_at?: string
          currency_prices?: Json
          features?: Json
          id?: string
          name: string
          trial_days?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          base_price?: number
          created_at?: string
          currency_prices?: Json
          features?: Json
          id?: string
          name?: string
          trial_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_cycle: string | null
          canceled_at: string | null
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          last_payment_token: string | null
          payment_method: string | null
          plan_id: string | null
          refund_reason: string | null
          refunded_at: string | null
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_cycle?: string | null
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          last_payment_token?: string | null
          payment_method?: string | null
          plan_id?: string | null
          refund_reason?: string | null
          refunded_at?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_cycle?: string | null
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          last_payment_token?: string | null
          payment_method?: string | null
          plan_id?: string | null
          refund_reason?: string | null
          refunded_at?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_templates: {
        Row: {
          account_id: string | null
          amount: number | null
          category_id: string | null
          created_at: string
          description: string
          id: string
          name: string
          type: string
          updated_at: string
          use_count: number
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount?: number | null
          category_id?: string | null
          created_at?: string
          description: string
          id?: string
          name: string
          type?: string
          updated_at?: string
          use_count?: number
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number | null
          category_id?: string | null
          created_at?: string
          description?: string
          id?: string
          name?: string
          type?: string
          updated_at?: string
          use_count?: number
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          category_id: string | null
          created_at: string
          date: string
          deleted_at: string | null
          description: string
          family_category_id: string | null
          id: string
          is_transfer: boolean
          linked_transfer_id: string | null
          notes: string | null
          parent_transaction_id: string | null
          receipt_url: string | null
          tags: string[]
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category_id?: string | null
          created_at?: string
          date?: string
          deleted_at?: string | null
          description: string
          family_category_id?: string | null
          id?: string
          is_transfer?: boolean
          linked_transfer_id?: string | null
          notes?: string | null
          parent_transaction_id?: string | null
          receipt_url?: string | null
          tags?: string[]
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category_id?: string | null
          created_at?: string
          date?: string
          deleted_at?: string | null
          description?: string
          family_category_id?: string | null
          id?: string
          is_transfer?: boolean
          linked_transfer_id?: string | null
          notes?: string | null
          parent_transaction_id?: string | null
          receipt_url?: string | null
          tags?: string[]
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "payment_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_family_category_id_fkey"
            columns: ["family_category_id"]
            isOneToOne: false
            referencedRelation: "family_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_linked_transfer_id_fkey"
            columns: ["linked_transfer_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_parent_transaction_id_fkey"
            columns: ["parent_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_overview"
            referencedColumns: ["user_id"]
          },
        ]
      }
      usage_counters: {
        Row: {
          count: number
          created_at: string
          day: string
          feature: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          count?: number
          created_at?: string
          day?: string
          feature: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          count?: number
          created_at?: string
          day?: string
          feature?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_overview"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      admin_notification_metrics: {
        Row: {
          auto_resolved_count: number | null
          cancelled_alerts_total: number | null
          channel: string | null
          day: string | null
          queued_cancelled: number | null
          queued_failed: number | null
          queued_pending: number | null
          queued_sent: number | null
          sent_count: number | null
        }
        Relationships: []
      }
      admin_user_overview: {
        Row: {
          account_count: number | null
          avatar_url: string | null
          banned_until: string | null
          currency: string | null
          display_name: string | null
          effective_plan: string | null
          email: string | null
          email_confirmed_at: string | null
          is_admin: boolean | null
          last_sign_in_at: string | null
          locale: string | null
          plan_expires_at: string | null
          signup_at: string | null
          subscription_status: string | null
          tx_count: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_family_invitation: { Args: { p_token: string }; Returns: Json }
      activate_paid_subscription:
        | {
            Args: {
              p_period_days?: number
              p_reference: string
              p_user_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_billing_cycle?: string
              p_period_days?: number
              p_reference: string
              p_user_id: string
            }
            Returns: string
          }
      admin_billing_kpis: { Args: never; Returns: Json }
      admin_get_user_snapshot: {
        Args: { _actor_id: string; _target_user_id: string }
        Returns: Json
      }
      admin_list_payment_receipts: {
        Args: {
          p_end_date?: string
          p_limit?: number
          p_payment_method?: string
          p_plan?: string
          p_start_date?: string
          p_status?: string
        }
        Returns: {
          amount: number
          billing_cycle: string
          created_at: string
          currency: string
          display_amount: number
          display_currency: string
          display_name: string
          id: string
          payment_method: string
          payment_token: string
          plan_name: string
          refund_reason: string
          refunded_at: string
          status: string
          user_email: string
          user_id: string
        }[]
      }
      admin_list_users: {
        Args: {
          _actor_id: string
          _limit?: number
          _offset?: number
          _plan_filter?: string
          _search?: string
        }
        Returns: {
          account_count: number | null
          avatar_url: string | null
          banned_until: string | null
          currency: string | null
          display_name: string | null
          effective_plan: string | null
          email: string | null
          email_confirmed_at: string | null
          is_admin: boolean | null
          last_sign_in_at: string | null
          locale: string | null
          plan_expires_at: string | null
          signup_at: string | null
          subscription_status: string | null
          tx_count: number | null
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "admin_user_overview"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_log_action: {
        Args: {
          _action: string
          _metadata?: Json
          _reason?: string
          _target_user_id: string
        }
        Returns: string
      }
      admin_refund_subscription: {
        Args: { p_reason?: string; p_subscription_id: string }
        Returns: Json
      }
      admin_set_user_plan: {
        Args: {
          _actor_id: string
          _duration_days?: number
          _plan_name: string
          _target_user_id: string
        }
        Returns: Json
      }
      admin_suspicious_ips: {
        Args: { _actor_id: string }
        Returns: {
          account_count: number
          emails: string[]
          first_seen: string
          ip_address: unknown
          last_seen: string
          user_ids: string[]
        }[]
      }
      admin_switch_my_plan: {
        Args: { p_plan_name: string }
        Returns: undefined
      }
      bulk_reparent_categories: {
        Args: {
          p_category_ids: string[]
          p_new_parent_id: string
          p_user_id: string
        }
        Returns: Json
      }
      cancel_my_pending_receipt: {
        Args: { p_receipt_id: string }
        Returns: undefined
      }
      cancel_my_subscription: {
        Args: { p_subscription_id: string }
        Returns: undefined
      }
      cancel_transfer: {
        Args: { p_transaction_id: string; p_user_id: string }
        Returns: Json
      }
      capitalize_savings_interest: { Args: never; Returns: Json }
      check_and_increment_usage: {
        Args: { _feature: string; _limit: number; _user_id: string }
        Returns: Json
      }
      check_security_ratelimit: {
        Args: { _ip: string; _max?: number; _window_minutes?: number }
        Returns: {
          allowed: boolean
          current_count: number
          retry_after_seconds: number
        }[]
      }
      cleanup_expired_ai_cache: { Args: never; Returns: undefined }
      cleanup_old_deleted: { Args: never; Returns: Json }
      cleanup_old_notifications: { Args: never; Returns: number }
      cleanup_stale_pending_payments: { Args: never; Returns: undefined }
      compute_health_score: { Args: { p_user_id: string }; Returns: Json }
      delete_family_group_cascade: {
        Args: { p_group_id: string }
        Returns: Json
      }
      ensure_user_family_root: { Args: { p_user_id: string }; Returns: string }
      generate_referral_code: { Args: never; Returns: string }
      get_account_drilldown: {
        Args: { p_account_id: string; p_user_id: string }
        Returns: Json
      }
      get_account_theoretical_balances: {
        Args: { p_user_id: string }
        Returns: {
          account_id: string
          theoretical_balance: number
        }[]
      }
      get_budget_spending: {
        Args: {
          p_category_id: string
          p_end_date: string
          p_start_date: string
          p_type: string
          p_user_id: string
        }
        Returns: number
      }
      get_budgets_spending: {
        Args: { p_end_date: string; p_start_date: string; p_user_id: string }
        Returns: {
          category_id: string
          total: number
          type: string
        }[]
      }
      get_category_analytics: {
        Args: { p_user_id: string }
        Returns: {
          category_id: string
          last_used: string
          monthly_series: Json
          total_amount: number
          transaction_count: number
        }[]
      }
      get_demo_user_id: { Args: never; Returns: string }
      get_dormant_accounts: {
        Args: { p_days?: number; p_user_id: string }
        Returns: {
          days_inactive: number
          icon: string
          id: string
          name: string
          real_balance: number
        }[]
      }
      get_family_dashboard: {
        Args: { p_end_date: string; p_group_id: string; p_start_date: string }
        Returns: Json
      }
      get_family_member_profiles: {
        Args: { p_group_id: string }
        Returns: {
          avatar_url: string
          display_name: string
          user_id: string
        }[]
      }
      get_family_transactions: {
        Args: { p_group_id: string; p_limit?: number }
        Returns: {
          amount: number
          category_icon: string
          category_name: string
          date: string
          description: string
          display_name: string
          id: string
          type: string
          user_id: string
        }[]
      }
      get_notification_metrics: {
        Args: { days_back?: number }
        Returns: {
          auto_resolved_count: number
          cancelled_alerts_total: number
          channel: string
          day: string
          queued_cancelled: number
          queued_failed: number
          queued_pending: number
          queued_sent: number
          sent_count: number
        }[]
      }
      get_savings_contribution: {
        Args: {
          p_end_date: string
          p_goal_id: string
          p_start_date: string
          p_user_id: string
        }
        Returns: number
      }
      has_active_subscription: {
        Args: { _user_id: string }
        Returns: {
          current_period_end: string
          plan_id: string
          plan_name: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_demo_user: { Args: { _user_id: string }; Returns: boolean }
      is_family_admin: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_family_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_family_owner: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_subscription_valid: { Args: { _user_id: string }; Returns: string }
      leave_family_group: { Args: { p_group_id: string }; Returns: Json }
      log_audit_event: {
        Args: {
          _actor_id: string
          _event_subtype: string
          _event_type: string
          _ip: string
          _metadata: Json
          _reason: string
          _resource_id?: string
          _status: string
          _user_agent: string
          _user_id: string
        }
        Returns: string
      }
      merge_categories: {
        Args: { p_source_ids: string[]; p_target_id: string; p_user_id: string }
        Returns: Json
      }
      perform_transfer: {
        Args: {
          p_amount: number
          p_date?: string
          p_description: string
          p_expense_category_id?: string
          p_from_account_id: string
          p_to_account_id: string
          p_user_id: string
        }
        Returns: Json
      }
      process_paystack_refund: {
        Args: { p_payment_token: string; p_reason?: string }
        Returns: Json
      }
      recalculate_account_balance: {
        Args: { p_account_id: string }
        Returns: undefined
      }
      renew_savings_goals: { Args: never; Returns: Json }
      reset_demo_account: { Args: never; Returns: undefined }
      resolve_pending_alerts: {
        Args: {
          p_alert_types: string[]
          p_reason?: string
          p_reference_id: string
          p_user_id: string
        }
        Returns: number
      }
      rollover_once_budgets: { Args: { p_user_id?: string }; Returns: Json }
      seed_default_family_group_categories: {
        Args: { p_creator: string; p_group_id: string }
        Returns: undefined
      }
      should_send_notification: {
        Args: {
          p_channel: string
          p_dedup_key: string
          p_dedup_window_days?: number
          p_user_id: string
        }
        Returns: Json
      }
      transfer_family_ownership: {
        Args: { p_group_id: string; p_new_owner_id: string }
        Returns: Json
      }
      update_transfer: {
        Args: {
          p_amount: number
          p_date: string
          p_description: string
          p_from_account_id: string
          p_to_account_id: string
          p_transaction_id: string
          p_user_id: string
        }
        Returns: Json
      }
      withdraw_from_goal: {
        Args: {
          p_amount: number
          p_destination_account_id: string
          p_goal_id: string
          p_note?: string
        }
        Returns: Json
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
