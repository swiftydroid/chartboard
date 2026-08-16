'use client'

import { useState } from 'react'
import { unstable_rethrow } from 'next/navigation'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { softDeleteChart } from '@/app/(protected)/charts/actions'

export function DeleteChartButton({ chartId }: { chartId: string }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleDelete() {
    setError(null)
    setSubmitting(true)
    try {
      await softDeleteChart(chartId)
      setOpen(false)
    } catch (err) {
      unstable_rethrow(err)
      setError('Something went wrong deleting this chart')
      setSubmitting(false)
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setError(null)
      }}
    >
      <AlertDialogTrigger render={<Button variant="destructive" />}>Delete</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this chart?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes it from the library. It is not permanently erased.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={submitting}>
            {submitting ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
