"use client"

import { Check } from "lucide-react"
import { Label } from "@/components/ui/label"
import { COMIC_STYLES } from "@/lib/constants"

interface StyleSelectorProps {
  style: string
  setStyle: (style: string) => void
}

export function StyleSelector({ style, setStyle }: StyleSelectorProps) {

  return (
    <div className="space-y-3">
      <Label className="text-base font-semibold font-display">Choose Your Style</Label>

      {/* Grid for style selection */}
      <div className="grid grid-cols-2 gap-3">
        {COMIC_STYLES.map((styleOption) => (
          <button
            key={styleOption.id}
            onClick={() => setStyle(styleOption.id)}
            className={`
              relative text-left transition-all duration-200 rounded-lg p-3.5 border-2 group
              hover:scale-[1.02] active:scale-[0.98]
              ${
                style === styleOption.id
                  ? "border-indigo bg-indigo shadow-md"
                  : "border-border hover:border-indigo/50 bg-card hover:bg-muted/20"
              }
            `}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className={`font-semibold text-sm font-display ${
                    style === styleOption.id ? "text-white" : "text-foreground"
                  }`}>{styleOption.name}</h3>
                </div>
              </div>
              {style === styleOption.id && (
                <div className="bg-white text-indigo p-1 rounded-full shrink-0">
                  <Check className="w-3 h-3" />
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
