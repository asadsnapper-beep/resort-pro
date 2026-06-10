/**
 * Phase 2 & 3 Gateway Stubs
 * এগুলো এখন implement হয়নি — UI-তে "Coming Soon" দেখাবে
 * তৈরি হলে আলাদা file-এ full implementation আসবে
 */

import { StubGateway } from './base.js';

export const MidtransGateway = new StubGateway({
  id: 'midtrans',
  name: 'Midtrans',
  logo: '🇮🇩',
  countries: ['ID'],
  methods: ['card', 'wallet'],
  status: 'coming_soon',
  testMode: true,
  redirectFlow: true,
  credentialFields: [
    { key: 'serverKey',   label: 'Server Key',   type: 'password', required: true },
    { key: 'clientKey',   label: 'Client Key',   type: 'text',     required: true },
  ],
});

export const OmiseGateway = new StubGateway({
  id: 'omise',
  name: 'Omise (Opn)',
  logo: '🇹🇭',
  countries: ['TH'],
  methods: ['card', 'wallet'],
  status: 'coming_soon',
  testMode: true,
  redirectFlow: false,
  credentialFields: [
    { key: 'publicKey',  label: 'Public Key',  type: 'text',     required: true },
    { key: 'secretKey',  label: 'Secret Key',  type: 'password', required: true },
  ],
});

export const IPay88Gateway = new StubGateway({
  id: 'ipay88',
  name: 'iPay88',
  logo: '🇲🇾',
  countries: ['MY'],
  methods: ['card', 'net_banking'],
  status: 'coming_soon',
  testMode: true,
  redirectFlow: true,
  credentialFields: [
    { key: 'merchantCode', label: 'Merchant Code', type: 'text',     required: true },
    { key: 'merchantKey',  label: 'Merchant Key',  type: 'password', required: true },
  ],
});

export const MpesaGateway = new StubGateway({
  id: 'mpesa',
  name: 'M-Pesa',
  logo: '🇰🇪',
  countries: ['KE', 'TZ'],
  methods: ['mobile_banking'],
  status: 'coming_soon',
  testMode: true,
  redirectFlow: false,
  credentialFields: [
    { key: 'consumerKey',    label: 'Consumer Key',    type: 'text',     required: true },
    { key: 'consumerSecret', label: 'Consumer Secret', type: 'password', required: true },
    { key: 'shortcode',      label: 'Shortcode',       type: 'text',     required: true },
    { key: 'passkey',        label: 'Passkey',         type: 'password', required: true },
  ],
});

export const FlutterwaveGateway = new StubGateway({
  id: 'flutterwave',
  name: 'Flutterwave',
  logo: '🌍',
  countries: ['NG', 'GH', 'KE', 'ZA'],
  methods: ['card', 'mobile_banking', 'wallet'],
  status: 'coming_soon',
  testMode: true,
  redirectFlow: true,
  credentialFields: [
    { key: 'publicKey',  label: 'Public Key',  type: 'text',     required: true },
    { key: 'secretKey',  label: 'Secret Key',  type: 'password', required: true },
    { key: 'encryptKey', label: 'Encrypt Key', type: 'password', required: true },
  ],
});

export const PaystackGateway = new StubGateway({
  id: 'paystack',
  name: 'Paystack',
  logo: '🇳🇬',
  countries: ['NG', 'GH'],
  methods: ['card', 'mobile_banking'],
  status: 'coming_soon',
  testMode: true,
  redirectFlow: true,
  credentialFields: [
    { key: 'publicKey',  label: 'Public Key',  type: 'text',     required: true },
    { key: 'secretKey',  label: 'Secret Key',  type: 'password', required: true },
  ],
});
