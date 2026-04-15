import { useEffect, useMemo, useState } from 'react'

type AdSlide = {
  label: string
  href: string
  cta: string
}

export function AdBanner({ className }: { className?: string }) {
  const slides = useMemo<AdSlide[]>(
    () => [
      {
        label: '🌲 Voss Rental: Premium cabin rentals situated with spectacular mountain views!',
        href: 'https://vossrental.no',
        cta: 'Book your stay →',
      },
      {
        label: '🌊 Villa Bjørge: Din eksklusive perle ved sjøen i vakre Bergen.',
        href: 'https://villabjorge.no',
        cta: 'Opplev villaen →',
      },
      {
        label: '🏠 Sansel: Unike ferieopplevelser og fantastiske hjem for hele familien.',
        href: 'https://sansel.no',
        cta: 'Utforsk destinasjonene →',
      },
      {
        label: '🌍 Sansel: Unique experiences and high-quality holiday homes for your whole family.',
        href: 'https://en.sansel.no',
        cta: 'Explore destinations →',
      },
      {
        label: '☀️ Casa Agnethe: Din perfekte drømmeferie på Costa del Sol venter!',
        href: 'https://casaagnethe.eu',
        cta: 'Se ferieboligen →',
      },
      {
        label: '✈️ Casa Agnethe: Your perfect family getaway holiday on the Costa del Sol.',
        href: 'https://en.casaagnethe.eu',
        cta: 'Visit Casa Agnethe →',
      },
      {
        label: '🏖️ Casa Alise: Nyt uforglemmelig strandliv sentralt i Fuengirola!',
        href: 'https://casaalise.eu',
        cta: 'Sikre deg plass →',
      },
      {
        label: '🌴 Casa Alise: Brand new, exclusive apartment just steps from the beach in Spain.',
        href: 'https://en.casaalise.eu',
        cta: 'Book your dates →',
      },
      {
        label: '💻 SeljeWeb: Professional webdesign & smart automations for your business.',
        href: 'https://seljenes.no',
        cta: 'Få et uforpliktende tilbud →',
      },
    ],
    [],
  )

  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % slides.length)
    }, 4500)
    return () => window.clearInterval(id)
  }, [paused, slides.length])

  return (
    <div
      className={`relative overflow-hidden rounded-md shadow-sm border border-slate-700/60 bg-[#2e7d7a] text-white h-9 ${className ?? ''}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {slides.map((s, i) => (
        <div
          key={s.href + i}
          className={`absolute inset-0 px-3 flex items-center justify-between gap-3 transition-opacity duration-700 ${
            i === active ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="text-xs font-medium truncate min-w-0">{s.label}</div>
          <a
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold whitespace-nowrap text-[#ebf5f4] hover:underline"
          >
            {s.cta}
          </a>
        </div>
      ))}
    </div>
  )
}
