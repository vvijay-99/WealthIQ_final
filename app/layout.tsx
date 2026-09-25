import './globals.css';
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { NotificationProvider } from '@/lib/notification-context';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' });

export const metadata: Metadata = {
  title: 'WealthIQ — Understand Your Financial Health',
  description:
    'WealthIQ analyzes your income, expenses, savings, debt, and investments to produce a Financial Health Score, spending risk classification, forecasts, and personalized recommendations.',
  openGraph: {
    title: 'WealthIQ — Understand Your Financial Health',
    description:
      'AI-powered personal financial health analysis with ML classification, forecasting, and personalized recommendations.',
    images: [
      {
        url: 'https://bolt.new/static/og_default.png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: [
      {
        url: 'https://bolt.new/static/og_default.png',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="font-sans antialiased">
        <AuthProvider>
          <NotificationProvider>{children}</NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
