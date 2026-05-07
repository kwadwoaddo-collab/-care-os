'use client'

import { useState } from 'react'
import CreateIncidentForm from './CreateIncidentForm'

export default function CreateIncidentButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        data-testid="create-incident-btn"
        onClick={() => setOpen(true)}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
      >
        + Create Incident
      </button>

      <CreateIncidentForm
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
