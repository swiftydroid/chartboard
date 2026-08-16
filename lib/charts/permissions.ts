export interface ChartOwnership {
  owner_id: string | null
}

export function canEditChart(chart: ChartOwnership, currentUserId: string, isAdmin: boolean): boolean {
  if (chart.owner_id === currentUserId) return true
  if (chart.owner_id === null && isAdmin) return true
  return false
}
