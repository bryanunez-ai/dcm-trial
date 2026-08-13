import { ImageResponse } from 'next/og';

/**
 * The Open Graph card, generated rather than shipped as a binary.
 *
 * Drawn with the brand tokens so it cannot drift out of step with the site the way a
 * hand-exported PNG would, and so there is no image file to forget to update.
 */
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Nova Analytics — cookieless web analytics with an AI advisor';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 80,
          background: 'linear-gradient(135deg, #ffffff 0%, #f4f1fe 55%, #e9e2fd 100%)',
          fontFamily: 'sans-serif'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 1.5 13.9 8.1 20.5 10 13.9 11.9 12 18.5 10.1 11.9 3.5 10 10.1 8.1 12 1.5Z"
              fill="#6d3ef2"
            />
            <rect x="3.5" y="18" width="4" height="4.5" rx="1" fill="#6d3ef2" opacity="0.45" />
            <rect x="10" y="15.5" width="4" height="7" rx="1" fill="#6d3ef2" opacity="0.7" />
            <rect x="16.5" y="12.5" width="4" height="10" rx="1" fill="#6d3ef2" />
          </svg>
          <div style={{ fontSize: 40, fontWeight: 600, color: '#0b0a12' }}>
            Nova Analytics
          </div>
        </div>

        <div
          style={{
            marginTop: 40,
            fontSize: 68,
            fontWeight: 700,
            lineHeight: 1.1,
            color: '#0b0a12',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <span>Web analytics without</span>
          <span style={{ color: '#6d3ef2' }}>the cookie banner</span>
        </div>

        <div style={{ marginTop: 32, fontSize: 28, color: '#4b4658' }}>
          One line of script. No cookies. An advisor that shows its evidence.
        </div>
      </div>
    ),
    size
  );
}
