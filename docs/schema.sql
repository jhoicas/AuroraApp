-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.tenants (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL,
  domain character varying UNIQUE,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  nit character varying,
  contact_email character varying NOT NULL,
  status character varying NOT NULL DEFAULT 'ACTIVE'::character varying,
  deleted_at timestamp with time zone,
  CONSTRAINT tenants_pkey PRIMARY KEY (id)
);
CREATE TABLE public.users (
  id uuid NOT NULL,
  tenant_id uuid,
  email character varying NOT NULL UNIQUE,
  full_name character varying,
  role USER-DEFINED NOT NULL DEFAULT 'viewer'::user_role,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  role_id uuid,
  password_hash character varying,
  deleted_at timestamp with time zone,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES public.roles(id)
);
CREATE TABLE public.proyectos (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  creador_id uuid NOT NULL,
  codigo_bpin character varying UNIQUE,
  nombre text NOT NULL,
  estado character varying DEFAULT 'EN_FORMULACION'::character varying,
  sector_id uuid,
  producto_principal_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT proyectos_pkey PRIMARY KEY (id),
  CONSTRAINT proyectos_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT proyectos_creador_id_fkey FOREIGN KEY (creador_id) REFERENCES public.users(id)
);
CREATE TABLE public.programas_subprogramas (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id uuid,
  sector_id uuid,
  codigo_sector character varying NOT NULL,
  nombre_sector character varying NOT NULL,
  codigo_programa character varying NOT NULL,
  nombre_programa character varying NOT NULL,
  ambito_aplicacion text,
  codigo_subprograma character varying,
  nombre_subprograma character varying,
  observaciones text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT programas_subprogramas_pkey PRIMARY KEY (id),
  CONSTRAINT programas_subprogramas_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);
CREATE TABLE public.lista_entregables (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id uuid,
  codigo_entregable character varying NOT NULL,
  listado_de_entregables text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT lista_entregables_pkey PRIMARY KEY (id),
  CONSTRAINT lista_entregables_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);
CREATE TABLE public.lista_actividades (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id uuid,
  codigo_actividad character varying NOT NULL,
  unidad_de_medida character varying,
  listado_de_actividades text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT lista_actividades_pkey PRIMARY KEY (id),
  CONSTRAINT lista_actividades_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);
CREATE TABLE public.ods (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id uuid,
  codigo_objetivo_ods character varying,
  descripcion_objetivo_ods text,
  codigo_meta_ods character varying,
  descripcion_meta_ods text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ods_pkey PRIMARY KEY (id),
  CONSTRAINT ods_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);
CREATE TABLE public.knowledge_wiki_notes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  title character varying NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT knowledge_wiki_notes_pkey PRIMARY KEY (id),
  CONSTRAINT knowledge_wiki_notes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);
