import { Info } from 'lucide-react'

export function TaxDisclaimer() {
  return (
    <div className="mt-8 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
      <div className="flex items-start gap-3">
        <Info className="w-4 h-4 text-white/30 mt-0.5 flex-shrink-0" />
        <p className="text-[10px] text-white/30 leading-relaxed">
          This analysis is provided for informational purposes only and does not constitute tax advice.
          All recommendations should be reviewed by a qualified tax professional before implementation.
          Values shown are estimates based on available data and may not reflect your final tax position.
        </p>
      </div>
    </div>
  )
}
