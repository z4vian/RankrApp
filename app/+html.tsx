import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';
export default function Root({ children }: PropsWithChildren) {
  return <html lang="en"><head><meta charSet="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="referrer" content="strict-origin-when-cross-origin" /><link rel="icon" type="image/svg+xml" href="/rankr-icon.svg" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <meta property="og:image" content="https://rankr-app.vercel.app/rankr-icon-512.png" />
    <meta property="og:image:width" content="512" /><meta property="og:image:height" content="512" />
    <meta property="og:image:alt" content="Rankr’s purple ranking bars on charcoal" />
    <ScrollViewStyleReset /><style>{`
    @font-face{font-family:Rankr Inter;src:url('/fonts/inter-latin-400-normal.woff2') format('woff2');font-weight:400;font-display:swap}
    @font-face{font-family:Rankr Inter;src:url('/fonts/inter-latin-600-normal.woff2') format('woff2');font-weight:500 700;font-display:swap}
    @font-face{font-family:Rankr Inter;src:url('/fonts/inter-latin-800-normal.woff2') format('woff2');font-weight:800 900;font-display:swap}
    html,body{background:#14181c;color:#f4f4f6;color-scheme:dark;font-family:Rankr Inter,Arial,sans-serif}
    #root div:not([style*="font-family"]),#root input,#root textarea{font-family:Rankr Inter,Arial,sans-serif}
    ::selection{background:#30263e;color:#f4f4f6}
    [role=button],[role=link]{touch-action:manipulation}
    [role=button]:hover{filter:brightness(1.08)}
    [aria-disabled=true]{opacity:.5}
    input{min-width:0}
    :focus-visible{outline:3px solid #bdadff!important;outline-offset:4px!important}
    input,textarea{caret-color:#bdadff}
    @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}
  `}</style></head><body>{children}</body></html>;
}
