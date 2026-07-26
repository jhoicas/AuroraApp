-- Script SQL para Supabase / PostgreSQL con pgvector
-- Incluye tablas del catálogo, base de conocimiento y políticas RLS por tenant

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.sectores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    codigo VARCHAR(50) NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    aplicacion TEXT,
    observaciones TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.sectores ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.programas_subprogramas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    sector_id UUID REFERENCES public.sectores(id) ON DELETE CASCADE,
    codigo_sector VARCHAR(50) NOT NULL,
    nombre_sector VARCHAR(255) NOT NULL,
    codigo_programa VARCHAR(50) NOT NULL,
    nombre_programa VARCHAR(255) NOT NULL,
    ambito_aplicacion TEXT,
    codigo_subprograma VARCHAR(50),
    nombre_subprograma VARCHAR(255),
    observaciones TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.programas_subprogramas ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.catalogo_productos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    sector VARCHAR(255),
    nombre_sector VARCHAR(255),
    codigo_programa VARCHAR(50),
    nombre_programa VARCHAR(255),
    codigo_producto VARCHAR(50),
    producto VARCHAR(255),
    descripcion TEXT,
    medido_a_traves_de TEXT,
    codigo_indicador_producto VARCHAR(50),
    indicador_producto VARCHAR(255),
    unidad_de_medida VARCHAR(100),
    indicador_principal BOOLEAN DEFAULT FALSE,
    es_nacional BOOLEAN DEFAULT FALSE,
    es_territorial BOOLEAN DEFAULT FALSE,
    ods_meta_ods TEXT,
    tipologia_general_suifp TEXT,
    tipologia_d TEXT,
    tipologia_e TEXT,
    tipologia_a_piip TEXT,
    tipologia_b_piip TEXT,
    tipologia_c_piip TEXT,
    tiene_edt BOOLEAN DEFAULT FALSE,
    edt TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.catalogo_productos ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.catalogo_edt (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    codigo_producto_estandarizado VARCHAR(50) NOT NULL,
    nombre_producto VARCHAR(255),
    codigo_entregable_l1 VARCHAR(50),
    nombre_entregable_l1 VARCHAR(255),
    codigo_entregable_l2 VARCHAR(50),
    nombre_entregable_l2 VARCHAR(255),
    codigo_entregable_l3 VARCHAR(50),
    nombre_entregable_l3 VARCHAR(255),
    codigo_actividad VARCHAR(50),
    actividad VARCHAR(255),
    unidad_de_medida VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.catalogo_edt ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.lista_entregables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    codigo_entregable VARCHAR(50) NOT NULL,
    listado_de_entregables TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.lista_entregables ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.lista_actividades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    codigo_actividad VARCHAR(50) NOT NULL,
    unidad_de_medida VARCHAR(100),
    listado_de_actividades TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.lista_actividades ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.ods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    codigo_objetivo_ods VARCHAR(50),
    descripcion_objetivo_ods TEXT,
    codigo_meta_ods VARCHAR(50),
    descripcion_meta_ods TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.ods ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CREACIÓN DE ÍNDICES (Ubicado aquí porque las tablas ya existen)
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_catalogo_sectores_codigo ON public.sectores (codigo);
CREATE UNIQUE INDEX IF NOT EXISTS idx_catalogo_programas_codigo ON public.programas_subprogramas (codigo_programa, COALESCE(codigo_subprograma, ''));
CREATE UNIQUE INDEX IF NOT EXISTS idx_catalogo_productos_codigo ON public.catalogo_productos (codigo_producto);
CREATE UNIQUE INDEX IF NOT EXISTS idx_catalogo_edt_codigo ON public.catalogo_edt (codigo_producto_estandarizado, COALESCE(codigo_entregable_l1, ''), COALESCE(codigo_entregable_l2, ''), COALESCE(codigo_entregable_l3, ''), COALESCE(codigo_actividad, ''));
CREATE UNIQUE INDEX IF NOT EXISTS idx_catalogo_ods_codigo ON public.ods (codigo_objetivo_ods, COALESCE(codigo_meta_ods, ''));

-- ============================================================================
-- BASE DE CONOCIMIENTO (WIKI) Y POLÍTICAS RLS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.knowledge_wiki_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_tenant_note UNIQUE (tenant_id, title)
);
ALTER TABLE public.knowledge_wiki_notes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID AS $$
    SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id', '')::UUID;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
    SELECT COALESCE(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') = 'super_admin';
$$ LANGUAGE SQL STABLE;

CREATE POLICY "Superadmin full access sectors" ON public.sectores
    FOR ALL USING (public.is_super_admin());
CREATE POLICY "Tenant access sectors" ON public.sectores
    FOR SELECT USING (tenant_id IS NULL OR tenant_id = public.current_tenant_id());

CREATE POLICY "Superadmin full access programas" ON public.programas_subprogramas
    FOR ALL USING (public.is_super_admin());
CREATE POLICY "Tenant access programas" ON public.programas_subprogramas
    FOR SELECT USING (tenant_id IS NULL OR tenant_id = public.current_tenant_id());

CREATE POLICY "Superadmin full access productos" ON public.catalogo_productos
    FOR ALL USING (public.is_super_admin());
CREATE POLICY "Tenant access productos" ON public.catalogo_productos
    FOR SELECT USING (tenant_id IS NULL OR tenant_id = public.current_tenant_id());

CREATE POLICY "Superadmin full access wiki" ON public.knowledge_wiki_notes
    FOR ALL USING (public.is_super_admin());

CREATE POLICY "Tenant select wiki" ON public.knowledge_wiki_notes
    FOR SELECT USING (tenant_id = public.current_tenant_id());
CREATE POLICY "Tenant insert wiki" ON public.knowledge_wiki_notes
    FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "Tenant update wiki" ON public.knowledge_wiki_notes
    FOR UPDATE USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "Tenant delete wiki" ON public.knowledge_wiki_notes
    FOR DELETE USING (tenant_id = public.current_tenant_id());