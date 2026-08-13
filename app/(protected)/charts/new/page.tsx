import { ChartForm } from '@/components/charts/chart-form'
import { createChart } from '../actions'

export default function NewChartPage() {
  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold mb-4">New chart</h1>
      <ChartForm onSubmit={createChart} submitLabel="Create chart" />
    </div>
  )
}
