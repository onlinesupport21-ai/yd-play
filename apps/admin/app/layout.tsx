import './globals.css';

export const metadata = {
  title: 'YD Play Admin',
  description: 'Operations console for YD Play virtual-coin gaming platform'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
