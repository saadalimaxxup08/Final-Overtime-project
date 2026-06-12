import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const outfit = Outfit({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Overtime Tracker Pro - Premium Employee Clocking',
  description: 'High-performance glassmorphic overtime logger and check-in system for modern enterprise workspaces.',
  icons: {
    icon: [
      { url: '/favicon.ico?v=3', sizes: 'any' },
    ],
    apple: '/apple-touch-icon.png', // optional, future ke liye
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} dark h-full antialiased`}>
      <body className="min-h-full flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}