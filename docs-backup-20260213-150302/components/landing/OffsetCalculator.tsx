'use client'

import { motion } from 'framer-motion'
import { useState, useRef, useCallback, useEffect } from 'react'
import { Calculator } from 'lucide-react'

const SPECTRAL = {
  cyan: '#00F5FF',
  emerald: '#00FF88',
  amber: '#FFB800',
} as const

const EASING = [0.19, 1, 0.22, 1] as const

export function OffsetCalculator() {
  const [expenditure, setExpenditure] = useState(250000)
  const [entityRate, setEntityRate] = useState<25 | 30>(25)

  const offsetRate = entityRate === 25 ? 0.435 : 0.485
  const offsetAmount = Math.round(expenditure * offsetRate)
  const netCost = expenditure - offsetAmount

  const sliderRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleSliderInteraction = useCallback((clientX: number) => {
    if (!sliderRef.current) return
    const rect = sliderRef.current.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const raw = 50000 + pct * 1950000
    const snapped = Math.round(raw / 10000) * 10000
    setExpenditure(snapped)
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true)
    handleSliderInteraction(e.clientX)
  }, [handleSliderInteraction])

  useEffect(() => {
    if (!isDragging) return
    const handleMouseMove = (e: MouseEvent) => handleSliderInteraction(e.clientX)
    const handleMouseUp = () => setIsDragging(false)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, handleSliderInteraction])

  const pct = ((expenditure - 50000) / 1950000) * 100

  return (
    <div
      className="p-8 md:p-10 border-[0.5px] rounded-sm"
      style={{
        borderColor: `${SPECTRAL.cyan}20`,
        background: 'linear-gradient(135deg, rgba(0,245,255,0.03) 0%, rgba(0,255,136,0.02) 100%)',
      }}
    >
      <div className="flex items-center gap-3 mb-8">
        <Calculator className="w-5 h-5" style={{ color: SPECTRAL.cyan }} />
        <h3 className="text-lg font-medium text-white/90">R&D Offset Calculator</h3>
        <span className="text-[10px] uppercase tracking-widest text-white/30 ml-auto">Division 355 ITAA 1997</span>
      </div>

      <div className="flex items-center gap-4 mb-8">
        <span className="text-[11px] uppercase tracking-wider text-white/40">Corporate Rate:</span>
        <div className="flex gap-2">
          {([25, 30] as const).map(rate => (
            <button
              key={rate}
              onClick={() => setEntityRate(rate)}
              className="px-4 py-2 rounded-sm text-[11px] font-mono transition-all duration-200"
              style={{
                background: entityRate === rate ? `${SPECTRAL.cyan}15` : 'rgba(255,255,255,0.03)',
                borderWidth: '0.5px',
                borderStyle: 'solid',
                borderColor: entityRate === rate ? `${SPECTRAL.cyan}40` : 'rgba(255,255,255,0.08)',
                color: entityRate === rate ? SPECTRAL.cyan : 'rgba(255,255,255,0.5)',
              }}
            >
              {rate}%{rate === 25 ? ' (Base)' : ' (Standard)'}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-10">
        <div className="flex justify-between items-baseline mb-3">
          <span className="text-[11px] uppercase tracking-wider text-white/40">Eligible R&D Expenditure</span>
          <span className="text-2xl font-mono text-white font-light tabular-nums">
            ${expenditure.toLocaleString()}
          </span>
        </div>
        <div
          ref={sliderRef}
          className="relative h-2 bg-white/[0.06] rounded-full cursor-pointer select-none"
          role="slider"
          aria-label="R&D expenditure amount"
          aria-valuemin={50000}
          aria-valuemax={2000000}
          aria-valuenow={expenditure}
          tabIndex={0}
          onMouseDown={handleMouseDown}
          onTouchStart={(e) => {
            setIsDragging(true)
            handleSliderInteraction(e.touches[0].clientX)
          }}
          onTouchMove={(e) => handleSliderInteraction(e.touches[0].clientX)}
          onTouchEnd={() => setIsDragging(false)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
              setExpenditure(prev => Math.min(2000000, prev + 10000))
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
              setExpenditure(prev => Math.max(50000, prev - 10000))
            }
          }}
        >
          <motion.div
            className="absolute top-0 left-0 h-full rounded-full"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${SPECTRAL.cyan}, ${SPECTRAL.emerald})`,
            }}
            layout
          />
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2"
            style={{
              left: `${pct}%`,
              marginLeft: '-10px',
              borderColor: SPECTRAL.cyan,
              backgroundColor: '#050505',
              boxShadow: `0 0 20px ${SPECTRAL.cyan}40`,
            }}
            layout
          />
        </div>
        <div className="flex justify-between mt-2 text-[10px] font-mono text-white/20">
          <span>$50K</span>
          <span>$2M</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="p-5 rounded-sm border-[0.5px] border-white/[0.06]" style={{ background: 'rgba(0,255,136,0.04)' }}>
          <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Estimated Offset</p>
          <p className="text-3xl font-mono tabular-nums font-light" style={{ color: SPECTRAL.emerald }}>
            ${offsetAmount.toLocaleString()}
          </p>
          <p className="text-[10px] text-white/30 mt-1">{(offsetRate * 100).toFixed(1)}% refundable rate</p>
        </div>
        <div className="p-5 rounded-sm border-[0.5px] border-white/[0.06]" style={{ background: 'rgba(0,245,255,0.04)' }}>
          <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Net R&D Cost</p>
          <p className="text-3xl font-mono tabular-nums font-light" style={{ color: SPECTRAL.cyan }}>
            ${netCost.toLocaleString()}
          </p>
          <p className="text-[10px] text-white/30 mt-1">After tax offset recovery</p>
        </div>
        <div className="p-5 rounded-sm border-[0.5px] border-white/[0.06]" style={{ background: 'rgba(255,184,0,0.04)' }}>
          <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Effective Cost</p>
          <p className="text-3xl font-mono tabular-nums font-light" style={{ color: SPECTRAL.amber }}>
            {((1 - offsetRate) * 100).toFixed(1)}%
          </p>
          <p className="text-[10px] text-white/30 mt-1">Per dollar of R&D spend</p>
        </div>
      </div>

      <p className="text-[10px] text-white/25 mt-6 leading-relaxed">
        Estimate only. Refundable offset for entities with aggregated turnover under $20M (s 355-100 ITAA 1997).
        Entities at 30% rate receive 48.5% offset. Subject to $4M annual cap. Consult a registered tax agent.
      </p>
    </div>
  )
}
