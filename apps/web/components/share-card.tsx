import { ImageResponse } from 'next/og';

/**
 * The picture a link shows when it is shared.
 *
 * One layout for every page that has one: the House's dark ground, the
 * lamp, an eyebrow naming where the thing lives, the title large, and
 * the cover on the right when there is real artwork. Drawn on demand,
 * cached by the platform, and it takes no fonts of its own — the
 * renderer's serif is close enough at this size, and fetching webfonts
 * on every share is a cost with no reader on the other end.
 */
export const SHARE_SIZE = { width: 1200, height: 630 };
export const SHARE_TYPE = 'image/png';

export function shareCard(opts: {
  eyebrow: string;
  title: string;
  subtitle?: string | null;
  cover?: string | null;
  footer?: string;
}) {
  const title = opts.title.length > 70 ? `${opts.title.slice(0, 67)}…` : opts.title;
  const size = title.length > 40 ? 64 : 80;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: '#0B0B0B',
          color: '#F4ECDC',
          position: 'relative',
          fontFamily: 'Georgia, "Times New Roman", serif',
        }}
      >
        {/* The lamp. */}
        <div
          style={{
            position: 'absolute',
            left: 160,
            top: -260,
            width: 880,
            height: 560,
            borderRadius: 9999,
            background: 'radial-gradient(ellipse at center, rgba(200,149,40,0.30) 0%, rgba(200,149,40,0) 70%)',
          }}
        />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '72px 80px',
            width: opts.cover ? 800 : 1200,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: '#C89528', fontSize: 22, letterSpacing: 6, textTransform: 'uppercase' }}>
            <span>✦</span>
            <span>{opts.eyebrow}</span>
          </div>
          <div style={{ marginTop: 28, fontSize: size, lineHeight: 1.08, fontWeight: 400 }}>{title}</div>
          {opts.subtitle && (
            <div style={{ marginTop: 22, fontSize: 30, lineHeight: 1.3, color: '#8A8A8A', fontStyle: 'italic' }}>
              {opts.subtitle.length > 120 ? `${opts.subtitle.slice(0, 117)}…` : opts.subtitle}
            </div>
          )}
          <div style={{ marginTop: 'auto', paddingTop: 32, fontSize: 24, color: '#8A8A8A', letterSpacing: 2 }}>
            {opts.footer ?? 'Soulfables — every soul has a story'}
          </div>
        </div>

        {opts.cover && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 400 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={opts.cover}
              alt=""
              width={280}
              height={420}
              style={{ objectFit: 'cover', boxShadow: '0 30px 80px rgba(0,0,0,0.9)', border: '1px solid rgba(244,236,220,0.12)' }}
            />
          </div>
        )}
      </div>
    ),
    SHARE_SIZE,
  );
}
