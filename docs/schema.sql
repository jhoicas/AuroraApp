-- Supabase Schema para Plataforma SaaS de Inversión Pública (Aurora Blueprint)

-- Habilitar extensión para UUIDs si no está habilitada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. TENANTS (Empresas/Instituciones)
-- ============================================================================
CREATE TABLE public.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. USERS (Sincronizado con auth.users si se usa Supabase Auth)
-- ============================================================================
CREATE TYPE user_role AS ENUM (
    'super_admin', 
    'tenant_admin', 
    'formulador', 
    'evaluador', 
    'analista', 
    'viewer'
);

CREATE TABLE public.users (
    id UUID PRIMARY KEY, -- Referencia a auth.users.id
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    role user_role NOT NULL DEFAULT 'viewer',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. CATÁLOGO DE INVERSIÓN PÚBLICA
-- ============================================================================
-- Nota: Si tenant_id es NULL, es un catálogo global. Si tiene tenant_id, es específico.

CREATE TABLE public.sectores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    codigo VARCHAR(50) NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.sectores ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.programas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sector_id UUID REFERENCES public.sectores(id) ON DELETE CASCADE,
    codigo VARCHAR(50) NOT NULL,
    nombre TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.programas ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.subprogramas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    programa_id UUID REFERENCES public.programas(id) ON DELETE CASCADE,
    codigo VARCHAR(50) NOT NULL,
    nombre TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.subprogramas ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.productos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subprograma_id UUID REFERENCES public.subprogramas(id) ON DELETE CASCADE,
    codigo VARCHAR(50) NOT NULL,
    nombre TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;

-- Otras tablas del catálogo
CREATE TABLE public.ods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(50) NOT NULL,
    nombre TEXT NOT NULL,
    descripcion TEXT
);

CREATE TABLE public.edt (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    producto_id UUID REFERENCES public.productos(id) ON DELETE CASCADE,
    codigo VARCHAR(50) NOT NULL,
    nombre TEXT NOT NULL
);

-- ============================================================================
-- 4. PROYECTOS Y FORMULACIÓN
-- ============================================================================
CREATE TABLE public.proyectos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    creador_id UUID REFERENCES public.users(id) NOT NULL,
    codigo_bpin VARCHAR(50) UNIQUE,
    nombre TEXT NOT NULL,
    estado VARCHAR(50) DEFAULT 'EN_FORMULACION',
    sector_id UUID REFERENCES public.sectores(id),
    producto_principal_id UUID REFERENCES public.productos(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.proyectos ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. POLÍTICAS RLS (ROW LEVEL SECURITY) - CORREGIDAS
-- ============================================================================

-- Función auxiliar para obtener el tenant_id del usuario actual (Guardado en PUBLIC)
CREATE OR REPLACE FUNCTION public.tenant_id() RETURNS UUID AS $$
  SELECT (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::UUID;
$$ LANGUAGE SQL STABLE;

-- Función auxiliar para obtener el rol del usuario (Guardado en PUBLIC)
CREATE OR REPLACE FUNCTION public.user_role() RETURNS TEXT AS $$
  SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'role';
$$ LANGUAGE SQL STABLE;

-- Tenants: Superadmin ve todo, el resto solo ve su tenant
CREATE POLICY "Superadmin full access tenants" ON public.tenants FOR ALL USING (public.user_role() = 'super_admin');
CREATE POLICY "Users view own tenant" ON public.tenants FOR SELECT USING (id = public.tenant_id());

-- Users: Superadmin ve todo, tenant_admin ve/edita usuarios de su tenant
CREATE POLICY "Superadmin full access users" ON public.users FOR ALL USING (public.user_role() = 'super_admin');
CREATE POLICY "Tenant admin manage users" ON public.users FOR ALL USING (tenant_id = public.tenant_id() AND public.user_role() = 'tenant_admin');
CREATE POLICY "Users view users in same tenant" ON public.users FOR SELECT USING (tenant_id = public.tenant_id());

-- Proyectos: Solo usuarios del mismo tenant pueden ver/editar sus proyectos
CREATE POLICY "Superadmin full access proyectos" ON public.proyectos FOR ALL USING (public.user_role() = 'super_admin');
CREATE POLICY "Tenant users manage projects" ON public.proyectos FOR ALL USING (tenant_id = public.tenant_id());

-- Catálogos (Ejemplo Sectores): Globales o del mismo tenant
CREATE POLICY "Superadmin full access sectores" ON public.sectores FOR ALL USING (public.user_role() = 'super_admin');
CREATE POLICY "Tenant read sectores" ON public.sectores FOR SELECT USING (tenant_id IS NULL OR tenant_id = public.tenant_id());