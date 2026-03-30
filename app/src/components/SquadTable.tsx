import { useMemo, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  type SortingState,
} from '@tanstack/react-table'
import type { AttributeKey, PlayerSnapshot } from '../lib/types'

type AgeRange = { min?: number; max?: number }

const ageRangeFilter: FilterFn<PlayerSnapshot> = (row, columnId, value) => {
  const v = value as AgeRange | undefined
  if (!v || (v.min == null && v.max == null)) return true

  const age = row.getValue<number | null>(columnId)
  if (age == null) return false

  if (v.min != null && age < v.min) return false
  if (v.max != null && age > v.max) return false
  return true
}

function playerNameColor(homeGrownStatus: string | null | undefined, dueDateRaw: string | null | undefined): string {
  if (dueDateRaw && dueDateRaw !== '-') return 'text-orange-700'
  if (homeGrownStatus === 'Trained at club (0-21)') return 'text-emerald-600'
  if (homeGrownStatus === 'Trained in nation (15-21)') return 'text-orange-400'
  return ''
}

function toNullableInt(v: string): number | undefined {
  const t = v.trim()
  if (!t) return undefined
  const n = Number.parseInt(t, 10)
  return Number.isFinite(n) ? n : undefined
}

export function SquadTable(props: {
  players: PlayerSnapshot[]
  onSelectUid?: (uid: string) => void
  compareByUid?: Map<string, PlayerSnapshot>
}) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }])
  const [globalFilter, setGlobalFilter] = useState<string>('')
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const onSelectUid = props.onSelectUid

  const compareByUid = props.compareByUid

  const compareStats = useMemo(() => {
    if (!compareByUid) return null
    const currentUids = new Set(props.players.map((p) => p.uid))
    let newCount = 0
    for (const p of props.players) {
      if (!compareByUid.has(p.uid)) newCount++
    }
    let departedCount = 0
    for (const uid of compareByUid.keys()) {
      if (!currentUids.has(uid)) departedCount++
    }
    return { newCount, departedCount }
  }, [compareByUid, props.players])

  function renderAttrWithDelta(row: PlayerSnapshot, key: AttributeKey, value: number | null) {
    const prev = compareByUid?.get(row.uid)?.attributes[key] ?? null

    const delta = value != null && prev != null ? value - prev : null

    const deltaClass =
      delta == null
        ? ''
        : delta > 0
          ? 'deltaPositive'
          : delta < 0
            ? 'deltaNegative'
            : 'deltaZero'

    return (
      <div className="numCell">
        <span className="numValue">{value ?? ''}</span>
        {compareByUid ? (
          prev == null ? (
            <span className="delta deltaNew">new</span>
          ) : value == null ? null : delta == null || delta === 0 ? (
            <span className="delta deltaZero">0</span>
          ) : (
            <span className={`delta ${deltaClass}`}>{delta > 0 ? `+${delta}` : `${delta}`}</span>
          )
        ) : null}
      </div>
    )
  }

  const nationalityOptions = useMemo(() => {
    const set = new Set<string>()
    for (const p of props.players) {
      if (p.nationality) set.add(p.nationality)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [props.players])

  const columns = useMemo<ColumnDef<PlayerSnapshot>[]>(
    () => [
      {
        id: 'name',
        header: 'Player',
        accessorFn: (row) => row.name,
        enableGlobalFilter: true,
        sortingFn: 'text',
        cell: ({ row, getValue }) => {
          const name = String(getValue() ?? '')
          const isNew = Boolean(compareByUid && !compareByUid.has(row.original.uid))
          const colorClass = playerNameColor(row.original.homeGrownStatus, row.original.dueDateRaw)
          return (
            <div className="nameCell">
              <span className={colorClass || undefined}>{name}</span>
              {isNew ? <span className="badge">NEW</span> : null}
            </div>
          )
        },
      },
      {
        id: 'positionsRaw',
        header: 'Position',
        accessorFn: (row) => row.positionsRaw,
        enableGlobalFilter: true,
      },
      {
        id: 'age',
        header: 'Age',
        accessorFn: (row) => row.age,
        filterFn: ageRangeFilter,
        enableGlobalFilter: false,
      },
      {
        id: 'heightCm',
        header: 'Height',
        accessorFn: (row) => row.heightCm,
        enableGlobalFilter: false,
      },
      {
        id: 'CA',
        header: 'CA',
        accessorFn: (row) => row.attributes.CA ?? null,
        enableGlobalFilter: false,
        cell: ({ row, getValue }) =>
          renderAttrWithDelta(row.original, 'CA', (getValue() as number | null) ?? null),
      },
      {
        id: 'PA',
        header: 'PA',
        accessorFn: (row) => row.attributes.PA ?? null,
        enableGlobalFilter: false,
        cell: ({ row, getValue }) =>
          renderAttrWithDelta(row.original, 'PA', (getValue() as number | null) ?? null),
      },
      {
        id: 'Cmp',
        header: 'Cmp',
        accessorFn: (row) => row.attributes.Cmp ?? null,
        enableGlobalFilter: false,
        cell: ({ row, getValue }) =>
          renderAttrWithDelta(row.original, 'Cmp', (getValue() as number | null) ?? null),
      },
      {
        id: 'Dec',
        header: 'Dec',
        accessorFn: (row) => row.attributes.Dec ?? null,
        enableGlobalFilter: false,
        cell: ({ row, getValue }) =>
          renderAttrWithDelta(row.original, 'Dec', (getValue() as number | null) ?? null),
      },
      {
        id: 'Det',
        header: 'Det',
        accessorFn: (row) => row.attributes.Det ?? null,
        enableGlobalFilter: false,
        cell: ({ row, getValue }) =>
          renderAttrWithDelta(row.original, 'Det', (getValue() as number | null) ?? null),
      },
      {
        id: 'Nat',
        header: 'Nat',
        accessorFn: (row) => row.attributes.Nat ?? null,
        enableGlobalFilter: false,
        cell: ({ row, getValue }) =>
          renderAttrWithDelta(row.original, 'Nat', (getValue() as number | null) ?? null),
      },
      {
        id: 'Pac',
        header: 'Pac',
        accessorFn: (row) => row.attributes.Pac ?? null,
        enableGlobalFilter: false,
        cell: ({ row, getValue }) =>
          renderAttrWithDelta(row.original, 'Pac', (getValue() as number | null) ?? null),
      },
      {
        id: 'Wor',
        header: 'Wor',
        accessorFn: (row) => row.attributes.Wor ?? null,
        enableGlobalFilter: false,
        cell: ({ row, getValue }) =>
          renderAttrWithDelta(row.original, 'Wor', (getValue() as number | null) ?? null),
      },
      {
        id: 'nationality',
        header: 'NoB',
        accessorFn: (row) => row.nationality,
        filterFn: 'equalsString',
        enableGlobalFilter: true,
      },
      {
        id: 'homeGrownStatus',
        header: 'Home-Grown Status',
        accessorFn: (row) => row.homeGrownStatus,
        enableGlobalFilter: true,
      },
      {
        id: 'dueDateRaw',
        header: 'Due Date',
        accessorFn: (row) => row.dueDateRaw,
        enableGlobalFilter: true,
      },
      {
        id: 'uid',
        header: 'UID',
        accessorFn: (row) => row.uid,
        enableGlobalFilter: true,
      },
    ],
    [compareByUid],
  )

  const table = useReactTable({
    data: props.players,
    columns,
    state: {
      sorting,
      globalFilter,
      columnFilters,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: 'includesString',
  })

  const positionValue = (table.getColumn('positionsRaw')?.getFilterValue() ?? '') as string
  const nationalityValue = (table.getColumn('nationality')?.getFilterValue() ?? '') as string
  const ageValue = (table.getColumn('age')?.getFilterValue() ?? {}) as AgeRange

  const rows = table.getRowModel().rows

  return (
    <div>
      <div className="filterBar">
        <div className="filterGroup">
          <div className="filterLabel">Search</div>
          <input
            className="input"
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Name, UID, position, etc."
          />
        </div>

        <div className="filterGroup">
          <div className="filterLabel">Position</div>
          <input
            className="input"
            value={positionValue}
            onChange={(e) => table.getColumn('positionsRaw')?.setFilterValue(e.target.value)}
            placeholder="e.g. GK, AM (R)"
          />
        </div>

        <div className="filterGroup">
          <div className="filterLabel">NoB</div>
          <select
            className="select"
            value={nationalityValue}
            onChange={(e) => {
              const v = e.target.value
              table.getColumn('nationality')?.setFilterValue(v || undefined)
            }}
          >
            <option value="">All</option>
            {nationalityOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <div className="filterGroup">
          <div className="filterLabel">Age</div>
          <div className="ageRange">
            <input
              className="input"
              inputMode="numeric"
              value={ageValue.min ?? ''}
              onChange={(e) => {
                const min = toNullableInt(e.target.value)
                table.getColumn('age')?.setFilterValue({ ...ageValue, min })
              }}
              placeholder="min"
            />
            <input
              className="input"
              inputMode="numeric"
              value={ageValue.max ?? ''}
              onChange={(e) => {
                const max = toNullableInt(e.target.value)
                table.getColumn('age')?.setFilterValue({ ...ageValue, max })
              }}
              placeholder="max"
            />
          </div>
        </div>

        <div className="filterGroup filterActions">
          <button
            className="btn secondary"
            onClick={() => {
              setGlobalFilter('')
              setColumnFilters([])
              table.resetColumnFilters()
            }}
            type="button"
          >
            Reset filters
          </button>
          <div className="filterCount">
            <div>{rows.length} rows</div>
            {compareStats ? (
              <div>
                +{compareStats.newCount} new / -{compareStats.departedCount} departed
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="tableWrap">
        <table className="table">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sort = header.column.getIsSorted()

                  return (
                    <th
                      key={header.id}
                      className={canSort ? 'sortable' : undefined}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {sort === 'asc' ? ' ▲' : sort === 'desc' ? ' ▼' : ''}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={onSelectUid ? 'rowClickable' : undefined}
                onClick={
                  onSelectUid
                    ? () => {
                        const uid = String(row.getValue('uid') ?? '')
                        if (uid) onSelectUid(uid)
                      }
                    : undefined
                }
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {cell.column.columnDef.cell
                      ? flexRender(cell.column.columnDef.cell, cell.getContext())
                      : String(cell.getValue() ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
