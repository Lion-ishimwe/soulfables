import 'server-only';
import { createAdminClient } from './supabase/admin';

/**
 * Transactional email.
 *
 * Every send is recorded in `email_events` before it is attempted, so
 * "did the customer get their book?" is answerable from the database
 * rather than from a provider's dashboard that a future developer may not
 * have access to.
 *
 * When no provider is configured the message is logged and recorded with
 * status 'skipped'. That is deliberate: a missing email provider must
 * never fail a webhook and roll back an entitlement the customer has
 * already paid for. The book appears in their library either way.
 */

type SendResult = { sent: boolean; error?: string; messageId?: string; skipped?: boolean };

// A value pasted into Parameter Store with its own quotes arrives here
// still wearing them, and a sender wearing quotes is refused by the
// provider. They are taken off.
const FROM = (process.env.EMAIL_FROM ?? 'Soulfables <hello@soulfables.co>').trim().replace(/^["']+|["']+$/g, '');
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://soulfables.co';

async function record(
  template: string,
  to: string,
  status: string,
  opts: { orderId?: string; userId?: string; messageId?: string; error?: string } = {},
) {
  try {
    const db = createAdminClient();
    const { error } = await db.from('email_events').insert({
      to_email: to,
      user_id: opts.userId ?? null,
      template,
      order_id: opts.orderId ?? null,
      provider: process.env.EMAIL_PROVIDER_API_KEY ? 'resend' : null,
      provider_message_id: opts.messageId ?? null,
      status,
      error: opts.error ?? null,
    });
    if (error) console.error('[email] could not record send', error.message);
  } catch (e) {
    console.error('[email] could not record send', e);
  }
}

async function deliver(
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<SendResult> {
  const key = process.env.EMAIL_PROVIDER_API_KEY;

  if (!key) {
    console.info(`[email] no provider configured — would send "${subject}" to ${to}`);
    return { sent: false, skipped: true, error: 'no_provider' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM, to, subject, html, text }),
    });

    if (!res.ok) {
      return { sent: false, error: `${res.status} ${await res.text()}` };
    }

    const body = (await res.json()) as { id?: string };
    return { sent: true, messageId: body.id };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}

/** Shared shell so every email looks like it came from the same House. */
function shell(heading: string, body: string, cta?: { url: string; label: string }) {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#0B0B0B;color:#CFCFCF;font-family:Georgia,serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0B0B0B">
    <tr><td align="center" style="padding:48px 20px">
      <table role="presentation" width="100%" style="max-width:520px" cellpadding="0" cellspacing="0">
        <tr><td style="padding-bottom:28px">
          <span style="color:#C89528;font-size:15px">&#10022;</span>
          <div style="color:#F4ECDC;font-size:22px;margin-top:10px">Soulfables</div>
        </td></tr>
        <tr><td style="border-top:1px solid rgba(244,236,220,0.12);padding-top:28px">
          <h1 style="color:#F4ECDC;font-size:26px;font-weight:normal;margin:0 0 18px">${heading}</h1>
          <div style="font-size:15px;line-height:1.7">${body}</div>
        </td></tr>
        ${
          cta
            ? `<tr><td style="padding-top:28px">
                 <a href="${cta.url}" style="display:inline-block;border:1px solid rgba(200,149,40,0.5);color:#C89528;text-decoration:none;padding:14px 28px;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase">${cta.label}</a>
               </td></tr>`
            : ''
        }
        <tr><td style="padding-top:36px;border-top:1px solid rgba(244,236,220,0.12);margin-top:32px">
          <p style="color:#8A8A8A;font-size:12px;line-height:1.6;margin:24px 0 0">
            Every Soul Has a Story.<br>
            <a href="${SITE}" style="color:#8A8A8A">soulfables.co</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export async function sendDeliveryEmail(opts: {
  to: string;
  orderReference: string;
  /** The order row, when there is one. A manual grant has none. */
  orderId?: string;
  isGuest: boolean;
  /** What was paid, already formatted, for the receipt line. */
  amountLabel?: string;
}): Promise<SendResult> {
  const subject = `Your Soulfables order ${opts.orderReference}`;
  const receiptLine = opts.orderId
    ? `<p style="color:#8A8A8A;font-size:13px">Order ${opts.orderReference}${opts.amountLabel ? ` · ${opts.amountLabel}` : ''} · <a href="${SITE}/account/orders/${encodeURIComponent(opts.orderReference)}" style="color:#C89528">receipt</a></p>`
    : `<p style="color:#8A8A8A;font-size:13px">${opts.orderReference}</p>`;

  // A guest buyer has no account yet, so there is no library to link to.
  // Telling them to sign up with this exact address is what turns their
  // order into entitlements.
  const body = opts.isGuest
    ? `<p>Thank you — your payment came through.</p>
       <p>Create an account using <strong>this same email address</strong> and everything you have bought will be waiting in your library, in every format it ships in.</p>
       ${receiptLine}`
    : `<p>Thank you — your payment came through.</p>
       <p>Your book is in your library now, in every format it ships in. It stays there; you can come back for it whenever you like.</p>
       ${receiptLine}`;

  const cta = opts.isGuest
    ? { url: `${SITE}/signup`, label: 'Create your account' }
    : { url: `${SITE}/account/library`, label: 'Open your library' };

  const text = opts.isGuest
    ? `Thank you — your payment came through.\n\nCreate an account using this same email address and everything you have bought will be waiting in your library.\n\n${SITE}/signup\n\nOrder ${opts.orderReference}`
    : `Thank you — your payment came through.\n\nYour book is in your library now.\n\n${SITE}/account/library\n\nOrder ${opts.orderReference}`;

  const result = await deliver(opts.to, subject, shell('Your book is ready.', body, cta), text);

  await record('delivery', opts.to, result.sent ? 'sent' : result.skipped ? 'skipped' : 'failed', {
    orderId: opts.orderId,
    messageId: result.messageId,
    error: result.sent ? undefined : result.error,
  });

  return result;
}

export async function sendWelcomeEmail(to: string, userId: string): Promise<SendResult> {
  const result = await deliver(
    to,
    'Welcome to Soulfables',
    shell(
      'Come in.',
      `<p>The library is open. Thirty-two folktales, arranged by feeling rather than by genre — start wherever your heart is.</p>
       <p>Anything you save, and anything you write in your journal, is yours and private.</p>`,
      { url: `${SITE}/library`, label: 'Enter the library' },
    ),
    `The library is open.\n\n${SITE}/library`,
  );

  await record('welcome', to, result.sent ? 'sent' : result.skipped ? 'skipped' : 'failed', {
    userId,
    messageId: result.messageId,
    error: result.sent ? undefined : result.error,
  });

  return result;
}

/** Whether the House can write. The pages that promise an email check this first. */
export function emailConfigured(): boolean {
  return Boolean(process.env.EMAIL_PROVIDER_API_KEY);
}

/**
 * A writer's invitation.
 *
 * Carries a link that lets them set their own password, made by the
 * auth service for this address and this address only, rather than a
 * temporary password in the body of an email. The temporary password
 * is still shown on screen to whoever invited them, for the day the
 * email does not arrive.
 */
export async function sendInvitationEmail(opts: {
  to: string;
  name: string;
  invitedBy: string | null;
  setPasswordUrl: string | null;
}): Promise<SendResult> {
  const subject = 'You have a desk at Soulfables';
  const who = opts.invitedBy ? `${opts.invitedBy} has` : 'The House has';
  const body = `<p>${who} given you a place to write in the Writing Room.</p>
     <p>${opts.setPasswordUrl ? 'Choose a password with the button below, and your desk is ready.' : 'Sign in with the address this was sent to and the password you were given, then change it under Account.'}</p>
     <p>Anything you write comes to the House before it goes out, and you will hear back either way.</p>`;
  const cta = opts.setPasswordUrl
    ? { url: opts.setPasswordUrl, label: 'Choose a password' }
    : { url: `${SITE}/signin`, label: 'Sign in' };
  const text = `${who} given you a place to write in the Writing Room.\n\n${opts.setPasswordUrl ?? `${SITE}/signin`}`;

  const result = await deliver(opts.to, subject, shell('Come in and write.', body, cta), text);
  await record('invitation', opts.to, result.sent ? 'sent' : result.skipped ? 'skipped' : 'failed', {
    messageId: result.messageId,
    error: result.sent ? undefined : result.error,
  });
  return result;
}

/** The letter's confirmation: one link, and the address is on the list. */
export async function sendLetterConfirmation(to: string, token: string): Promise<SendResult> {
  const url = `${SITE}/letter/confirm?token=${encodeURIComponent(token)}`;
  const result = await deliver(
    to,
    'One more step for the weekly letter',
    shell(
      'Is this you?',
      `<p>Somebody — we hope you — asked for the weekly letter at this address.</p>
       <p>Confirm with the button and the next letter will find you. If it was not you, do nothing and nothing will arrive.</p>`,
      { url, label: 'Yes, that was me' },
    ),
    `Confirm the weekly letter: ${url}`,
  );
  await record('letter_confirm', to, result.sent ? 'sent' : result.skipped ? 'skipped' : 'failed', {
    messageId: result.messageId,
    error: result.sent ? undefined : result.error,
  });
  return result;
}

const escapeHtml = (t: string) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c);

/** The shop desk learns a reader has asked for a refund. */
export async function sendRefundRequestEmail(opts: {
  to: string;
  orderReference: string;
  orderId: string;
  buyer: string;
  items: string[];
  amountLabel: string;
  reason: string;
  message: string;
  daysSincePaid: number;
  downloads: number;
}): Promise<SendResult> {
  const subject = `Refund asked: ${opts.orderReference} · ${opts.amountLabel}`;
  const what = opts.items.join(', ') || 'an order';
  const days = `${opts.daysSincePaid} day${opts.daysSincePaid === 1 ? '' : 's'} ago`;
  const body = `<p>${escapeHtml(opts.buyer)} asks for a refund on <strong>${escapeHtml(what)}</strong>, ${escapeHtml(opts.amountLabel)}, paid ${days}.</p>
    <p><strong>${escapeHtml(opts.reason)}.</strong>${opts.message ? ` &ldquo;${escapeHtml(opts.message)}&rdquo;` : ''}</p>
    <p style="color:#8A8A8A;font-size:13px">Files downloaded: ${opts.downloads}. Order ${escapeHtml(opts.orderReference)}.</p>`;
  const text = `${opts.buyer} asks for a refund on ${what}, ${opts.amountLabel}, paid ${days}.\n\n${opts.reason}.${opts.message ? ` "${opts.message}"` : ''}\n\nFiles downloaded: ${opts.downloads}. Order ${opts.orderReference}.\n\n${SITE}/admin/refunds`;
  const result = await deliver(
    opts.to,
    subject,
    shell('A refund is asked for.', body, { url: `${SITE}/admin/refunds`, label: 'Open the refund desk' }),
    text,
  );
  await record('refund_request', opts.to, result.sent ? 'sent' : result.skipped ? 'skipped' : 'failed', {
    orderId: opts.orderId,
    messageId: result.messageId,
    error: result.sent ? undefined : result.error,
  });
  return result;
}

/** The reader hears the decision. */
export async function sendRefundDecisionEmail(opts: {
  to: string;
  orderReference: string;
  orderId: string;
  refunded: boolean;
  amountLabel: string;
  note: string;
}): Promise<SendResult> {
  const receipt = `${SITE}/account/orders/${encodeURIComponent(opts.orderReference)}`;
  const subject = opts.refunded ? `Refunded: ${opts.orderReference}` : `About your refund request, ${opts.orderReference}`;
  const body = opts.refunded
    ? `<p>${escapeHtml(opts.amountLabel)} is on its way back to the way you paid. It usually shows within five to ten days, depending on your bank.</p>
       <p>The book has left your library. If you ever want it again, it will be in the Bookshop.</p>
       ${opts.note ? `<p>&ldquo;${escapeHtml(opts.note)}&rdquo;</p>` : ''}
       <p style="color:#8A8A8A;font-size:13px">Order ${escapeHtml(opts.orderReference)} &middot; <a href="${receipt}" style="color:#C89528">refund receipt</a></p>`
    : `<p>We read your request about order ${escapeHtml(opts.orderReference)} and cannot refund it this time.</p>
       <p>&ldquo;${escapeHtml(opts.note)}&rdquo;</p>
       <p>If there is something we have missed, reply to this email and a person will read it.</p>`;
  const text = opts.refunded
    ? `${opts.amountLabel} is on its way back to the way you paid. It usually shows within five to ten days.\n\nThe book has left your library.\n${opts.note ? `\n"${opts.note}"\n` : ''}\nOrder ${opts.orderReference}\n${receipt}`
    : `We read your request about order ${opts.orderReference} and cannot refund it this time.\n\n"${opts.note}"\n\nIf there is something we have missed, reply to this email and a person will read it.`;
  const result = await deliver(
    opts.to,
    subject,
    shell(opts.refunded ? 'Your money is on its way back.' : 'About your request.', body, { url: receipt, label: 'See the receipt' }),
    text,
  );
  await record(opts.refunded ? 'refund_granted' : 'refund_declined', opts.to, result.sent ? 'sent' : result.skipped ? 'skipped' : 'failed', {
    orderId: opts.orderId,
    messageId: result.messageId,
    error: result.sent ? undefined : result.error,
  });
  return result;
}
