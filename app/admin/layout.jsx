// This layout intentionally has no auth logic.
// Login renders here without any shell.
// Protected pages (dashboard, cases, doctors, designers) use <DashboardShell> internally.
export default function AdminLayout({ children }) {
  return children;
}
