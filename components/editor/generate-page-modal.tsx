"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { Upload, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { validateFileForUpload, generateFilePreview } from "@/lib/file-utils"
import { COMIC_STYLES } from "@/lib/constants"

interface GeneratePageModalProps {
  isOpen: boolean
  onClose: () => void
  onGenerate: (data: {
    prompt: string
    style: string
    characterFiles?: File[]
    characterUrls?: string[] // For reusing existing characters
    isContinuation?: boolean
  }) => void
  pageNumber: number
  previousCharacters?: File[]
  previousPagePrompt?: string
  previousPageStyle?: string
  existingCharacterImages?: string[] // Character images from previous pages
}

export function GeneratePageModal({
  isOpen,
  onClose,
  onGenerate,
  pageNumber,
  previousCharacters,
  previousPagePrompt,
  previousPageStyle,
  existingCharacterImages = [],
}: GeneratePageModalProps) {
  const [prompt, setPrompt] = useState("")
  const [uploadedFiles, setUploadedFiles] = useState<File[]>(previousCharacters || [])
  const [selectedExistingCharacters, setSelectedExistingCharacters] = useState<string[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [showPreview, setShowPreview] = useState<number | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isContinuing, setIsContinuing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const selectedStyleId = previousPageStyle || "noir"
  const selectedStyle = useMemo(
    () => COMIC_STYLES.find((s) => s.id === selectedStyleId)?.name || "Noir",
    [selectedStyleId]
  )

  useEffect(() => {
    if (previousCharacters && previousCharacters.length > 0) {
      const newPreviews: string[] = []
      previousCharacters.forEach((file, index) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          newPreviews[index] = e.target?.result as string
          if (newPreviews.filter(Boolean).length === previousCharacters.length) {
            setPreviews([...newPreviews])
          }
        }
        reader.readAsDataURL(file)
      })
    }
  }, [previousCharacters])

  const handleFiles = async (newFiles: FileList | null) => {
    if (!newFiles) return

    const filesArray = Array.from(newFiles)

    // Validate files (including WebP rejection)
    const validationResults = filesArray.map(file => ({
      file,
      validation: validateFileForUpload(file, true)
    }))

    // Show errors for invalid files
    validationResults.forEach(({ validation }) => {
      if (!validation.valid && validation.error) {
        toast({
          title: "Invalid file",
          description: validation.error,
          variant: "destructive",
          duration: 4000,
        })
      }
    })

    const validFiles = validationResults
      .filter(({ validation }) => validation.valid)
      .map(({ file }) => file)

    if (validFiles.length === 0) return

    const totalFiles = [...uploadedFiles, ...validFiles].slice(0, 2) // Max 2 files
    setUploadedFiles(totalFiles)

    // Generate previews for all files
    const newPreviews = await Promise.all(
      totalFiles.map((file) => generateFilePreview(file))
    )
    setPreviews(newPreviews)
  }

  const removeFile = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index)
    const newPreviews = previews.filter((_, i) => i !== index)
    setUploadedFiles(newFiles)
    setPreviews(newPreviews)
    setShowPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const toggleExistingCharacter = (characterUrl: string) => {
    setSelectedExistingCharacters(prev =>
      prev.includes(characterUrl)
        ? prev.filter(url => url !== characterUrl)
        : [...prev, characterUrl]
    )
  }

  const handleGenerate = () => {
    if (!prompt.trim()) return
    setIsGenerating(true)
    onGenerate({
      prompt,
      style: selectedStyle,
      characterFiles: uploadedFiles.length > 0 ? uploadedFiles : undefined,
      characterUrls: selectedExistingCharacters.length > 0 ? selectedExistingCharacters : undefined,
      isContinuation: false,
    })
  }

  const handleContinue = () => {
    setIsContinuing(true)
    onGenerate({
      prompt: prompt.trim() || `Continue the story from where it left off. Previous context: ${previousPagePrompt}`,
      style: selectedStyle,
      characterFiles: uploadedFiles.length > 0 ? uploadedFiles : undefined,
      characterUrls: selectedExistingCharacters.length > 0 ? selectedExistingCharacters : undefined,
      isContinuation: true,
    })
  }

  useEffect(() => {
    if (!isOpen) {
      setIsGenerating(false)
      setIsContinuing(false)
      setPrompt("")
    }
  }, [isOpen])

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="border border-border/50 rounded-lg bg-background max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl text-white font-heading">Generate Page {pageNumber}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="relative glass-panel p-1 rounded-xl group focus-within:border-indigo/30 transition-colors">
              <div className="bg-background/80 rounded-lg p-4 border border-border/50">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-[10px] uppercase text-muted-foreground tracking-[0.02em] font-medium">
                    Prompt
                  </label>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="capitalize">{selectedStyle}</span>
                  </div>
                </div>

                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Continue the story... Describe what happens next in the comic."
                  className="w-full bg-transparent border-none text-sm text-white placeholder-muted-foreground/50 focus:ring-0 focus:outline-none resize-none h-20 leading-relaxed tracking-tight"
                />

                <div className="mt-3 pt-3 border-t border-border/30 space-y-3">
                  {/* Existing Characters */}
                  {existingCharacterImages.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground uppercase tracking-[0.02em] font-medium">
                        Reuse Characters from Story
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {existingCharacterImages.map((characterUrl, index) => {
                          const isSelected = selectedExistingCharacters.includes(characterUrl)
                          return (
                            <button
                              key={characterUrl}
                              onClick={() => toggleExistingCharacter(characterUrl)}
                              className={`relative w-8 h-8 rounded-md overflow-hidden border-2 transition-all ${
                                isSelected
                                  ? "border-indigo shadow-sm shadow-indigo/20"
                                  : "border-border/50 hover:border-indigo/50"
                              }`}
                            >
                              <img
                                src={characterUrl}
                                alt={`Existing character ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                              {isSelected && (
                                <div className="absolute inset-0 bg-indigo/20 flex items-center justify-center">
                                  <div className="w-3 h-3 bg-indigo rounded-full flex items-center justify-center">
                                    <div className="w-1 h-1 bg-white rounded-full" />
                                  </div>
                                </div>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* New Character Uploads */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {uploadedFiles.length > 0 ? (
                        <div className="flex items-center gap-2">
                          {previews.map((preview, index) => (
                            <div key={index} className="relative group/thumb">
                              <button
                                onClick={() => setShowPreview(index)}
                                className="w-8 h-8 rounded-md overflow-hidden border border-border/50 hover:border-indigo/50 transition-colors"
                              >
                                <img
                                  src={preview || "/placeholder.svg"}
                                  alt={`New character ${index + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  removeFile(index)
                                }}
                                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                              >
                                <X className="w-2.5 h-2.5 text-white" />
                              </button>
                            </div>
                          ))}
                          {uploadedFiles.length < 2 && (
                            <button
                              onClick={() => fileInputRef.current?.click()}
                              className="w-8 h-8 rounded-md border border-dashed border-border/50 hover:border-indigo/50 flex items-center justify-center text-muted-foreground hover:text-white transition-colors"
                            >
                              <Upload className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-white transition-colors"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload New Characters</span>
                          <span className="text-muted-foreground/50">(Max 2)</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleContinue}
                disabled={isGenerating || isContinuing}
                variant="outline"
                className="flex-1 gap-2 border-indigo/30 text-indigo hover:bg-indigo/10 hover:text-indigo tracking-tight bg-transparent"
              >
                {isContinuing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Continuing...</span>
                  </>
                ) : (
                  `Continue from Page ${pageNumber - 1}`
                )}
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={!prompt.trim() || isGenerating || isContinuing}
                className="flex-1 gap-2 bg-white hover:bg-neutral-200 text-black tracking-tight"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  `Generate Page ${pageNumber}`
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showPreview !== null && previews[showPreview] && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={() => setShowPreview(null)}
        >
          <div className="relative max-w-2xl max-h-[80vh] glass-panel p-4 rounded-xl z-[101]">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8 hover:bg-white/10 z-[102]"
              onClick={() => setShowPreview(null)}
            >
              <X className="w-4 h-4" />
            </Button>
            <img
              src={previews[showPreview] || "/placeholder.svg"}
              alt="Character preview"
              className="w-full h-full object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </>
  )
}
