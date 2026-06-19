/**
 * ESC/POS receipt formatter for 80mm thermal printers (48 chars wide)
 * Also exports an HTML receipt for fallback browser printing.
 */

const WIDTH = 48;

function center(text: string): string {
  const pad = Math.max(0, Math.floor((WIDTH - text.length) / 2));
  return ' '.repeat(pad) + text;
}

function left(text: string, width = WIDTH): string {
  return text.slice(0, width).padEnd(width);
}

function leftRight(l: string, r: string): string {
  const maxL = WIDTH - r.length - 1;
  return l.slice(0, maxL).padEnd(maxL) + ' ' + r;
}

function divider(char = '-'): string {
  return char.repeat(WIDTH);
}

export interface ReceiptData {
  hotelName: string;
  hotelAddress?: string;
  hotelPhone?: string;
  confirmationNo: string;
  invoiceNumber?: string;
  guestName: string;
  guestPhone?: string;
  roomNumber: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  lineItems: {
    room: { description: string; amount: number };
    food: { description: string; quantity: number; amount: number }[];
    extras: { description: string; quantity: number; amount: number }[];
  };
  summary: {
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    grandTotal: number;
    paidAmount: number;
    balanceDue: number;
  };
  currency: string;
  printedAt?: string;
}

function fmt(amount: number, currency: string): string {
  return `${currency} ${amount.toFixed(2)}`;
}

// ESC/POS control bytes as escape sequences
const ESC = '\x1B';
const GS  = '\x1D';

const CMDS = {
  init:       `${ESC}@`,
  bold_on:    `${ESC}E\x01`,
  bold_off:   `${ESC}E\x00`,
  dbl_width:  `${ESC}!\x20`,
  normal:     `${ESC}!\x00`,
  align_c:    `${ESC}a\x01`,
  align_l:    `${ESC}a\x00`,
  align_r:    `${ESC}a\x02`,
  cut:        `${GS}V\x41\x03`,
  feed:       `${ESC}d\x04`,
  lf:         '\n',
};

/**
 * Returns an array of raw string segments for a QZ Tray print job.
 * Each entry maps to one `data` element.
 */
export function buildEscPosReceipt(r: ReceiptData): string[] {
  const c = r.currency;
  const lines: string[] = [];

  const push = (...parts: string[]) => lines.push(...parts);

  push(
    CMDS.init,
    // ── Header ──────────────────────────────────────────────────────────────
    CMDS.align_c,
    CMDS.bold_on + CMDS.dbl_width,
    r.hotelName + CMDS.lf,
    CMDS.normal + CMDS.bold_off,
  );

  if (r.hotelAddress) push(center(r.hotelAddress) + CMDS.lf);
  if (r.hotelPhone)   push(center(`Tel: ${r.hotelPhone}`) + CMDS.lf);

  push(
    CMDS.align_l,
    CMDS.lf,
    CMDS.bold_on + center('RECEIPT') + CMDS.bold_off + CMDS.lf,
    divider() + CMDS.lf,

    // ── Booking info ─────────────────────────────────────────────────────────
    leftRight('Confirmation:', r.confirmationNo) + CMDS.lf,
  );

  if (r.invoiceNumber) push(leftRight('Invoice No:', r.invoiceNumber) + CMDS.lf);

  push(
    leftRight('Guest:', r.guestName) + CMDS.lf,
    leftRight('Room:', `#${r.roomNumber} ${r.roomName}`) + CMDS.lf,
    leftRight('Check-in:', r.checkIn) + CMDS.lf,
    leftRight('Check-out:', r.checkOut) + CMDS.lf,
    leftRight('Nights:', String(r.nights)) + CMDS.lf,
    divider() + CMDS.lf,

    // ── Line items ───────────────────────────────────────────────────────────
    CMDS.bold_on + left('CHARGES') + CMDS.bold_off + CMDS.lf,
    leftRight(r.lineItems.room.description.slice(0, 34), fmt(r.lineItems.room.amount, c)) + CMDS.lf,
  );

  for (const item of r.lineItems.food) {
    const label = `  ${item.description.slice(0, 28)} x${item.quantity}`;
    push(leftRight(label, fmt(item.amount, c)) + CMDS.lf);
  }

  for (const extra of r.lineItems.extras) {
    const label = `  ${extra.description.slice(0, 28)} x${extra.quantity}`;
    push(leftRight(label, fmt(extra.amount, c)) + CMDS.lf);
  }

  push(
    divider() + CMDS.lf,

    // ── Summary ──────────────────────────────────────────────────────────────
    leftRight('Subtotal:', fmt(r.summary.subtotal, c)) + CMDS.lf,
  );

  if (r.summary.taxRate > 0) {
    push(leftRight(`Tax (${r.summary.taxRate}%):`, fmt(r.summary.taxAmount, c)) + CMDS.lf);
  }

  push(
    divider('=') + CMDS.lf,
    CMDS.bold_on + leftRight('TOTAL:', fmt(r.summary.grandTotal, c)) + CMDS.bold_off + CMDS.lf,
    leftRight('Paid:', fmt(r.summary.paidAmount, c)) + CMDS.lf,
  );

  if (r.summary.balanceDue > 0.009) {
    push(CMDS.bold_on + leftRight('Balance Due:', fmt(r.summary.balanceDue, c)) + CMDS.bold_off + CMDS.lf);
  } else {
    push(CMDS.bold_on + center('*** PAID IN FULL ***') + CMDS.bold_off + CMDS.lf);
  }

  push(
    divider() + CMDS.lf,
    CMDS.align_c,
    center('Thank you for your stay!') + CMDS.lf,
    center(r.printedAt ?? new Date().toLocaleString()) + CMDS.lf,
    CMDS.lf,
    CMDS.feed,
    CMDS.cut,
  );

  return lines;
}

