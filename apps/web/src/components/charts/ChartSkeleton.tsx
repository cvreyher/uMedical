import { Skeleton } from '@workspace/ui/components/ui/skeleton'

interface ChartSkeletonProps {
  height?: string
  className?: string
}

export function ChartSkeleton({ height = '400px', className }: ChartSkeletonProps) {
  return (
    <div className={`w-full ${className || ''}`} style={{ height }}>
      <Skeleton className="w-full h-full rounded-lg" />
    </div>
  )
}
