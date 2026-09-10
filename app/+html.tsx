import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#a0522d" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Practice Room" />
        <link rel="manifest" href="/manifest.webmanifest?v=20260910" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=20260910" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
