-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "waNotifBookingConfirm" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "waNotifCancellation" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "waNotifCheckinReminder" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "waNotifCheckoutRemind" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "waNotifInvoiceSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "waNotifPaymentReceived" BOOLEAN NOT NULL DEFAULT true;


-- Start WhatsApp from what the owner could already see ticked. The Settings
-- table showed the SMS values in both columns, so these are the values each
-- owner believed WhatsApp had. Nothing was ever sent on either channel, so no
-- delivery behaviour changes.
UPDATE "tenants" SET
  "waNotifBookingConfirm"  = "notifBookingConfirm",
  "waNotifPaymentReceived" = "notifPaymentReceived",
  "waNotifCheckinReminder" = "notifCheckinReminder",
  "waNotifCheckoutRemind"  = "notifCheckoutRemind",
  "waNotifCancellation"    = "notifCancellation",
  "waNotifInvoiceSent"     = "notifInvoiceSent";
