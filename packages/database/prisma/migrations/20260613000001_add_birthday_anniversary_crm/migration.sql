-- Add dateOfBirth to guests table (optional — not all guests will have it)
ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "dateOfBirth" TIMESTAMP(3);

-- Add ANNIVERSARY trigger to SequenceTrigger enum
ALTER TYPE "SequenceTrigger" ADD VALUE IF NOT EXISTS 'ANNIVERSARY';
