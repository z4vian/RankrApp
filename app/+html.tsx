import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';
export default function Root({ children }: PropsWithChildren) {
  return <html lang="en"><head><meta charSet="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="referrer" content="strict-origin-when-cross-origin" /><ScrollViewStyleReset /><style>{`
    html,body{background:#0f0f13;color:#fff}
    :focus-visible{outline:3px solid #d3ef8a!important;outline-offset:4px!important}
    input,textarea{caret-color:#d3ef8a}
    @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}
  `}</style></head><body>{children}</body></html>;
}
