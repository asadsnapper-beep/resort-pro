/**
 * Make an already-seeded demo tenant safe, without reseeding it.
 *
 * `9410d62` moved the demo guests off gmail.com/yahoo.com/outlook.com and gave
 * them birthdays, but a deploy ships code, not data — an environment seeded
 * before that commit still holds eighteen plausible real addresses, all of
 * them counted as subscribed because the seed writes no EmailConsent rows. One
 * press of "Send Now" there mails a resort promotion to eighteen strangers the
 * day RESEND_API_KEY is configured.
 *
 * The obvious fix — rerun `seed:demo` — is the wrong one. Seventeen entity
 * types in that file use `create`, not `upsert`: bookings, campaigns, expenses,
 * menu items, tickets, housekeeping tasks. A second run roughly doubles the
 * demo's data, so occupancy and revenue stop meaning anything. Hence this,
 * which touches guests and one booking and nothing else.
 *
 * Idempotent and additive: run it twice and the second run reports no work.
 * It deletes nothing.
 *
 *   DATABASE_URL=… npx tsx prisma/fix-demo-guests.ts          # report only
 *   DATABASE_URL=… npx tsx prisma/fix-demo-guests.ts --apply  # make changes
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const DEMO_SLUG = 'palm-paradise-resort';

/** Local part → the birthday the seed now defines for that guest. */
const BIRTHDAYS: Record<string, [number, number, number] | 'today'> = {
  'ahmed.rahman': [1985, 3, 14],
  'fatima.begum': [1990, 7, 2],
  'tanvir.ahmed': [1978, 11, 23],
  'nasreen.k': [1982, 1, 9],
  'rafiq.islam': 'today',
  'priya.sharma': [1995, 5, 30],
  'david.chen': [1973, 9, 17],
  'sarah.j': [1991, 2, 11],
  'omar.abdl': [1968, 12, 5],
  'mia.tanaka': [1997, 4, 21],
  'kabir.h': [1980, 6, 8],
  'ritu.das': [1993, 10, 2],
  'james.w': [1975, 8, 19],
  'ayesha.s': [1989, 1, 27],
  'sumon.b': [1965, 5, 3],
  'nila.c': [1998, 3, 25],
  'rashed.m': [1986, 12, 14],
  'tasneem.a': [1992, 9, 6],
  'shireen.k': [1983, 6, 12],
};

