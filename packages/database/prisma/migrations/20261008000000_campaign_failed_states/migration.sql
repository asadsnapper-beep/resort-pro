-- A campaign send that did not go the way "SENT" implies (CRM QA finding 005).
--
-- Until now the only terminal state was SENT, applied unconditionally once the
-- loop finished — so a campaign where every single delivery failed read as a
-- successful send, to the one person who needed to know it had not been.

ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'PARTIAL';
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'FAILED';
