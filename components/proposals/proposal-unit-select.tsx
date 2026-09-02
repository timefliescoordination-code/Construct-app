'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { PROPOSAL_UNITS } from '@/lib/proposals/constants'
import { cn } from '@/lib/utils'

type ProposalUnitSelectProps = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  id?: string
}

export function ProposalUnitSelect({ value, onChange, disabled, id }: ProposalUnitSelectProps) {
  const [open, setOpen] = useState(false)
  const options = useMemo(() => {
    const trimmed = value.trim()
    if (trimmed && !(PROPOSAL_UNITS as readonly string[]).includes(trimmed)) {
      return [trimmed, ...PROPOSAL_UNITS]
    }
    return [...PROPOSAL_UNITS]
  }, [value])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Unit"
          disabled={disabled}
          className="h-9 w-full min-w-[6.5rem] justify-between px-3 font-normal"
        >
          <span className={cn('truncate', !value.trim() && 'text-muted-foreground')}>
            {value.trim() || 'Unit'}
          </span>
          <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[12.5rem] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search or type a unit"
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              const typed = (event.target as HTMLInputElement).value.trim()
              if (!typed) return
              event.preventDefault()
              onChange(typed)
              setOpen(false)
            }}
          />
          <CommandList>
            <CommandEmpty>Press Enter to use this unit.</CommandEmpty>
            <CommandGroup>
              {options.map((unit) => (
                <CommandItem
                  key={unit}
                  value={unit}
                  onSelect={() => {
                    onChange(unit)
                    setOpen(false)
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === unit ? 'opacity-100' : 'opacity-0')} />
                  {unit}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
