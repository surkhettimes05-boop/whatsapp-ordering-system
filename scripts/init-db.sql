#!/bin/bash

# ============================================================================
# Docker Initialization Script
# ============================================================================
# Initializes PostgreSQL with required schema and data
# This is run automatically on first container startup

set -e

echo "Initializing PostgreSQL database..."

# Get environment variables from .env.production if available
if [ -f "/docker-entrypoint-initdb.d/.env" ]; then
    source "/docker-entrypoint-initdb.d/.env"
fi

# ============================================================================
# Create Database Functions & Extensions
# ============================================================================

psql -v ON_ERROR_STOP=1 <<-EOSQL
    -- Enable required extensions
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pg_trgm";
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    
    -- Create function for updated_at timestamp
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS \$\$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    \$\$ LANGUAGE plpgsql;
    
    -- Create function for created_at timestamp
    CREATE OR REPLACE FUNCTION set_created_at_column()
    RETURNS TRIGGER AS \$\$
    BEGIN
        NEW.created_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    \$\$ LANGUAGE plpgsql;
    
    -- Create function to generate short IDs
    CREATE OR REPLACE FUNCTION generate_short_id(prefix text DEFAULT '')
    RETURNS text AS \$\$
    DECLARE
        characters text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        result text := prefix;
        i integer;
    BEGIN
        FOR i IN 1..12 LOOP
            result := result || substr(characters, floor(random() * 36)::integer + 1, 1);
        END LOOP;
        RETURN result;
    END;
    \$\$ LANGUAGE plpgsql;
    
    GRANT EXECUTE ON FUNCTION update_updated_at_column() TO postgres;
    GRANT EXECUTE ON FUNCTION set_created_at_column() TO postgres;
    GRANT EXECUTE ON FUNCTION generate_short_id(text) TO postgres;
    
    COMMIT;
EOSQL

echo "PostgreSQL initialization completed successfully"
