// Tipos TypeScript do schema Supabase.
// Substituível por `supabase gen types typescript --linked > src/types/database.ts`.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'contractor' | 'musician' | 'both';
export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'evp';
export type OrderStatus =
  | 'OPEN'
  | 'ACCEPTED'
  | 'PAID'
  | 'DELIVERED'
  | 'IN_REVISION'
  | 'COMPLETED'
  | 'DISPUTED';

export type AudioMimeType =
  | 'audio/wav'
  | 'audio/x-wav'
  | 'audio/mpeg'
  | 'audio/aiff'
  | 'audio/x-aiff';

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: UserRole;
          bio: string | null;
          avatar_url: string | null;
          pix_key: string | null;
          pix_key_type: PixKeyType | null;
          asaas_customer_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: UserRole;
          bio?: string | null;
          avatar_url?: string | null;
          pix_key?: string | null;
          pix_key_type?: PixKeyType | null;
          asaas_customer_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
        Relationships: [];
      };

      orders: {
        Row: {
          id: string;
          contractor_id: string;
          musician_id: string | null;
          title: string;
          instrument: string;
          style: string;
          briefing: string;
          usage_rights: string;
          deadline: string;
          budget_cents: number;
          status: OrderStatus;
          asaas_payment_id: string | null;
          asaas_split_id: string | null;
          revision_count: number;
          accepted_at: string | null;
          paid_at: string | null;
          delivered_at: string | null;
          auto_approve_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          contractor_id: string;
          musician_id?: string | null;
          title: string;
          instrument: string;
          style: string;
          briefing: string;
          usage_rights: string;
          deadline: string;
          budget_cents: number;
          status?: OrderStatus;
          asaas_payment_id?: string | null;
          asaas_split_id?: string | null;
          revision_count?: number;
          accepted_at?: string | null;
          paid_at?: string | null;
          delivered_at?: string | null;
          auto_approve_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['orders']['Insert']>;
        Relationships: [
          { foreignKeyName: 'orders_contractor_id_fkey'; columns: ['contractor_id']; referencedRelation: 'users'; referencedColumns: ['id'] },
          { foreignKeyName: 'orders_musician_id_fkey';   columns: ['musician_id'];   referencedRelation: 'users'; referencedColumns: ['id'] },
        ];
      };

      deliveries: {
        Row: {
          id: string;
          order_id: string;
          musician_id: string;
          file_key: string;
          file_name: string;
          file_size_bytes: number;
          mime_type: AudioMimeType;
          duration_seconds: number | null;
          notes: string | null;
          delivered_at: string;
          is_current: boolean;
        };
        Insert: {
          id?: string;
          order_id: string;
          musician_id: string;
          file_key: string;
          file_name: string;
          file_size_bytes: number;
          mime_type: AudioMimeType;
          duration_seconds?: number | null;
          notes?: string | null;
          delivered_at?: string;
          is_current?: boolean;
        };
        Update: Partial<Database['public']['Tables']['deliveries']['Insert']>;
        Relationships: [
          { foreignKeyName: 'deliveries_order_id_fkey';    columns: ['order_id'];    referencedRelation: 'orders'; referencedColumns: ['id'] },
          { foreignKeyName: 'deliveries_musician_id_fkey'; columns: ['musician_id']; referencedRelation: 'users';  referencedColumns: ['id'] },
        ];
      };

      revisions: {
        Row: {
          id: string;
          order_id: string;
          delivery_id: string;
          contractor_id: string;
          feedback: string;
          requested_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          delivery_id: string;
          contractor_id: string;
          feedback: string;
          requested_at?: string;
        };
        Update: Partial<Database['public']['Tables']['revisions']['Insert']>;
        Relationships: [
          { foreignKeyName: 'revisions_order_id_fkey';      columns: ['order_id'];      referencedRelation: 'orders';     referencedColumns: ['id'] },
          { foreignKeyName: 'revisions_delivery_id_fkey';   columns: ['delivery_id'];   referencedRelation: 'deliveries'; referencedColumns: ['id'] },
          { foreignKeyName: 'revisions_contractor_id_fkey'; columns: ['contractor_id']; referencedRelation: 'users';      referencedColumns: ['id'] },
        ];
      };

      reviews: {
        Row: {
          id: string;
          order_id: string;
          reviewer_id: string;
          reviewee_id: string;
          rating: number;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          reviewer_id: string;
          reviewee_id: string;
          rating: number;
          comment?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['reviews']['Insert']>;
        Relationships: [
          { foreignKeyName: 'reviews_order_id_fkey';    columns: ['order_id'];    referencedRelation: 'orders'; referencedColumns: ['id'] },
          { foreignKeyName: 'reviews_reviewer_id_fkey'; columns: ['reviewer_id']; referencedRelation: 'users';  referencedColumns: ['id'] },
          { foreignKeyName: 'reviews_reviewee_id_fkey'; columns: ['reviewee_id']; referencedRelation: 'users';  referencedColumns: ['id'] },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      auto_approve_expired_deliveries: {
        Args: Record<string, never>;
        Returns: { order_id: string }[];
      };
    };
    Enums: {
      user_role: UserRole;
      pix_key_type: PixKeyType;
      order_status: OrderStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}

// Aliases convenientes para uso no app
export type UserRow      = Database['public']['Tables']['users']['Row'];
export type OrderRow     = Database['public']['Tables']['orders']['Row'];
export type DeliveryRow  = Database['public']['Tables']['deliveries']['Row'];
export type RevisionRow  = Database['public']['Tables']['revisions']['Row'];
export type ReviewRow    = Database['public']['Tables']['reviews']['Row'];

export type OrderInsert    = Database['public']['Tables']['orders']['Insert'];
export type DeliveryInsert = Database['public']['Tables']['deliveries']['Insert'];
