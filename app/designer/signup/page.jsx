'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BsPersonPlus, BsCheckCircleFill, BsExclamationTriangleFill } from 'react-icons/bs';
import { Card } from '@/app/_components/ui/card';
import { Input } from '@/app/_components/ui/input';
import { Label } from '@/app/_components/ui/label';
import { Textarea } from '@/app/_components/ui/textarea';
import { Button } from '@/app/_components/ui/button';
import { Alert, AlertDescription } from '@/app/_components/ui/alert';
import Spinner from '@/app/_components/shared/Spinner';
import PasswordInput from '@/app/_components/shared/PasswordInput';
import { cn } from '@/app/lib/utils';

export default function DesignerSignup() {
  const [formData, setFormData] = useState({
    designerName: '',
    businessName: '',
    contactNumber: '',
    contactEmail: '',
    password: '',
    confirmPassword: '',
    specialInstructions: '',
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
  };

  const validateForm = () => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[0-9+\-\s()]+$/;

    if (!formData.designerName.trim()) newErrors.designerName = 'Designer Name is required';
    if (!formData.businessName.trim()) newErrors.businessName = 'Business Name is required';

    if (!formData.contactNumber.trim()) {
      newErrors.contactNumber = 'Contact Number is required';
    } else if (!phoneRegex.test(formData.contactNumber.trim())) {
      newErrors.contactNumber = 'Please enter a valid contact number';
    }

    if (!formData.contactEmail.trim()) {
      newErrors.contactEmail = 'Contact Email is required';
    } else if (!emailRegex.test(formData.contactEmail.trim())) {
      newErrors.contactEmail = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setSuccessMessage('');

    try {
      // Split designerName into firstName and lastName
      const nameParts = formData.designerName.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || '';

      const signupData = {
        email: formData.contactEmail,
        password: formData.password,
        firstName,
        lastName,
        role: 'designer',
        designerDetails: {
          businessName: formData.businessName,
          contactNumber: formData.contactNumber,
          specialInstructions: formData.specialInstructions,
        },
      };

      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signupData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Signup failed');
      }

      setSuccessMessage(data.message);
      // Reset form
      setFormData({
        designerName: '',
        businessName: '',
        contactNumber: '',
        contactEmail: '',
        password: '',
        confirmPassword: '',
        specialInstructions: '',
      });
    } catch (error) {
      setErrors({ submit: error.message || 'Signup failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-0">
      <Card className="w-full max-w-[700px] border-0 p-4 shadow-sm md:p-6">
        <div className="mb-4 text-center">
          <div className="mb-3 inline-flex size-16 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--color-brand-start),var(--color-brand-end))]">
            <BsPersonPlus className="text-2xl text-white" />
          </div>
          <h2 className="font-bold text-foreground">Designer Signup</h2>
          <p className="text-sm text-muted-foreground">Create your ClearTrackings designer account</p>
        </div>

        {successMessage && (
          <Alert className="mb-3 items-start gap-2 border-success bg-success/10">
            <BsCheckCircleFill className="mt-1 shrink-0 text-success" />
            <AlertDescription className="text-foreground">
              <strong>Registration Successful!</strong>
              <p className="mt-1 mb-1">{successMessage}</p>
              <Button asChild size="sm" className="mt-1 bg-success text-white hover:bg-success/90">
                <Link href="/designer/login">Go to Login</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {errors.submit && (
          <Alert variant="destructive" className="mb-3">
            <BsExclamationTriangleFill />
            <AlertDescription>{errors.submit}</AlertDescription>
          </Alert>
        )}

        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Designer Name */}
          <div className="grid gap-1.5">
            <Label className="text-muted-foreground">
              Designer Full Name <span className="text-destructive">*</span>
            </Label>
            <Input
              type="text"
              className={cn(errors.designerName && 'border-destructive')}
              name="designerName"
              placeholder="e.g. Jane Doe"
              value={formData.designerName}
              onChange={handleChange}
              disabled={loading}
            />
            {errors.designerName && <div className="text-sm text-destructive">{errors.designerName}</div>}
          </div>

          {/* Business Name */}
          <div className="grid gap-1.5">
            <Label className="text-muted-foreground">
              Business Name <span className="text-destructive">*</span>
            </Label>
            <Input
              type="text"
              className={cn(errors.businessName && 'border-destructive')}
              name="businessName"
              value={formData.businessName}
              onChange={handleChange}
              disabled={loading}
            />
            {errors.businessName && <div className="text-sm text-destructive">{errors.businessName}</div>}
          </div>

          {/* Contact Number */}
          <div className="grid gap-1.5">
            <Label className="text-muted-foreground">
              Contact # <span className="text-destructive">*</span>
            </Label>
            <Input
              type="tel"
              className={cn(errors.contactNumber && 'border-destructive')}
              name="contactNumber"
              value={formData.contactNumber}
              onChange={handleChange}
              disabled={loading}
            />
            {errors.contactNumber && <div className="text-sm text-destructive">{errors.contactNumber}</div>}
          </div>

          {/* Contact Email */}
          <div className="grid gap-1.5">
            <Label className="text-muted-foreground">
              Contact Email Address <span className="text-destructive">*</span>
            </Label>
            <Input
              type="email"
              className={cn(errors.contactEmail && 'border-destructive')}
              name="contactEmail"
              value={formData.contactEmail}
              onChange={handleChange}
              disabled={loading}
            />
            {errors.contactEmail && <div className="text-sm text-destructive">{errors.contactEmail}</div>}
          </div>

          {/* Password */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className="text-muted-foreground">
                Password <span className="text-destructive">*</span>
              </Label>
              <PasswordInput
                className={cn(errors.password && 'border-destructive')}
                name="password"
                placeholder="Minimum 6 characters"
                value={formData.password}
                onChange={handleChange}
                disabled={loading}
              />
              {errors.password && <div className="text-sm text-destructive">{errors.password}</div>}
            </div>
            <div className="grid gap-1.5">
              <Label className="text-muted-foreground">
                Confirm Password <span className="text-destructive">*</span>
              </Label>
              <PasswordInput
                className={cn(errors.confirmPassword && 'border-destructive')}
                name="confirmPassword"
                placeholder="Repeat your password"
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={loading}
              />
              {errors.confirmPassword && <div className="text-sm text-destructive">{errors.confirmPassword}</div>}
            </div>
          </div>

          {/* Special Instructions */}
          <div className="mb-1 grid gap-1.5">
            <Label className="text-muted-foreground">Any Special Instructions</Label>
            <Textarea
              name="specialInstructions"
              rows="3"
              value={formData.specialInstructions}
              onChange={handleChange}
              disabled={loading}
            />
          </div>

          {/* Submit */}
          <Button
            type="submit"
            className="w-full bg-[linear-gradient(to_right,var(--color-brand-start),var(--color-brand-end))] py-2 font-semibold text-white hover:opacity-90"
            disabled={loading}
          >
            {loading ? (
              <>
                <Spinner className="mr-2 border-white" />
                Submitting...
              </>
            ) : (
              'Submit Request'
            )}
          </Button>

          <div className="mt-1 text-center">
            <Link href="/designer/login" className="text-foreground no-underline">
              Already have an account? Login
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
