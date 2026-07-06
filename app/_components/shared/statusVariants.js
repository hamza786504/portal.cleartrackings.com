export const STATUS_VARIANTS = {
  pending: { label: 'Pending', className: 'bg-warning text-warning-foreground' },
  'in-progress': { label: 'In Progress', className: 'bg-primary text-primary-foreground' },
  delivered: { label: 'Awaiting Approval', className: 'bg-info text-info-foreground' },
  completed: { label: 'Completed', className: 'bg-success text-success-foreground' },
};

export function getStatusVariant(status) {
  return STATUS_VARIANTS[status] || { label: status, className: 'bg-secondary text-secondary-foreground' };
}