/**
 * Builds an HTML string for browser window.print() fallback.
 */
export function buildHtmlReceipt(r: ReceiptData): string {
  const c = r.currency;

  const foodRows = r.lineItems.food
    .map(i => `<tr><td>${i.description} ×${i.quantity}</td><td class="right">${fmt(i.amount, c)}</td></tr>`)
    .join('');

  const extraRows = r.lineItems.extras
    .map(i => `<tr><td>${i.description} ×${i.quantity}</td><td class="right">${fmt(i.amount, c)}</td></tr>`)
    .join('');

  const taxRow = r.summary.taxRate > 0
    ? `<tr><td>Tax (${r.summary.taxRate}%)</td><td class="right">${fmt(r.summary.taxAmount, c)}</td></tr>`
    : '';

  const balanceRow = r.summary.balanceDue > 0.009
    ? `<tr class="bold red"><td>Balance Due</td><td class="right">${fmt(r.summary.balanceDue, c)}</td></tr>`
    : `<tr class="bold green"><td colspan="2" class="center">✓ PAID IN FULL</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Receipt — ${r.confirmationNo}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 11px; width: 72mm; margin: 0 auto; }
  h1 { font-size: 15px; text-align: center; margin: 4px 0 2px; }
  .sub { text-align: center; margin: 0; font-size: 10px; color: #555; }
  .divider { border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1px 2px; vertical-align: top; }
  .right { text-align: right; white-space: nowrap; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .green { color: #1a6b5e; }
  .red { color: #c0392b; }
  .total-row td { border-top: 1px solid #000; font-weight: bold; font-size: 13px; }
  .footer { text-align: center; margin-top: 8px; font-size: 10px; color: #555; }
</style>
</head>
<body>
<h1>${r.hotelName}</h1>
${r.hotelAddress ? `<p class="sub">${r.hotelAddress}</p>` : ''}
${r.hotelPhone   ? `<p class="sub">Tel: ${r.hotelPhone}</p>` : ''}
<div class="divider"></div>

<table>
  <tr><td>Confirmation</td><td class="right bold">${r.confirmationNo}</td></tr>
  ${r.invoiceNumber ? `<tr><td>Invoice No</td><td class="right">${r.invoiceNumber}</td></tr>` : ''}
  <tr><td>Guest</td><td class="right">${r.guestName}</td></tr>
  <tr><td>Room</td><td class="right">#${r.roomNumber} ${r.roomName}</td></tr>
  <tr><td>Check-in</td><td class="right">${r.checkIn}</td></tr>
  <tr><td>Check-out</td><td class="right">${r.checkOut}</td></tr>
  <tr><td>Nights</td><td class="right">${r.nights}</td></tr>
</table>

<div class="divider"></div>
<table>
  <tr class="bold"><td colspan="2">Charges</td></tr>
  <tr><td>${r.lineItems.room.description}</td><td class="right">${fmt(r.lineItems.room.amount, c)}</td></tr>
  ${foodRows}
  ${extraRows}
  <tr><td>Subtotal</td><td class="right">${fmt(r.summary.subtotal, c)}</td></tr>
  ${taxRow}
  <tr class="total-row"><td>TOTAL</td><td class="right">${fmt(r.summary.grandTotal, c)}</td></tr>
  <tr><td>Paid</td><td class="right">${fmt(r.summary.paidAmount, c)}</td></tr>
  ${balanceRow}
</table>

<div class="divider"></div>
<p class="footer">Thank you for your stay!<br/>${r.printedAt ?? new Date().toLocaleString()}</p>
</body>
</html>`;
}
