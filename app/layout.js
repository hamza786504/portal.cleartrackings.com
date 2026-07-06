import { Jost } from 'next/font/google';
import { TooltipProvider } from '@/app/_components/ui/tooltip';
import './globals.css';

const jost = Jost({
  variable: '--font-jost',
  subsets: ['latin'],
});

export const metadata = {
  title: 'ClearTrackings',
  description: 'Doctor and designer portals for managing orthodontic cases on ClearTrackings.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={jost.variable}>
      <body>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
