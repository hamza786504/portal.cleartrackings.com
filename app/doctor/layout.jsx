// This layout intentionally has no auth logic.
// Login and signup render here without any shell.
// Protected pages (dashboard, cases) use <DashboardShell> internally.
export default function DoctorLayout({ children }) {
  return children;
}