// Generado desde la base de Supabase (proyecto yhiampnffbxbwwhhpmzl).
// Si cambia el esquema, hay que volver a generarlo.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      comercios: {
        Row: {
          abre_feriados: boolean
          aprobado: boolean
          creado_en: string
          direccion: string
          dueno_id: string
          id: number
          lat: number | null
          lng: number | null
          nombre: string
          rubro: string
          whatsapp: string | null
          zona_id: string
        }
        Insert: {
          abre_feriados?: boolean
          aprobado?: boolean
          creado_en?: string
          direccion: string
          dueno_id?: string
          id?: never
          lat?: number | null
          lng?: number | null
          nombre: string
          rubro: string
          whatsapp?: string | null
          zona_id: string
        }
        Update: {
          abre_feriados?: boolean
          aprobado?: boolean
          creado_en?: string
          direccion?: string
          dueno_id?: string
          id?: never
          lat?: number | null
          lng?: number | null
          nombre?: string
          rubro?: string
          whatsapp?: string | null
          zona_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comercios_dueno_id_fkey"
            columns: ["dueno_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comercios_zona_id_fkey"
            columns: ["zona_id"]
            isOneToOne: false
            referencedRelation: "zonas"
            referencedColumns: ["id"]
          },
        ]
      }
      cierres: {
        Row: { comercio_id: number; desde: string; hasta: string; id: number; motivo: string | null }
        Insert: { comercio_id: number; desde: string; hasta: string; id?: never; motivo?: string | null }
        Update: { comercio_id?: number; desde?: string; hasta?: string; id?: never; motivo?: string | null }
        Relationships: []
      }
      feriados: {
        Row: { fecha: string; nombre: string; tipo: string }
        Insert: { fecha: string; nombre: string; tipo: string }
        Update: { fecha?: string; nombre?: string; tipo?: string }
        Relationships: []
      }
      horarios: {
        Row: {
          abre: string
          cierra: string
          comercio_id: number
          dia: number
        }
        Insert: {
          abre: string
          cierra: string
          comercio_id: number
          dia: number
        }
        Update: {
          abre?: string
          cierra?: string
          comercio_id?: number
          dia?: number
        }
        Relationships: [
          {
            foreignKeyName: "horarios_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
        ]
      }
      perfiles: {
        Row: {
          creado_en: string
          id: string
          nombre: string
          rol: Database["public"]["Enums"]["rol_usuario"]
          telefono: string | null
        }
        Insert: {
          creado_en?: string
          id: string
          nombre?: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
          telefono?: string | null
        }
        Update: {
          creado_en?: string
          id?: string
          nombre?: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
          telefono?: string | null
        }
        Relationships: []
      }
      productos: {
        Row: {
          activo: boolean
          actualizado_en: string
          codigo: string | null
          comercio_id: number
          descripcion: string | null
          foto_url: string | null
          grupo: string | null
          id: number
          marca: string | null
          modo: Database["public"]["Enums"]["modo_stock"]
          nombre: string
          precio: number | null
          semaforo: Database["public"]["Enums"]["semaforo"] | null
          stock: number | null
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          codigo?: string | null
          comercio_id: number
          descripcion?: string | null
          foto_url?: string | null
          grupo?: string | null
          id?: never
          marca?: string | null
          modo?: Database["public"]["Enums"]["modo_stock"]
          nombre: string
          precio?: number | null
          semaforo?: Database["public"]["Enums"]["semaforo"] | null
          stock?: number | null
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          codigo?: string | null
          comercio_id?: number
          descripcion?: string | null
          foto_url?: string | null
          grupo?: string | null
          id?: never
          marca?: string | null
          modo?: Database["public"]["Enums"]["modo_stock"]
          nombre?: string
          precio?: number | null
          semaforo?: Database["public"]["Enums"]["semaforo"] | null
          stock?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "productos_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
        ]
      }
      resenas: {
        Row: {
          autor_id: string
          autor_nombre: string
          comercio_id: number
          creada_en: string
          estrellas: number
          id: number
          reserva_id: number
          texto: string | null
        }
        Insert: {
          autor_id?: string
          autor_nombre: string
          comercio_id: number
          creada_en?: string
          estrellas: number
          id?: never
          reserva_id: number
          texto?: string | null
        }
        Update: {
          autor_id?: string
          autor_nombre?: string
          comercio_id?: number
          creada_en?: string
          estrellas?: number
          id?: never
          reserva_id?: number
          texto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resenas_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resenas_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resenas_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: true
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
        ]
      }
      reserva_alternativas: {
        Row: {
          producto_id: number
          reserva_id: number
        }
        Insert: {
          producto_id: number
          reserva_id: number
        }
        Update: {
          producto_id?: number
          reserva_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "reserva_alternativas_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserva_alternativas_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
        ]
      }
      reservas: {
        Row: {
          actualizada_en: string
          cantidad: number
          comercio_id: number
          comprador_id: string
          creada_en: string
          estado: Database["public"]["Enums"]["estado_reserva"]
          id: number
          medio_pago: Database["public"]["Enums"]["medio_pago"]
          precio_unitario: number | null
          producto_id: number | null
          producto_nombre: string
          producto_original_id: number | null
          retiro: string
        }
        Insert: {
          actualizada_en?: string
          cantidad: number
          comercio_id: number
          comprador_id?: string
          creada_en?: string
          estado?: Database["public"]["Enums"]["estado_reserva"]
          id?: never
          medio_pago?: Database["public"]["Enums"]["medio_pago"]
          precio_unitario?: number | null
          producto_id?: number | null
          producto_nombre: string
          producto_original_id?: number | null
          retiro: string
        }
        Update: {
          actualizada_en?: string
          cantidad?: number
          comercio_id?: number
          comprador_id?: string
          creada_en?: string
          estado?: Database["public"]["Enums"]["estado_reserva"]
          id?: never
          medio_pago?: Database["public"]["Enums"]["medio_pago"]
          precio_unitario?: number | null
          producto_id?: number | null
          producto_nombre?: string
          producto_original_id?: number | null
          retiro?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservas_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservas_comprador_id_fkey"
            columns: ["comprador_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservas_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservas_producto_original_id_fkey"
            columns: ["producto_original_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      vistas: {
        Row: {
          comercio_id: number
          creada_en: string
          id: number
          producto_id: number | null
        }
        Insert: {
          comercio_id: number
          creada_en?: string
          id?: never
          producto_id?: number | null
        }
        Update: {
          comercio_id?: number
          creada_en?: string
          id?: never
          producto_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vistas_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vistas_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      zonas: {
        Row: {
          activa: boolean
          id: string
          nombre: string
        }
        Insert: {
          activa?: boolean
          id: string
          nombre: string
        }
        Update: {
          activa?: boolean
          id?: string
          nombre?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      dias_cerrados: {
        Args: { p_comercio: number; p_desde: string; p_hasta: string }
        Returns: { fecha: string; motivo: string }[]
      }
      aceptar_reserva: { Args: { p_reserva: number }; Returns: undefined }
      cancelar_reserva: { Args: { p_reserva: number }; Returns: undefined }
      comercios_cercanos: {
        Args: {
          p_busqueda?: string
          p_lat: number
          p_lng: number
          p_radio_km?: number
        }
        Returns: {
          direccion: string
          distancia_km: number
          id: number
          lat: number
          lng: number
          nombre: string
          rubro: string
          whatsapp: string
          zona_id: string
        }[]
      }
      descontar_stock: {
        Args: { p_cantidad: number; p_producto: number }
        Returns: undefined
      }
      devolver_stock: {
        Args: { p_cantidad: number; p_producto: number }
        Returns: undefined
      }
      elegir_alternativa: {
        Args: { p_producto: number; p_reserva: number }
        Returns: undefined
      }
      es_cliente_mio: { Args: { p_perfil: string }; Returns: boolean }
      es_comerciante: { Args: never; Returns: boolean }
      es_dueno: { Args: { p_comercio: number }; Returns: boolean }
      es_dueno_carpeta: { Args: { p_carpeta: string }; Returns: boolean }
      estadisticas_comercio: {
        Args: { p_comercio: number; p_desde?: string }
        Returns: {
          promedio_estrellas: number
          total_resenas: number
          total_reservas: number
          total_retiradas: number
          total_vistas: number
        }[]
      }
      marcar_retirada: { Args: { p_reserva: number }; Returns: undefined }
      ofrecer_alternativas: {
        Args: { p_productos: number[]; p_reserva: number }
        Returns: undefined
      }
      rechazar_reserva: { Args: { p_reserva: number }; Returns: undefined }
      vencer_reservas: { Args: { p_horas?: number }; Returns: number }
    }
    Enums: {
      estado_reserva:
        | "pendiente"
        | "alternativa"
        | "aceptada"
        | "retirada"
        | "rechazada"
        | "cancelada"
        | "vencida"
      medio_pago: "local" | "online"
      modo_stock: "exacto" | "semaforo" | "consultar" | "pedido"
      rol_usuario: "comprador" | "comerciante"
      semaforo: "hay" | "poco" | "no"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type Publico = Database["public"]

export type Tabla<T extends keyof Publico["Tables"]> = Publico["Tables"][T]["Row"]
export type TablesInsert<T extends keyof Publico["Tables"]> = Publico["Tables"][T]["Insert"]
export type Enum<T extends keyof Publico["Enums"]> = Publico["Enums"][T]
export type ComercioCercano = Publico["Functions"]["comercios_cercanos"]["Returns"][number]
