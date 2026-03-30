import type { PlayerAnalytics } from '../lib/types'

interface StatCardProps {
  label: string
  value: number
  max?: number
  unit?: string
  variant?: 'primary' | 'success' | 'warning' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

function getVariantColor(variant: string): string {
  switch (variant) {
    case 'success':
      return 'bg-green-50 border-green-200'
    case 'warning':
      return 'bg-yellow-50 border-yellow-200'
    case 'danger':
      return 'bg-red-50 border-red-200'
    default:
      return 'bg-blue-50 border-blue-200'
  }
}

function getVariantTextColor(variant: string): string {
  switch (variant) {
    case 'success':
      return 'text-green-700'
    case 'warning':
      return 'text-yellow-700'
    case 'danger':
      return 'text-red-700'
    default:
      return 'text-blue-700'
  }
}

function getBarColor(variant: string): string {
  switch (variant) {
    case 'success':
      return 'bg-green-500'
    case 'warning':
      return 'bg-yellow-500'
    case 'danger':
      return 'bg-red-500'
    default:
      return 'bg-blue-500'
  }
}

export function StatCard({
  label,
  value,
  max = 100,
  unit = '',
  variant = 'primary',
  size = 'md',
  className = '',
}: StatCardProps) {
  const percentage = (value / max) * 100

  const sizeClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  }

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  }

  const valueSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
  }

  return (
    <div
      className={`rounded-lg border ${getVariantColor(variant)} ${sizeClasses[size]} ${className}`}
    >
      <p className={`text-xs font-semibold text-gray-600 uppercase tracking-wide ${textSizes[size]}`}>
        {label}
      </p>
      <div className="mt-2 flex items-baseline justify-between">
        <span className={`font-bold ${getVariantTextColor(variant)} ${valueSizes[size]}`}>
          {value.toFixed(0)}
        </span>
        {unit && <span className="text-xs font-medium text-gray-500">{unit}</span>}
      </div>
      {max && (
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className={`h-full ${getBarColor(variant)} transition-all duration-300`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}

interface PlayerEvaluationCardProps {
  analytics: PlayerAnalytics
  className?: string
}

export function PlayerEvaluationCard({ analytics, className }: PlayerEvaluationCardProps) {
  const categoryColor =
    analytics.sellScore > 70
      ? 'danger'
      : analytics.keepScore > 70 && analytics.developmentPotential > 40
        ? 'success'
        : analytics.keepScore > 60
          ? 'primary'
          : 'warning'

  const categoryLabel =
    analytics.sellScore > 70
      ? 'SELL'
      : analytics.keepScore > 70 && analytics.developmentPotential > 40
        ? 'DEVELOP'
        : analytics.keepScore > 60
          ? 'KEEP'
          : 'MONITOR'

  return (
    <div className={`grid grid-cols-2 gap-3 sm:grid-cols-4 ${className}`}>
      <StatCard
        label="Development"
        value={analytics.developmentPotential}
        unit="%"
        variant="success"
        size="sm"
      />
      <StatCard label="Keep Score" value={analytics.keepScore} unit="%" variant="primary" size="sm" />
      <StatCard label="Sell Score" value={analytics.sellScore} unit="%" variant="danger" size="sm" />
      <StatCard label="Attribute Grade" value={analytics.attributeGrade} unit="%" variant="warning" size="sm" />
      <div className={`col-span-2 rounded-lg border-2 p-4 text-center sm:col-span-4`}>
        <p className="text-xs font-semibold uppercase text-gray-600">Recommendation</p>
        <p className={`mt-1 text-2xl font-bold ${getVariantTextColor(categoryColor)}`}>
          {categoryLabel}
        </p>
      </div>
    </div>
  )
}
