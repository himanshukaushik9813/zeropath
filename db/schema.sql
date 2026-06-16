create table intents (
  id uuid primary key default gen_random_uuid(),
  intent_hash text not null unique,
  source_chain text not null,
  token_symbol text not null,
  destination_commitment text not null,
  route_commitment text not null,
  privacy_level text not null check (privacy_level in ('max-privacy', 'balanced', 'lowest-fee')),
  deadline timestamptz not null,
  status text not null default 'quoted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table solver_quotes (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null references intents(id),
  solver_id text not null,
  route_commitment text not null,
  fee_bps integer not null,
  latency_seconds integer not null,
  privacy_score integer not null check (privacy_score between 0 and 100),
  selected boolean not null default false,
  created_at timestamptz not null default now()
);

create table settlement_epochs (
  id bigserial primary key,
  epoch_number bigint not null unique,
  batch_root text not null,
  source_event_root text not null,
  status text not null default 'open',
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

create table batch_members (
  epoch_id bigint not null references settlement_epochs(id),
  intent_id uuid not null references intents(id),
  nullifier_hash text not null unique,
  asset_id text not null,
  amount_bucket text not null,
  primary key (epoch_id, intent_id)
);

create table source_events (
  id bigserial primary key,
  source_chain text not null,
  contract_address text not null,
  block_number bigint not null,
  leaf_index bigint not null,
  intent_hash text not null,
  source_commitment text not null,
  destination_commitment text not null,
  route_commitment text not null,
  created_at timestamptz not null default now(),
  unique (source_chain, leaf_index)
);

create table proof_jobs (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null references intents(id),
  proof_system text not null default 'groth16-bn254',
  public_inputs jsonb not null,
  status text not null default 'queued',
  stellar_tx_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table privacy_scores (
  intent_id uuid primary key references intents(id),
  anonymity_set integer not null,
  route_entropy integer not null,
  timing_cover integer not null,
  liquidity_depth integer not null,
  total_score integer not null check (total_score between 0 and 100),
  created_at timestamptz not null default now()
);

create table solver_reputation (
  solver_id text primary key,
  completed_count bigint not null default 0,
  failed_count bigint not null default 0,
  median_latency_seconds integer not null default 0,
  average_privacy_score integer not null default 0,
  bonded_amount numeric not null default 0,
  updated_at timestamptz not null default now()
);
