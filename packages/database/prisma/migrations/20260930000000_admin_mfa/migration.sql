-- Admin second factor (release-readiness review M-03).
--
-- mfaSecret holds a base32 TOTP secret, encrypted with CREDENTIALS_KEY before
-- it is written. mfaEnabledAt stays null until the admin has proved they can
-- read a code from the app, so a half-finished enrolment never locks anyone out.

ALTER TABLE "admin_users" ADD COLUMN "mfaSecret" TEXT;
ALTER TABLE "admin_users" ADD COLUMN "mfaEnabledAt" TIMESTAMP(3);

-- Recovery codes. Hashed, single use, cascade with the account.
CREATE TABLE "admin_recovery_codes" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_recovery_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_recovery_codes_adminUserId_idx" ON "admin_recovery_codes"("adminUserId");

ALTER TABLE "admin_recovery_codes" ADD CONSTRAINT "admin_recovery_codes_adminUserId_fkey"
    FOREIGN KEY ("adminUserId") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
