'use client';

import { BsPalette } from 'react-icons/bs';
import ForgotPasswordFlow from '@/app/_components/shared/ForgotPasswordFlow';

export default function DesignerForgotPassword() {
  return (
    <ForgotPasswordFlow
      role="designer"
      portalName="Designer"
      icon={BsPalette}
      loginHref="/designer/login"
      titleClassName="text-foreground"
      linkClassName="text-foreground"
    />
  );
}
