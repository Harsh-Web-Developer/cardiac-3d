-- ============================================
-- CARDIA — INITIAL DATABASE SCHEMA
-- ============================================

-- ============================================
-- 1. PATIENTS
-- ============================================

CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    age INTEGER,
    sex TEXT,
    height_cm NUMERIC,
    weight_kg NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================
-- 2. PATIENT PARAMETERS
-- ============================================

CREATE TABLE patient_parameters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id),
    blood_volume NUMERIC,
    heart_rate NUMERIC,
    contractility NUMERIC,
    svr NUMERIC,
    venous_compliance NUMERIC,
    cardiac_compliance NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================
-- 3. SCENARIOS
-- ============================================

CREATE TABLE scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    description TEXT,
    category TEXT,
    default_parameters JSONB,
    difficulty TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================
-- 4. SIMULATION SESSIONS
-- ============================================

CREATE TABLE simulation_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id),
    status TEXT CHECK (
        status IN ('running', 'paused', 'completed', 'abandoned')
    ),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    initial_state JSONB,
    final_state JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================
-- 5. SIMULATION CHECKPOINTS
-- ============================================

CREATE TABLE simulation_checkpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES simulation_sessions(id),
    simulation_time NUMERIC,
    state JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================
-- 6. EXPERIMENTS
-- ============================================

CREATE TABLE experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES simulation_sessions(id),
    scenario_id UUID REFERENCES scenarios(id),
    name TEXT,
    description TEXT,
    experiment_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================
-- 7. EXPERIMENT PARAMETERS
-- ============================================

CREATE TABLE experiment_parameters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID REFERENCES experiments(id),
    parameter_name TEXT,
    initial_value NUMERIC,
    final_value NUMERIC,
    unit TEXT
);


-- ============================================
-- 8. EXPERIMENT RESULTS
-- ============================================

CREATE TABLE experiment_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID REFERENCES experiments(id),
    baseline_state JSONB,
    peak_state JSONB,
    final_state JSONB,
    change_summary JSONB,
    stability_score NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================
-- 9. COUNTERFACTUAL RUNS
-- ============================================

CREATE TABLE counterfactual_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES simulation_sessions(id),
    experiment_id UUID REFERENCES experiments(id),
    baseline_duration NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================
-- 10. COUNTERFACTUAL RESULTS
-- ============================================

CREATE TABLE counterfactual_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    counterfactual_id UUID REFERENCES counterfactual_runs(id),
    trajectory TEXT CHECK (
        trajectory IN ('baseline', 'intervention')
    ),
    final_state JSONB,
    metrics JSONB,
    stability_score NUMERIC
);


-- ============================================
-- 11. ML MODELS
-- ============================================

CREATE TABLE ml_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    version TEXT,
    model_type TEXT,
    features JSONB,
    target_parameters JSONB,
    metrics JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================
-- 12. ML PREDICTIONS
-- ============================================

CREATE TABLE ml_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES simulation_sessions(id),
    model_id UUID REFERENCES ml_models(id),
    input_features JSONB,
    predictions JSONB,
    confidence JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================
-- 13. KNOWLEDGE SOURCES
-- ============================================

CREATE TABLE knowledge_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    author TEXT,
    source_type TEXT,
    url TEXT,
    publication_year INTEGER,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================
-- 14. EXPLANATIONS
-- ============================================

CREATE TABLE explanations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES simulation_sessions(id),
    experiment_id UUID REFERENCES experiments(id),
    question TEXT,
    simulation_context JSONB,
    answer TEXT,
    sources JSONB,
    confidence NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_patient_parameters_patient_id
ON patient_parameters(patient_id);

CREATE INDEX idx_simulation_sessions_patient_id
ON simulation_sessions(patient_id);

CREATE INDEX idx_simulation_checkpoints_session_id
ON simulation_checkpoints(session_id);

CREATE INDEX idx_experiments_session_id
ON experiments(session_id);

CREATE INDEX idx_experiments_scenario_id
ON experiments(scenario_id);

CREATE INDEX idx_experiment_parameters_experiment_id
ON experiment_parameters(experiment_id);

CREATE INDEX idx_experiment_results_experiment_id
ON experiment_results(experiment_id);

CREATE INDEX idx_counterfactual_runs_session_id
ON counterfactual_runs(session_id);

CREATE INDEX idx_counterfactual_runs_experiment_id
ON counterfactual_runs(experiment_id);

CREATE INDEX idx_counterfactual_results_counterfactual_id
ON counterfactual_results(counterfactual_id);

CREATE INDEX idx_ml_predictions_session_id
ON ml_predictions(session_id);

CREATE INDEX idx_ml_predictions_model_id
ON ml_predictions(model_id);

CREATE INDEX idx_explanations_session_id
ON explanations(session_id);

CREATE INDEX idx_explanations_experiment_id
ON explanations(experiment_id);