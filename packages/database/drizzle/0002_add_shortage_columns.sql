-- Safe migration: Add missing columns to shortages table only
-- Run with: psql $DATABASE_URL < packages/database/drizzle/0002_add_shortage_columns.sql

-- Add new columns to shortages table (skip if they already exist)
DO $$
BEGIN
    -- Slug
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shortages' AND column_name = 'slug') THEN
        ALTER TABLE shortages ADD COLUMN slug TEXT UNIQUE;
        RAISE NOTICE 'Added column: slug';
    END IF;

    -- Multi-source support
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shortages' AND column_name = 'source_authority') THEN
        ALTER TABLE shortages ADD COLUMN source_authority TEXT DEFAULT 'EMA';
        RAISE NOTICE 'Added column: source_authority';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shortages' AND column_name = 'region') THEN
        ALTER TABLE shortages ADD COLUMN region TEXT DEFAULT 'EU';
        RAISE NOTICE 'Added column: region';
    END IF;

    -- Substance linking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shortages' AND column_name = 'substance_id') THEN
        ALTER TABLE shortages ADD COLUMN substance_id INTEGER REFERENCES substances(id);
        RAISE NOTICE 'Added column: substance_id';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shortages' AND column_name = 'inn') THEN
        ALTER TABLE shortages ADD COLUMN inn TEXT;
        RAISE NOTICE 'Added column: inn';
    END IF;

    -- EMA-specific fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shortages' AND column_name = 'category') THEN
        ALTER TABLE shortages ADD COLUMN category TEXT;
        RAISE NOTICE 'Added column: category';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shortages' AND column_name = 'medicine_affected') THEN
        ALTER TABLE shortages ADD COLUMN medicine_affected TEXT;
        RAISE NOTICE 'Added column: medicine_affected';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shortages' AND column_name = 'therapeutic_area_mesh') THEN
        ALTER TABLE shortages ADD COLUMN therapeutic_area_mesh TEXT;
        RAISE NOTICE 'Added column: therapeutic_area_mesh';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shortages' AND column_name = 'pharmaceutical_forms_affected') THEN
        ALTER TABLE shortages ADD COLUMN pharmaceutical_forms_affected TEXT;
        RAISE NOTICE 'Added column: pharmaceutical_forms_affected';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shortages' AND column_name = 'strengths_affected') THEN
        ALTER TABLE shortages ADD COLUMN strengths_affected TEXT;
        RAISE NOTICE 'Added column: strengths_affected';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shortages' AND column_name = 'availability_of_alternatives') THEN
        ALTER TABLE shortages ADD COLUMN availability_of_alternatives TEXT;
        RAISE NOTICE 'Added column: availability_of_alternatives';
    END IF;

    -- Timeline fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shortages' AND column_name = 'start_of_shortage_date') THEN
        ALTER TABLE shortages ADD COLUMN start_of_shortage_date DATE;
        RAISE NOTICE 'Added column: start_of_shortage_date';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shortages' AND column_name = 'first_published_date') THEN
        ALTER TABLE shortages ADD COLUMN first_published_date DATE;
        RAISE NOTICE 'Added column: first_published_date';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shortages' AND column_name = 'last_updated_date') THEN
        ALTER TABLE shortages ADD COLUMN last_updated_date DATE;
        RAISE NOTICE 'Added column: last_updated_date';
    END IF;

    -- Flexible JSON data
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shortages' AND column_name = 'shortage_data') THEN
        ALTER TABLE shortages ADD COLUMN shortage_data JSONB;
        RAISE NOTICE 'Added column: shortage_data';
    END IF;

    -- Deduplication
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shortages' AND column_name = 'content_hash') THEN
        ALTER TABLE shortages ADD COLUMN content_hash TEXT;
        RAISE NOTICE 'Added column: content_hash';
    END IF;

    -- Source document ID
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shortages' AND column_name = 'source_document_id') THEN
        ALTER TABLE shortages ADD COLUMN source_document_id TEXT;
        RAISE NOTICE 'Added column: source_document_id';
    END IF;

    RAISE NOTICE 'Shortage columns migration complete!';
END $$;

-- Create indexes (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS shortages_authority_idx ON shortages(source_authority);
CREATE INDEX IF NOT EXISTS shortages_region_idx ON shortages(region);
CREATE INDEX IF NOT EXISTS shortages_inn_idx ON shortages(inn);
CREATE INDEX IF NOT EXISTS shortages_substance_idx ON shortages(substance_id);
CREATE INDEX IF NOT EXISTS shortages_start_date_idx ON shortages(start_of_shortage_date);
CREATE INDEX IF NOT EXISTS shortages_slug_idx ON shortages(slug);
CREATE INDEX IF NOT EXISTS shortages_authority_status_idx ON shortages(source_authority, status);

-- Show current shortages table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'shortages'
ORDER BY ordinal_position;
