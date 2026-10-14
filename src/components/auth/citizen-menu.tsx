'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { InitialsAvatar } from '@/components/brand/avatar'
import { Button } from '@/components/ui/button'
import type { CitizenIdentity } from '@/lib/citizenSession'

/** Signed-in counterpart to `LoginModal` in `TopNav`: avatar + display name + logout. */
export function CitizenMenu({ citizen }: { citizen: CitizenIdentity }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const logout = async () => {
    setLoading(true)
    try {
      await fetch('/api/citizens/session/logout', { method: 'POST' })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2.5">
      <InitialsAvatar name={citizen.pseudo} size={30} />
      <span className="text-sm font-extrabold text-ink">{citizen.pseudo}</span>
      <Button variant="ghost" size="sm" onClick={logout} disabled={loading}>
        Se déconnecter
      </Button>
    </div>
  )
}
