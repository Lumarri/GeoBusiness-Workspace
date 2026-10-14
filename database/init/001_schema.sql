CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS query_cache (
    key varchar(64) PRIMARY KEY,
    payload jsonb NOT NULL,
    retrieved_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_query_cache_expires_at ON query_cache(expires_at);

CREATE TABLE IF NOT EXISTS business_observations (
    osm_id varchar(64) PRIMARY KEY,
    name text NOT NULL,
    category varchar(32) NOT NULL,
    location geography(Point,4326) NOT NULL,
    retrieved_at timestamptz NOT NULL,
    record jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_business_observations_location ON business_observations USING gist(location);
CREATE INDEX IF NOT EXISTS ix_business_observations_category ON business_observations(category);

