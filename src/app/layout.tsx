import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'for-music',
  description: 'Marketplace de músicos profissionais',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-zinc-950 text-zinc-100 antialiased min-h-screen">{children}</body>
    </html>
  );
}
