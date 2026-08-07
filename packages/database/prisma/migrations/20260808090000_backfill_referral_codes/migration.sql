-- Every existing tenant needs a shareable code. New signups receive one in
-- the registration flow; this migration safely covers accounts created before
-- that capability existed. The 12-character hash suffix keeps the value under
-- the public 20-character input limit and makes collisions practically nil.
UPDATE "tenants"
SET "referralCode" =
  COALESCE(NULLIF(UPPER(SUBSTRING(REGEXP_REPLACE("slug", '[^A-Za-z0-9]', '', 'g') FROM 1 FOR 6)), ''), 'RESORT')
  || '-' || UPPER(SUBSTRING(MD5("id") FROM 1 FOR 12))
WHERE "referralCode" IS NULL;
