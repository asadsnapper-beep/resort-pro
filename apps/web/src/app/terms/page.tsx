import type { Metadata } from 'next';
import { LegalPage, H2, P, UL } from '@/components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Terms of Service — ResortPro',
  description: 'The terms governing your use of ResortPro, the resort management platform.',
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="30 June 2026">
      <P>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of ResortPro
        (&ldquo;ResortPro&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;), the resort and hotel management platform available at
        resortpro.site and its subdomains. By creating an account or using the service, you agree to these Terms. If you
        do not agree, do not use the service.
      </P>

      <H2>1. The service</H2>
      <P>
        ResortPro is a software-as-a-service platform that lets accommodation providers manage bookings, payments, guests,
        staff, restaurant orders, and a public booking website. We provide the software; you are responsible for how you
        run your business on it.
      </P>

      <H2>2. Accounts and eligibility</H2>
      <UL>
        <li>You must be at least 18 years old and authorised to act for the business you register.</li>
        <li>You are responsible for keeping your login credentials secure and for all activity under your account.</li>
        <li>You must provide accurate business and contact information and keep it up to date.</li>
        <li>Notify us promptly at support@resortpro.site if you suspect unauthorised access.</li>
      </UL>

      <H2>3. Free trial and subscriptions</H2>
      <UL>
        <li>Paid plans may start with a free trial. No charge is made during the trial unless you choose to subscribe.</li>
        <li>When you subscribe, fees are billed in advance for the billing period you select (monthly or annual).</li>
        <li>Subscriptions renew automatically until cancelled. You can cancel anytime from your dashboard.</li>
        <li>Prices, plan limits, and features are described on our pricing page and may change with notice.</li>
      </UL>

      <H2>4. Payments</H2>
      <P>
        Subscription and transaction payments are processed by third-party providers (for example bKash, SSLCommerz, and
        Stripe). By paying, you also agree to the applicable provider&rsquo;s terms. You are responsible for any taxes
        associated with your use of the service. Payments you collect from your own guests are between you and your guests;
        ResortPro is not a party to those transactions.
      </P>

      <H2>5. Acceptable use</H2>
      <P>You agree not to:</P>
      <UL>
        <li>Use the service for unlawful, fraudulent, or harmful purposes.</li>
        <li>Attempt to breach security, access other tenants&rsquo; data, or disrupt the service.</li>
        <li>Reverse engineer, resell, or copy the platform except as expressly permitted.</li>
        <li>Upload content that infringes others&rsquo; rights or violates applicable law.</li>
      </UL>

      <H2>6. Your data</H2>
      <P>
        You retain ownership of the data you and your guests put into ResortPro. You grant us a limited licence to host and
        process that data solely to provide and improve the service. Our handling of personal data is described in our{' '}
        <a href="/privacy" className="font-medium text-resort-600 underline">Privacy Policy</a>. You can export your core
        data at any time.
      </P>

      <H2>7. Availability and support</H2>
      <P>
        We work to keep the service available and secure but do not guarantee uninterrupted access. We may perform
        maintenance and update features. Support is provided by email and, where offered, WhatsApp during business hours.
      </P>

      <H2>8. Suspension and termination</H2>
      <UL>
        <li>You may stop using the service and cancel your subscription at any time.</li>
        <li>We may suspend or terminate accounts that violate these Terms or fail to pay.</li>
        <li>On termination, you may export your data for a reasonable period before it is deleted.</li>
      </UL>

      <H2>9. Disclaimers and liability</H2>
      <P>
        The service is provided &ldquo;as is&rdquo; without warranties of any kind to the extent permitted by law. To the
        maximum extent permitted by applicable law, ResortPro is not liable for indirect or consequential losses, and our
        total liability for any claim is limited to the fees you paid us in the twelve months before the claim.
      </P>

      <H2>10. Changes to these Terms</H2>
      <P>
        We may update these Terms from time to time. Material changes will be notified through the service or by email.
        Continued use after changes take effect means you accept the updated Terms.
      </P>

      <H2>11. Governing law</H2>
      <P>
        These Terms are governed by the laws of Bangladesh, and the courts of Dhaka have exclusive jurisdiction over any
        dispute, without prejudice to any mandatory consumer protections available to you.
      </P>

      <H2>12. Contact</H2>
      <P>
        ResortPro — email{' '}
        <a href="mailto:support@resortpro.site" className="font-medium text-resort-600 underline">support@resortpro.site</a>.
      </P>
    </LegalPage>
  );
}
