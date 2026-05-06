// ── Day availability ──────────────────────────────────────────────────────────

export interface DayAvailability {
  available:  boolean
  start_time: string
  end_time:   string
  notes:      string
}

export const DEFAULT_DAY: DayAvailability = {
  available:  false,
  start_time: '',
  end_time:   '',
  notes:      '',
}

// ── Full availability record ──────────────────────────────────────────────────

export type DayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
export const DAY_KEYS: DayKey[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

export interface StaffAvailability {
  id?:                  string
  staff_profile_id:     string
  monday:               DayAvailability
  tuesday:              DayAvailability
  wednesday:            DayAvailability
  thursday:             DayAvailability
  friday:               DayAvailability
  saturday:             DayAvailability
  sunday:               DayAvailability
  max_weekly_hours:     number | null
  preferred_shift_type: string | null
  can_work_nights:      boolean
  can_work_weekends:    boolean
  is_driver:            boolean
  has_own_car:          boolean
  work_areas:           string[]
  unavailable_dates:    string[]
  notes:                string | null
  created_at?:          string
  updated_at?:          string
}

// ── Parsers ───────────────────────────────────────────────────────────────────

export function parseDayAvailability(raw: unknown): DayAvailability {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_DAY }
  const r = raw as Record<string, unknown>
  return {
    available:  typeof r.available  === 'boolean' ? r.available  : false,
    start_time: typeof r.start_time === 'string'  ? r.start_time : '',
    end_time:   typeof r.end_time   === 'string'  ? r.end_time   : '',
    notes:      typeof r.notes      === 'string'  ? r.notes      : '',
  }
}

export function parseAvailabilityRecord(
  staffProfileId: string,
  raw: Record<string, unknown> | null
): StaffAvailability {
  if (!raw) {
    return {
      staff_profile_id:     staffProfileId,
      monday:    { ...DEFAULT_DAY },
      tuesday:   { ...DEFAULT_DAY },
      wednesday: { ...DEFAULT_DAY },
      thursday:  { ...DEFAULT_DAY },
      friday:    { ...DEFAULT_DAY },
      saturday:  { ...DEFAULT_DAY },
      sunday:    { ...DEFAULT_DAY },
      max_weekly_hours:     null,
      preferred_shift_type: null,
      can_work_nights:  false,
      can_work_weekends: false,
      is_driver:  false,
      has_own_car: false,
      work_areas:        [],
      unavailable_dates: [],
      notes: null,
    }
  }
  return {
    id:               typeof raw.id === 'string' ? raw.id : undefined,
    staff_profile_id: staffProfileId,
    monday:    parseDayAvailability(raw.monday),
    tuesday:   parseDayAvailability(raw.tuesday),
    wednesday: parseDayAvailability(raw.wednesday),
    thursday:  parseDayAvailability(raw.thursday),
    friday:    parseDayAvailability(raw.friday),
    saturday:  parseDayAvailability(raw.saturday),
    sunday:    parseDayAvailability(raw.sunday),
    max_weekly_hours:
      typeof raw.max_weekly_hours === 'number' ? raw.max_weekly_hours : null,
    preferred_shift_type:
      typeof raw.preferred_shift_type === 'string' ? raw.preferred_shift_type : null,
    can_work_nights:  typeof raw.can_work_nights  === 'boolean' ? raw.can_work_nights  : false,
    can_work_weekends: typeof raw.can_work_weekends === 'boolean' ? raw.can_work_weekends : false,
    is_driver:  typeof raw.is_driver  === 'boolean' ? raw.is_driver  : false,
    has_own_car: typeof raw.has_own_car === 'boolean' ? raw.has_own_car : false,
    work_areas:
      Array.isArray(raw.work_areas) ? (raw.work_areas as string[]) : [],
    unavailable_dates:
      Array.isArray(raw.unavailable_dates) ? (raw.unavailable_dates as string[]) : [],
    notes:      typeof raw.notes === 'string' ? raw.notes : null,
    created_at: typeof raw.created_at === 'string' ? raw.created_at : undefined,
    updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : undefined,
  }
}
