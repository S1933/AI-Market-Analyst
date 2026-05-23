import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Market Analyst — Multi-Agent Financial Intelligence',
  description:
    'AI-powered financial market analysis platform. Powered by 4 specialized agents: Market Technical, News Fundamental, Risk Assessment, and Strategy Synthesis.',
  keywords: [
    'market analysis',
    'AI trading',
    'financial intelligence',
    'technical analysis',
    'multi-agent',
    'stock analysis',
    'crypto analysis',
    'risk management',
  ],
  authors: [{ name: 'Hermes Agent System' }],
  openGraph: {
    title: 'AI Market Analyst',
    description: 'Multi-agent financial market intelligence platform',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0c10',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.cdnfonts.com/css/jetbrains-mono-2"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
