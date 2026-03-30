import { Radar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'
import type { PlayerSnapshot } from '../lib/types'

ChartJS.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

interface AttributeRadarProps {
  player: PlayerSnapshot
  comparePlayer?: PlayerSnapshot
  className?: string
}

// Key attributes to display in the polygon (8 corners as per FM guide)
const POLYGON_ATTRIBUTES = [
  'Pace', // Speed corner
  'Strength', // Physical corner
  'Tackling', // Defending corner
  'Positioning', // Positioning corner
  'Composure', // Mental corner
  'Passing', // Vision corner
  'Finishing', // Attacking corner
  'Dribbling', // Technique corner
]

function normalizeValue(value: number | undefined): number {
  if (value === undefined || value === null) return 0
  return Math.min(value, 20) // Cap at 20
}

export function AttributeRadar({ player, comparePlayer, className }: AttributeRadarProps) {
  const playerData = POLYGON_ATTRIBUTES.map((attr) =>
    normalizeValue(player.attributes[attr as keyof typeof player.attributes])
  )

  const compareData = comparePlayer
    ? POLYGON_ATTRIBUTES.map((attr) =>
        normalizeValue(comparePlayer.attributes[attr as keyof typeof comparePlayer.attributes])
      )
    : undefined

  const datasets = [
    {
      label: player.name,
      data: playerData,
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      borderWidth: 2,
      pointBorderColor: '#3b82f6',
      pointBackgroundColor: '#3b82f6',
      pointBorderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6,
    },
  ]

  if (compareData) {
    datasets.push({
      label: comparePlayer?.name || 'Comparison',
      data: compareData,
      borderColor: '#ef4444',
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      borderWidth: 2,
      pointBorderColor: '#ef4444',
      pointBackgroundColor: '#ef4444',
      pointBorderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6,
    })
  }

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      r: {
        min: 0,
        max: 20,
        ticks: {
          stepSize: 5,
          font: {
            size: 11,
          },
        },
        grid: {
          color: '#e5e7eb',
        },
        pointLabels: {
          font: {
            size: 12,
            weight: 600 as const,
          },
          padding: 8,
        },
      },
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 15,
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 10,
        titleFont: {
          size: 13,
        },
        bodyFont: {
          size: 12,
        },
        cornerRadius: 4,
      },
    },
  }

  return (
    <div className={`rounded-lg bg-white p-4 shadow-md ${className}`}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Attribute Polygon</h3>
        <p className="mt-1 text-xs text-gray-500">FM position-specific attributes visualization</p>
      </div>
      <Radar
        data={{
          labels: POLYGON_ATTRIBUTES,
          datasets: datasets as any,
        }}
        options={options as any}
        height={250}
      />
    </div>
  )
}