const dob = (spec: [number, number, number] | 'today'): Date => {
  if (spec === 'today') {
    const n = new Date();
    return new Date(Date.UTC(1988, n.getMonth(), n.getDate(), 12));
  }
  return new Date(Date.UTC(spec[0], spec[1] - 1, spec[2], 12));
};

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: DEMO_SLUG }, select: { id: true, name: true },
  });
  if (!tenant) {
    console.log(`No tenant with slug "${DEMO_SLUG}". Nothing to do.`);
    return;
  }
  const tenantId = tenant.id;
  console.log(`Tenant: ${tenant.name} (${DEMO_SLUG})`);
  console.log(APPLY ? 'Mode: APPLY\n' : 'Mode: report only — pass --apply to change anything\n');

  const guests = await prisma.guest.findMany({
    where: { tenantId },
    select: { id: true, email: true, firstName: true, dateOfBirth: true },
  });

  // ── 1. Addresses that can receive mail ──────────────────────────────────
  const deliverable = guests.filter((g) => !g.email.endsWith('@example.com'));
  console.log(`Guests: ${guests.length}. On a deliverable domain: ${deliverable.length}`);
  for (const g of deliverable) console.log(`  ${g.email}`);

  let repointed = 0;
  let collided = 0;
  if (APPLY) {
    for (const g of deliverable) {
      const target = `${g.email.split('@')[0]}@example.com`;
      // Someone else already holding the target is the one case this cannot
      // resolve on its own — (tenantId, email) is unique. Report, do not guess.
      const taken = guests.find((o) => o.id !== g.id && o.email === target);
      if (taken) {
        console.log(`  ! ${g.email} -> ${target} blocked: already held by ${taken.firstName}`);
        collided += 1;
        continue;
      }
      await prisma.guest.update({ where: { id: g.id }, data: { email: target } });
      repointed += 1;
    }
  }

  // ── 2. Birthdays ────────────────────────────────────────────────────────
  const noDob = guests.filter((g) => !g.dateOfBirth);
  console.log(`\nWithout a dateOfBirth: ${noDob.length}`);

  let dated = 0;
  let unknown = 0;
  if (APPLY) {
    for (const g of noDob) {
      // Re-read: step 1 may have changed this guest's address.
      const current = await prisma.guest.findUnique({ where: { id: g.id }, select: { email: true } });
      const local = (current?.email ?? g.email).split('@')[0];
      const spec = BIRTHDAYS[local];
      if (!spec) { unknown += 1; continue; }
      await prisma.guest.update({ where: { id: g.id }, data: { dateOfBirth: dob(spec) } });
      dated += 1;
    }
  }

  // ── 3. Somebody for the anniversary trigger ─────────────────────────────
  // It wants a first checkout 355–375 days ago and nothing in the last 60.
  // Every originally-seeded guest has a stay inside that 60 days, so none of
  // them can ever qualify; without this guest the trigger has no candidate.
  const anniversaryEmail = 'shireen.k@example.com';
  const existing = await prisma.guest.findFirst({
    where: { tenantId, email: anniversaryEmail }, select: { id: true },
  });
  // Her stay is checked separately from her existence. The first version of
  // this script created the guest and then failed on the booking, because
  // Booking.confirmationNo is required and I had left it out — which left a
  // guest with no stay, who is then a permanent non-candidate and just
  // clutter. So: the pair goes in one transaction, and a guest who is already
  // there but has no stay still gets one.
  const stay = existing
    ? await prisma.booking.findFirst({ where: { tenantId, guestId: existing.id }, select: { id: true } })
    : null;
  console.log(`\nAnniversary candidate (${anniversaryEmail}): ${existing ? 'present' : 'missing'}`
    + `${existing ? `, year-old stay: ${stay ? 'present' : 'missing'}` : ''}`);

  let addedGuest = false;
  let addedBooking = false;
  if (APPLY && !(existing && stay)) {
    const room = await prisma.room.findFirst({ where: { tenantId }, select: { id: true } });
    if (!room) {
      console.log('  ! no rooms on this tenant — skipped');
    } else {
      const out = new Date(); out.setDate(out.getDate() - 365); out.setHours(12, 0, 0, 0);
      const inn = new Date(); inn.setDate(inn.getDate() - 368); inn.setHours(12, 0, 0, 0);
      const confirmationNo = `PPR-${out.getFullYear()}-ANNIV1`;

      await prisma.$transaction(async (tx) => {
        const guestId = existing?.id ?? (await tx.guest.create({
          data: {
            tenantId, firstName: 'Shireen', lastName: 'Kabir',
            email: anniversaryEmail, phone: '+8801711111019',
            nationality: 'Bangladeshi',
            notes: 'Stayed once last year — anniversary candidate',
            dateOfBirth: dob(BIRTHDAYS['shireen.k'] as [number, number, number]),
          },
        })).id;
        addedGuest = !existing;

        await tx.booking.create({
          data: {
            tenantId, roomId: room.id, guestId, confirmationNo,
            checkIn: inn, checkOut: out,
            status: 'CHECKED_OUT', paymentStatus: 'PAID',
            adults: 2, children: 0, totalAmount: 9500, paidAmount: 9500,
            actualCheckIn: inn, actualCheckOut: out, source: 'ONLINE',
          },
        });
        addedBooking = true;
      });
    }
  }

  if (!APPLY) {
    console.log('\nNothing was changed. Re-run with --apply to act on the above.');
    return;
  }

  console.log('\n─── done ───');
  console.log(`  addresses re-pointed : ${repointed}${collided ? ` (${collided} blocked)` : ''}`);
  console.log(`  birthdays filled in  : ${dated}${unknown ? ` (${unknown} not in the list, left alone)` : ''}`);
  console.log(`  anniversary guest    : ${addedGuest ? 'created' : 'already present'}`);
  console.log(`  her year-old stay    : ${addedBooking ? 'created' : 'not needed'}`);

  const after = await prisma.guest.findMany({
    where: { tenantId }, select: { email: true, dateOfBirth: true },
  });
  const stillDeliverable = after.filter((g) => !g.email.endsWith('@example.com'));
  console.log(`\n  guests now           : ${after.length}`);
  console.log(`  with a birthday      : ${after.filter((g) => g.dateOfBirth).length}`);
  console.log(`  still deliverable    : ${stillDeliverable.length}`);
  for (const g of stillDeliverable) console.log(`    ${g.email}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