CREATE TABLE public.roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code character varying NOT NULL,
  name character varying NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  CONSTRAINT roles_pkey PRIMARY KEY (id)
);
CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid,
  creator_id uuid,
  code_bpin character varying,
  name text,
  description text,
  sector character varying,
  problem_description text,
  general_objective text,
  status character varying DEFAULT 'DRAFT'::character varying,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  deleted_at timestamp with time zone,
  sector_id uuid,
  program_code character varying,
  product_code character varying,
  situacion_existente text,
  magnitud_problema text,
  mga_formulation_data jsonb DEFAULT '{}'::jsonb,
  fase_maduracion character varying DEFAULT 'PERFIL'::character varying,
  CONSTRAINT projects_pkey PRIMARY KEY (id)
);
CREATE TABLE public.sectores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  codigo character varying NOT NULL,
  nombre character varying NOT NULL,
  aplicacion text,
  observaciones text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  CONSTRAINT sectores_pkey PRIMARY KEY (id)
);
CREATE TABLE public.catalogo_productos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid,
  sector character varying,
  nombre_sector text,
  codigo_programa character varying,
  nombre_programa text,
  codigo_producto character varying NOT NULL,
  producto text NOT NULL,
  descripcion text,
  medido_a_traves_de text,
  codigo_indicador_producto text NOT NULL DEFAULT ''::text,
  indicador_producto text,
  unidad_de_medida text,
  indicador_principal boolean DEFAULT false,
  es_nacional boolean DEFAULT false,
  es_territorial boolean DEFAULT false,
  ods text,
  meta_ods text,
  tipologia_general_suifp text,
  tipologia_d boolean DEFAULT false,
  tipologia_e boolean DEFAULT false,
  tipologia_a_piip boolean DEFAULT false,
  tipologia_b_piip boolean DEFAULT false,
  tipologia_c_piip boolean DEFAULT false,
  tiene_edt boolean DEFAULT false,
  edt text,
  created_at timestamp with time zone NOT NULL,
  program_id uuid,
  observaciones text,
  updated_at timestamp with time zone,
  codigo character varying,
  nombre text,
  CONSTRAINT catalogo_productos_pkey PRIMARY KEY (id)
);
CREATE TABLE public.catalogo_edt (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid,
  codigo_producto_estandarizado character varying NOT NULL,
  nombre_producto text,
  codigo_entregable_l1 character varying NOT NULL DEFAULT ''::character varying,
  nombre_entregable_l1 text,
  codigo_entregable_l2 character varying NOT NULL DEFAULT ''::character varying,
  nombre_entregable_l2 text,
  codigo_entregable_l3 character varying NOT NULL DEFAULT ''::character varying,
  nombre_entregable_l3 text,
  codigo_actividad character varying NOT NULL DEFAULT ''::character varying,
  actividad text,
  unidad_de_medida text,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone,
  product_id uuid,
  observaciones text,
  descripcion_actividad text,
  CONSTRAINT catalogo_edt_pkey PRIMARY KEY (id),
  CONSTRAINT fk_catalogo_edt_product FOREIGN KEY (product_id) REFERENCES public.catalogo_productos(id)
);
CREATE TABLE public.catalogo_entregables (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid,
  codigo_entregable character varying NOT NULL,
  listado_de_entregables text,
  created_at timestamp with time zone NOT NULL,
  product_id uuid,
  edt_id uuid,
  codigo_producto character varying,
  nombre_producto text,
  nombre_entregable text,
  unidad_de_medida text,
  tipologia text,
  observaciones text,
  updated_at timestamp with time zone,
  CONSTRAINT catalogo_entregables_pkey PRIMARY KEY (id)
);
CREATE TABLE public.catalogo_actividades (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid,
  codigo_actividad character varying NOT NULL,
  listado_de_actividades text,
  unidad_de_medida text,
  created_at timestamp with time zone NOT NULL,
  CONSTRAINT catalogo_actividades_pkey PRIMARY KEY (id)
);
CREATE TABLE public.catalogo_ods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid,
  cod_objetivo_ods character varying NOT NULL,
  descripcion_objetivo_ods text,
  codigo_meta_ods character varying NOT NULL DEFAULT ''::character varying,
  descripcion_meta_ods text,
  created_at timestamp with time zone NOT NULL,
  CONSTRAINT catalogo_ods_pkey PRIMARY KEY (id)
);
CREATE TABLE public.ai_knowledge_nodes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid,
  project_key character varying NOT NULL,
  node_type character varying NOT NULL,
  label character varying,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL,
  embedding USER-DEFINED,
  CONSTRAINT ai_knowledge_nodes_pkey PRIMARY KEY (id)
);
CREATE TABLE public.ai_knowledge_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_key character varying NOT NULL,
  source_node_id uuid NOT NULL,
  target_node_id uuid NOT NULL,
  relationship character varying NOT NULL,
  created_at timestamp with time zone NOT NULL,
  tenant_id uuid,
  CONSTRAINT ai_knowledge_links_pkey PRIMARY KEY (id)
);
CREATE TABLE public.ai_usage_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role character varying NOT NULL,
  action character varying NOT NULL,
  created_at timestamp with time zone NOT NULL,
  intent character varying,
  model character varying,
  CONSTRAINT ai_usage_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.ai_chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_id uuid,
  session_id character varying NOT NULL,
  role character varying NOT NULL,
  content text NOT NULL,
  model character varying,
  action_cards jsonb DEFAULT '[]'::jsonb,
  route_context character varying,
  created_at timestamp with time zone NOT NULL,
  CONSTRAINT ai_chat_messages_pkey PRIMARY KEY (id)
);
CREATE TABLE public.project_evaluations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  alternative_name character varying NOT NULL,
  discount_rate numeric NOT NULL,
  cash_flows jsonb NOT NULL,
  vpn numeric NOT NULL,
  tir numeric,
  created_at timestamp with time zone NOT NULL,
  CONSTRAINT project_evaluations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.mga_causes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL,
  parent_id uuid,
  cause_type character varying NOT NULL,
  description text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT mga_causes_pkey PRIMARY KEY (id)
);
CREATE TABLE public.mga_specific_objectives (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL,
  cause_id uuid NOT NULL,
  description text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT mga_specific_objectives_pkey PRIMARY KEY (id)
);
CREATE TABLE public.mga_indicators (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL,
  specific_objective_id uuid,
  name text NOT NULL,
  unit character varying NOT NULL,
  target numeric NOT NULL,
  source_type character varying NOT NULL,
  verification_source text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT mga_indicators_pkey PRIMARY KEY (id)
);
CREATE TABLE public.budget_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL,
  product_id uuid,
  description text NOT NULL,
  amount numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT budget_items_pkey PRIMARY KEY (id)
);
CREATE TABLE public.mga_effects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL,
  parent_id uuid,
  effect_type character varying NOT NULL,
  description text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT mga_effects_pkey PRIMARY KEY (id)
);
CREATE TABLE public.mga_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL,
  actor text DEFAULT ''::text,
  entity text DEFAULT ''::text,
  position character varying DEFAULT ''::character varying,
  interests text NOT NULL,
  contribution text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  actor_id integer NOT NULL DEFAULT 0,
  entity_id integer,
  position_id integer NOT NULL DEFAULT 0,
  otro_participante text,
  CONSTRAINT mga_participants_pkey PRIMARY KEY (id)
);
CREATE TABLE public.mga_populations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL,
  population_type character varying NOT NULL,
  total_number integer NOT NULL DEFAULT 0,
  source text NOT NULL,
  locations jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT mga_populations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.mga_alternatives (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL,
  description text NOT NULL,
  evaluate_profitability boolean NOT NULL DEFAULT false,
  evaluate_cost boolean NOT NULL DEFAULT false,
  proceeds_to_preparation boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT mga_alternatives_pkey PRIMARY KEY (id)
);
CREATE TABLE public.mga_needs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL,
  alternative_id character varying NOT NULL,
  bien_servicio character varying NOT NULL,
  descripcion text NOT NULL DEFAULT ''::text,
  descripcion_oferta text NOT NULL DEFAULT ''::text,
  descripcion_demanda text NOT NULL DEFAULT ''::text,
  unidad_medida_id integer NOT NULL,
  anio_inicial integer NOT NULL,
  anio_final integer NOT NULL,
  ultimo_anio_proyectado integer NOT NULL,
  valores_anuales jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT mga_needs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.project_catalog_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL,
  product_id uuid NOT NULL,
  product_code character varying NOT NULL,
  tipologia character varying NOT NULL DEFAULT ''::character varying,
  requires_edt boolean NOT NULL DEFAULT false,
  sector_code character varying NOT NULL DEFAULT ''::character varying,
  program_code character varying NOT NULL DEFAULT ''::character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT project_catalog_links_pkey PRIMARY KEY (id)
);
CREATE TABLE public.project_edt_nodes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL,
  catalog_edt_id uuid,
  code character varying NOT NULL,
  level integer NOT NULL DEFAULT 1,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT project_edt_nodes_pkey PRIMARY KEY (id)
);
CREATE TABLE public.project_deliverables (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL,
  project_edt_node_id uuid NOT NULL,
  catalog_deliverable_id uuid,
  code character varying NOT NULL,
  name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT project_deliverables_pkey PRIMARY KEY (id)
);
CREATE TABLE public.project_activities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL,
  project_deliverable_id uuid NOT NULL,
  catalog_activity_id uuid,
  code character varying NOT NULL,
  name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT project_activities_pkey PRIMARY KEY (id)
);
CREATE TABLE public.procesos (
  id bigint NOT NULL,
  name character varying NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  CONSTRAINT procesos_pkey PRIMARY KEY (id)
);
CREATE TABLE public.regiones (
  id bigint NOT NULL,
  name character varying NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  CONSTRAINT regiones_pkey PRIMARY KEY (id)
);
CREATE TABLE public.departamentos (
  id bigint NOT NULL,
  name character varying NOT NULL,
  region_id bigint NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  CONSTRAINT departamentos_pkey PRIMARY KEY (id),
  CONSTRAINT fk_regiones_departamentos FOREIGN KEY (region_id) REFERENCES public.regiones(id)
);
CREATE TABLE public.municipios (
  id bigint NOT NULL,
  name character varying NOT NULL,
  departamento_id bigint NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  CONSTRAINT municipios_pkey PRIMARY KEY (id),
  CONSTRAINT fk_departamentos_municipios FOREIGN KEY (departamento_id) REFERENCES public.departamentos(id)
);
CREATE TABLE public.mga_catalog_actors (
  id bigint NOT NULL DEFAULT nextval('mga_catalog_actors_id_seq'::regclass),
  name character varying NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  CONSTRAINT mga_catalog_actors_pkey PRIMARY KEY (id)
);
CREATE TABLE public.mga_catalog_positions (
  id bigint NOT NULL DEFAULT nextval('mga_catalog_positions_id_seq'::regclass),
  name character varying NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  CONSTRAINT mga_catalog_positions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.mga_catalog_entities (
  id bigint NOT NULL DEFAULT nextval('mga_catalog_entities_id_seq'::regclass),
  actor_id bigint NOT NULL,
  name character varying NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  CONSTRAINT mga_catalog_entities_pkey PRIMARY KEY (id),
  CONSTRAINT fk_mga_catalog_entities_actor FOREIGN KEY (actor_id) REFERENCES public.mga_catalog_actors(id)
);
CREATE TABLE public.tipos_agrupacion (
  id bigint NOT NULL DEFAULT nextval('tipos_agrupacion_id_seq'::regclass),
  name character varying NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  CONSTRAINT tipos_agrupacion_pkey PRIMARY KEY (id)
);
CREATE TABLE public.agrupaciones (
  id bigint NOT NULL DEFAULT nextval('agrupaciones_id_seq'::regclass),
  name character varying NOT NULL,
  municipio_id bigint NOT NULL,
  tipo_agrupacion_id bigint NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  CONSTRAINT agrupaciones_pkey PRIMARY KEY (id),
  CONSTRAINT fk_municipios_agrupaciones FOREIGN KEY (municipio_id) REFERENCES public.municipios(id),
  CONSTRAINT fk_tipos_agrupacion_agrupaciones FOREIGN KEY (tipo_agrupacion_id) REFERENCES public.tipos_agrupacion(id)
);
CREATE TABLE public.catalog_sync_logs (
  id uuid NOT NULL,
  catalog_name character varying NOT NULL,
  started_at timestamp with time zone NOT NULL,
  completed_at timestamp with time zone,
  status character varying NOT NULL,
  records_processed bigint DEFAULT 0,
  error_message text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  CONSTRAINT catalog_sync_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.pnd_catalog (
  id bigint NOT NULL DEFAULT nextval('pnd_catalog_id_seq'::regclass),
  plan_id bigint,
  plan_name text,
  pillar_id bigint,
  objective_id bigint,
  strategy_id bigint,
  component_id bigint,
  pillar_description text,
  objective_description text,
  strategy_description text,
  component_description text,
  row_state bigint,
  unique_identifier character varying,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  CONSTRAINT pnd_catalog_pkey PRIMARY KEY (id)
);
CREATE TABLE public.catalogo_unidades_medida (
  id bigint NOT NULL,
  name character varying NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT catalogo_unidades_medida_pkey PRIMARY KEY (id)
);
CREATE TABLE public.departments (
  id bigint NOT NULL DEFAULT nextval('departments_id_seq'::regclass),
  code character varying NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  CONSTRAINT departments_pkey PRIMARY KEY (id)
);
CREATE TABLE public.municipalities (
  id bigint NOT NULL DEFAULT nextval('municipalities_id_seq'::regclass),
  code character varying NOT NULL,
  name text NOT NULL,
  department_id bigint NOT NULL,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  CONSTRAINT municipalities_pkey PRIMARY KEY (id),
  CONSTRAINT fk_municipalities_department FOREIGN KEY (department_id) REFERENCES public.departments(id)
);