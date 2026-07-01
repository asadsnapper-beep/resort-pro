import type { Metadata } from 'next';
import { LegalPage, H2, P, UL } from '@/components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Privacy Policy — ResortPro',
  description: 'How ResortPro collects, uses, and protects personal data.',
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="30 June 2026">
      <P>
        This Privacy Policy explains how ResortPro (&ldquo;we&rdquo;, &ldquo;us&rdquo;) collects, uses, and protects
        personal data when you use our platform at resortpro.site and its subdomains. We act as a data processor for the
        guest information our customers (resorts) store in ResortPro, and as a data controller for the account information
        of our customers themselves.
      </P>

      <H2>1. Information we collect</H2>
      <UL>
        <li><strong>Account data</strong> — name, email, phone, business name, and login credentials.</li>
        <li><strong>Guest data (entered by our customers)</strong> — guest names, contact details, booking history, and any
          documents a resort chooses to store.</li>
        <li><strong>Payment data</strong> — processed by our payment providers; we do not store full card numbers.</li>
        <li><strong>Usage data</strong> — device, browser, IP address, and how you interact with the service.</li>
      </UL>

      <H2>2. How we use information</H2>
      <UL>
        <li>To provide, secure, and improve the service.</li>
        <li>To process subscriptions and payments.</li>
        <li>To send transactional messages (e.g. sign-up, password reset, receipts) and important service notices.</li>
        <li>To provide support and respond to your requests.</li>
        <li>To comply with legal obligations.</li>
      </UL>

      <H2>3. Legal bases</H2>
      <P>
        Where applicable, we process personal data to perform our contract with you, for our legitimate interests in
        operating the service, to comply with legal obligations, and with your consent where required.
      </P>

      <H2>4. Sharing</H2>
      <P>
        We share data only with service providers that help us run ResortPro — for example hosting, email delivery, and
        payment processing (such as bKash, SSLCommerz, and Stripe). These providers process data on our behalf under
        appropriate safeguards. We do not sell personal data.
      </P>

      <H2>5. Data retention</H2>
      <P>
        We keep personal data for as long as your account is active and as needed to provide the service, then for a
        reasonable period to meet legal, accounting, and dispute-resolution needs. Customers can delete guest records, and
        account data can be deleted on request.
      </P>

      <H2>6. Security</H2>
      <P>
        We use encryption in transit, access controls, and tenant isolation to protect data. No system is perfectly
        secure, but we work to protect your information and will notify affected users of significant breaches as required
        by law.
      </P>

      <H2>7. Your rights</H2>
      <UL>
        <li>Access, correct, or delete your personal data.</li>
        <li>Export your core data from the dashboard.</li>
        <li>Object to or restrict certain processing, where applicable.</li>
        <li>Withdraw consent where processing is based on consent.</li>
      </UL>
      <P>
        To exercise these rights, email{' '}
        <a href="mailto:privacy@resortpro.site" className="font-medium text-resort-600 underline">privacy@resortpro.site</a>.
        If you are a guest of a resort using ResortPro, please contact that resort directly, or us and we will route your
        request.
      </P>

      <H2>8. Cookies</H2>
      <P>
        We use essential cookies to keep you signed in and secure, and limited analytics to understand usage. You can
        control cookies through your browser settings.
      </P>

      <H2>9. International transfers</H2>
      <P>
        Data may be processed in countries other than yours by our providers. Where this happens, we rely on appropriate
        safeguards to protect your information.
      </P>

      <H2>10. Changes</H2>
      <P>
        We may update this policy from time to time. Material changes will be notified through the service or by email.
      </P>

      <H2>11. Contact</H2>
      <P>
        ResortPro — privacy enquiries:{' '}
        <a href="mailto:privacy@resortpro.site" className="font-medium text-resort-600 underline">privacy@resortpro.site</a>.
      </P>
    </LegalPage>
  );
}
