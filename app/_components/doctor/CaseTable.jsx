'use client';

import Link from 'next/link';
import { BsFolder2Open, BsPlusLg, BsUnlock, BsEye, BsArrowRepeat } from 'react-icons/bs';
import { Card, CardContent, CardFooter } from '@/app/_components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/_components/ui/table';
import { Badge } from '@/app/_components/ui/badge';
import { Button } from '@/app/_components/ui/button';
import StatusBadge from '@/app/_components/shared/StatusBadge';

export default function CaseTable({ cases, status = 'all' }) {
  if (!cases || cases.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="py-5 text-center">
          <BsFolder2Open className="mx-auto text-5xl text-muted-foreground" />
          <p className="mt-3 mb-2 text-lg text-muted-foreground">No cases found</p>
          <p className="mb-4 text-sm text-muted-foreground">
            {status === 'all'
              ? 'You have not submitted any cases yet.'
              : `No ${status} cases at the moment.`}
          </p>
          <Button asChild className="px-4">
            <Link href="/doctor/cases/add">
              <BsPlusLg /> Create Your First Case
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 py-0 shadow-sm">
      <CardContent className="px-0">
        <Table>
          <TableHeader className="bg-[linear-gradient(to_right,#f8f9ff,#f0f4ff)]">
            <TableRow>
              <TableHead className="py-3 px-3 text-muted-foreground">#</TableHead>
              <TableHead className="py-3 px-3 text-muted-foreground">Patient</TableHead>
              <TableHead className="py-3 px-3 text-muted-foreground">Practice</TableHead>
              <TableHead className="py-3 px-3 text-muted-foreground">Chief Complaint</TableHead>
              <TableHead className="py-3 px-3 text-muted-foreground">Case Type</TableHead>
              <TableHead className="py-3 px-3 text-muted-foreground">Status</TableHead>
              <TableHead className="py-3 px-3 text-muted-foreground">Paid</TableHead>
              <TableHead className="py-3 px-3 text-muted-foreground">Picked By</TableHead>
              <TableHead className="py-3 px-3 text-muted-foreground">Date</TableHead>
              <TableHead className="py-3 px-3 text-muted-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cases.map((c, index) => {
              const pickedBy = c.pickedBy ? `${c.pickedBy.firstName} ${c.pickedBy.lastName}` : null;

              const createdDate = c.createdAt
                ? new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : '—';

              return (
                <TableRow key={c._id}>
                  <TableCell className="px-3 text-muted-foreground">{index + 1}</TableCell>
                  <TableCell className="px-3 font-semibold">{c.patientName}</TableCell>
                  <TableCell className="px-3 text-muted-foreground">{c.practiceName}</TableCell>
                  <TableCell className="px-3">
                    <span
                      className="line-clamp-2 max-w-[200px] text-muted-foreground"
                      title={c.chiefComplaint}
                    >
                      {c.chiefComplaint}
                    </span>
                  </TableCell>
                  <TableCell className="px-3">
                    <Badge variant="outline" className="bg-muted">{c.caseType || '—'}</Badge>
                  </TableCell>
                  <TableCell className="px-3">
                    <StatusBadge status={c.revisionStatus ?? c.status} />
                  </TableCell>
                  <TableCell className="px-3">
                    <input
                      type="checkbox"
                      aria-label={`Case ${c.patientName} payment status`}
                      className="size-4 cursor-not-allowed accent-success"
                      checked={!!c.paid}
                      disabled
                    />
                  </TableCell>
                  <TableCell className="px-3">
                    {pickedBy ? (
                      <div className="flex items-center gap-2">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                          {pickedBy.split(' ').map((n) => n[0]).join('').toUpperCase()}
                        </div>
                        <span>{pickedBy}</span>
                      </div>
                    ) : (
                      <Badge variant="outline" className="gap-1 border-success text-success">
                        <BsUnlock /> Available
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="px-3 text-muted-foreground">{createdDate}</TableCell>
                  <TableCell className="px-3">
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="outline" size="sm" className="w-fit gap-1 whitespace-nowrap">
                        <Link href={`/doctor/cases/${c._id}`}>
                          <BsEye /> View
                        </Link>
                      </Button>
                      {c.status === 'completed' && (
                        <Button asChild variant="outline" size="sm" className="w-fit gap-1 whitespace-nowrap border-primary text-primary hover:bg-primary/10">
                          <Link href={`/doctor/cases/${c._id}?newRevision=1`}>
                            <BsArrowRepeat /> New Revision
                          </Link>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter className="border-t bg-muted/30 py-2 px-3 text-sm text-muted-foreground">
        {cases.length} case{cases.length !== 1 ? 's' : ''} found
      </CardFooter>
    </Card>
  );
}
