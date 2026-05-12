export interface SchedulingMetrics {
  open_shifts:               number
  unassigned_shifts:         number
  conflict_count:            number
  overdue_acknowledgements:  number
  workers_available_today:   number
  workers_booked_today:      number

  // Operational KPIs added
  total_shifts?:             number
  completion_rate?:          number
  late_rate?:                number
  missed_rate?:              number
}
