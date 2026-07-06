'use client';

import Link from 'next/link';
import { BsFolder2Open, BsEye } from 'react-icons/bs';
import { Card, CardContent, CardFooter } from '@/app/_components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/_components/ui/table';
import { Badge } from '@/app/_components/ui/badge';
import { Button } from '@/app/_components/ui/button';
import StatusBadge from '@/app/_components/shared/StatusBadge';

export default function CaseTable({ cases }) {
  if (!cases || cases.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="py-5 text-center">
          <BsFolder2Open className="mx-auto text-5xl text-muted-foreground" />
          <p className="mt-3 mb-0 text-lg text-muted-foreground">No cases found</p>
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
              <TableHead className="py-3 px-3 text-muted-foreground">Doctor</TableHead>
              <TableHead className="py-3 px-3 text-muted-foreground">Case Type</TableHead>
              <TableHead className="py-3 px-3 text-muted-foreground">Status</TableHead>
              <TableHead className="py-3 px-3 text-muted-foreground">Designer</TableHead>
              <TableHead className="py-3 px-3 text-muted-foreground">Date</TableHead>
              <TableHead className="py-3 px-3 text-muted-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cases.map((c, index) => {
              const doctorName = c.doctorId ? `${c.doctorId.firstName} ${c.doctorId.lastName}`.trim() : '—';
              const designerName = c.pickedBy ? `${c.pickedBy.firstName} ${c.pickedBy.lastName}`.trim() : null;
              const createdDate = c.createdAt
                ? new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : '—';

              return (
                <TableRow key={c._id}>
                  <TableCell className="px-3 text-muted-foreground">{index + 1}</TableCell>
                  <TableCell className="px-3 font-semibold">{c.patientName}</TableCell>
                  <TableCell className="px-3">{doctorName}</TableCell>
                  <TableCell className="px-3">
                    <Badge variant="outline" className="bg-muted">{c.caseType || '—'}</Badge>
                  </TableCell>
                  <TableCell className="px-3">
                    <StatusBadge status={c.status} />
                  </TableCell>
                  <TableCell className="px-3">
                    {designerName ? (
                      designerName
                    ) : (
                      <Badge variant="outline" className="border-success text-success">Unassigned</Badge>
                    )}
                  </TableCell>
                  <TableCell className="px-3 text-muted-foreground">{createdDate}</TableCell>
                  <TableCell className="px-3">
                    <Button asChild variant="outline" size="sm" className="w-fit gap-1 whitespace-nowrap">
                      <Link href={`/admin/cases/${c._id}`}>
                        <BsEye /> View
                      </Link>
                    </Button>
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
