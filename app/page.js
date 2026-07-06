import Link from 'next/link';
import { BsPersonBadge, BsPalette, BsArrowRight } from 'react-icons/bs';
import { Card } from '@/app/_components/ui/card';

const ROLES = [
  {
    href: '/doctor',
    icon: BsPersonBadge,
    title: 'Doctor',
    description: 'Submit and track your patient cases.',
  },
  {
    href: '/designer',
    icon: BsPalette,
    title: 'Designer',
    description: 'Pick up cases and deliver finished setups.',
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#f8f9ff_0%,#e8ecff_100%)] px-4">
      <div className="w-full max-w-[640px] text-center">
        <h1 className="mb-2 text-2xl font-bold text-foreground">What profession suits you?</h1>
        <p className="mb-8 text-sm text-muted-foreground">ClearTrackings ClearAligner Case Tracking</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ROLES.map(({ href, icon: Icon, title, description }) => (
            <Link key={href} href={href} className="no-underline">
              <Card className="h-full items-center gap-3 rounded-2xl border-0 p-6 text-center shadow-lg transition-transform hover:-translate-y-1 hover:shadow-xl">
                <div className="mb-1 inline-flex size-16 items-center justify-center self-center rounded-full bg-[linear-gradient(135deg,var(--color-brand-start),var(--color-brand-end))]">
                  <Icon className="text-2xl text-white" />
                </div>
                <h2 className="text-lg font-bold text-foreground">{title}</h2>
                <p className="text-sm text-muted-foreground">{description}</p>
                <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                  Continue as {title} <BsArrowRight />
                </span>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
