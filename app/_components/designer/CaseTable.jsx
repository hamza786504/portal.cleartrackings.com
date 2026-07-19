'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BsFolder2Open, BsEye, BsUnlock, BsHandIndexThumb } from 'react-icons/bs';
import { Card, CardContent, CardFooter } from '@/app/_components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/_components/ui/table';
import { Badge } from '@/app/_components/ui/badge';
import { Button } from '@/app/_components/ui/button';
import { Avatar, AvatarFallback } from '@/app/_components/ui/avatar';
import StatusBadge from '@/app/_components/shared/StatusBadge';
import Spinner from '@/app/_components/shared/Spinner';

const EMPTY_MESSAGES = {
  all: 'There are no cases or revisions yet.',
  mine: "You haven't picked up any cases or revisions yet — check All Cases to find one.",
  completed: "You don't have any completed cases or revisions yet.",
};

// `rows` is a unified list of cases AND revisions (each carries its own
// viewHref / canPick / pick), so revisions can be surfaced as pickable rows
// interleaved with cases in the same table.
export default function CaseTable({ rows = [], scope = 'all' }) {
  const [pickingId, setPickingId] = useState(null);

  const handlePick = async (row) => {
    if (!row.pick) return;
    setPickingId(row._id);
    try {
      await row.pick();
    } finally {
      setPickingId(null);
    }
  };

  if (!rows || rows.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="py-5 text-center">
          <BsFolder2Open className="mx-auto text-5xl text-muted-foreground" />
          <p className="mt-3 mb-2 text-lg text-muted-foreground">No cases found</p>
          <p className="mb-0 text-sm text-muted-foreground">{EMPTY_MESSAGES[scope] || 'No cases or revisions at the moment.'}</p>
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
              <TableHead className="py-3 px-3 text-muted-foreground">Complaint / Note</TableHead>
              <TableHead className="py-3 px-3 text-muted-foreground">Type</TableHead>
              <TableHead className="py-3 px-3 text-muted-foreground">Status</TableHead>
              <TableHead className="py-3 px-3 text-muted-foreground">Picked By</TableHead>
              <TableHead className="py-3 px-3 text-muted-foreground">Date</TableHead>
              <TableHead className="py-3 px-3 text-muted-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, index) => {
              const pickedBy = r.pickedBy ? `${r.pickedBy.firstName} ${r.pickedBy.lastName}` : null;

              const createdDate = r.createdAt
                ? new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : '—';

              return (
                <TableRow key={`${r.kind}-${r._id}`}>
                  <TableCell className="px-3 text-muted-foreground">{index + 1}</TableCell>
                  <TableCell className="px-3 font-semibold">{r.patientName}</TableCell>
                  <TableCell className="px-3">
                    <span
                      className="line-clamp-2 max-w-[200px] text-sm text-muted-foreground"
                      title={typeof r.description === 'string' ? r.description : ''}
                    >
                      {r.description || '—'}
                    </span>
                  </TableCell>
                  <TableCell className="px-3">
                    <Badge
                      variant="outline"
                      className={r.kind === 'revision' ? 'border-primary/40 bg-primary/10 text-primary' : 'bg-muted'}
                    >
                      {r.caseType || '—'}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-3">
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="px-3">
                    {pickedBy ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="size-7">
                          <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">
                            {pickedBy.split(' ').map((n) => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{pickedBy}</span>
                      </div>
                    ) : (
                      <Badge variant="outline" className="gap-1 border-success text-success">
                        <BsUnlock /> Available
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="px-3 text-muted-foreground">{createdDate}</TableCell>
                  <TableCell className="px-3">
                    <div className="flex items-center gap-2">
                      <Button asChild variant="outline" size="sm" className="w-fit gap-1 whitespace-nowrap">
                        <Link href={r.viewHref}>
                          <BsEye /> View
                        </Link>
                      </Button>
                      {r.canPick && (
                        <Button
                          size="sm"
                          className="w-fit gap-1 whitespace-nowrap"
                          disabled={pickingId === r._id}
                          onClick={() => handlePick(r)}
                        >
                          {pickingId === r._id ? (
                            <Spinner className="border-white" />
                          ) : (
                            <>
                              <BsHandIndexThumb /> {r.kind === 'revision' ? 'Pick Revision' : 'Pick'}
                            </>
                          )}
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
        {rows.length} item{rows.length !== 1 ? 's' : ''} found
      </CardFooter>
    </Card>
  );
}
