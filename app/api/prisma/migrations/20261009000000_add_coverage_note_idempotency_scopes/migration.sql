-- CoverageNote commands reuse IdempotencyRecord; no table or data changes.
ALTER TYPE "IdempotencyScope" ADD VALUE 'HEALTHCARE_EQUIPMENT_COVERAGE_NOTE_CREATE';
ALTER TYPE "IdempotencyScope" ADD VALUE 'HEALTHCARE_EQUIPMENT_COVERAGE_NOTE_RESOLVE';
