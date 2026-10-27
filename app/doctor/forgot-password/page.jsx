'use client';

import { BsPersonBadge } from 'react-icons/bs';
import ForgotPasswordFlow from '@/app/_components/shared/ForgotPasswordFlow';

export default function DoctorForgotPassword() {
  return (
    <ForgotPasswordFlow
      role="doctor"
      portalName="Doctor"
      icon={BsPersonBadge}
      loginHref="/doctor/login"
    />
  );
}
