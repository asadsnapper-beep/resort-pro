import type { Metadata } from 'next';
import { LegalPage, H2, P, UL } from '@/components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Refund & Cancellation Policy — ResortPro',
  description: 'ResortPro subscription refund and cancellation terms.',
};

export default function RefundPage() {
  return (
    <LegalPage title="Refund & Cancellation Policy" updated="30 June 2026">
      <P>
        This policy explains refunds and cancellations for ResortPro subscription fees — the amounts you pay us to use the
        platform. It does not cover payments your guests make to your resort; those are governed by your own resort&rsquo;s
        booking and refund policy.
      </P>

      <H2>1. Free trial</H2>
      <P>
        Paid plans may include a free trial. You are not charged during the trial. If you do not subscribe before the trial
        ends, your account simply pauses — no payment is taken.
      </P>

      <H2>2. Cancelling your subscription</H2>
      <UL>
        <li>You can cancel anytime from your dashboard under Billing.</li>
        <li>When you cancel, your plan stays active until the end of the current billing period.</li>
        <li>We do not automatically pro-rate or refund the unused part of a period, except as described below.</li>
        <li>Your data remains available to export for a reasonable period after cancellation.</li>
      </UL>

      <H2>3. Refunds</H2>
      <UL>
        <li><strong>Monthly plans:</strong> generally non-refundable once a billing period has started, since you retain
          access for that period.</li>
        <li><strong>Annual plans:</strong> if you cancel within 14 days of the initial annual charge and have not made
          significant use of the service, you may request a full refund.</li>
        <li><strong>Service faults:</strong> if a prolonged outage or defect on our side prevents you from using the
          service, contact us — we will review and may issue a credit or refund.</li>
        <li><strong>Duplicate or erroneous charges:</strong> refunded in full once verified.</li>
      </UL>

      <H2>4. How to request a refund</H2>
      <P>
        Email{' '}
        <a href="mailto:support@resortpro.site" className="font-medium text-resort-600 underline">support@resortpro.site</a>{' '}
        with your account email and the charge in question. We aim to respond within 5 business days. Approved refunds are
        returned to your original payment method; processing time depends on your payment provider (bKash, SSLCommerz, or
        Stripe).
      </P>

      <H2>5. Changes to this policy</H2>
      <P>
        We may update this policy from time to time. Material changes will be notified through the service or by email.
      </P>

      <H2>6. Contact</H2>
      <P>
        ResortPro — billing and refunds:{' '}
        <a href="mailto:support@resortpro.site" className="font-medium text-resort-600 underline">support@resortpro.site</a>.
      </P>
    </LegalPage>
  );
}
