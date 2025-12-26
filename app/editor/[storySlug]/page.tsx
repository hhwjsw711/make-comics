"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { EditorToolbar } from "@/components/editor/editor-toolbar";
import { PageSidebar } from "@/components/editor/page-sidebar";
import { ComicCanvas } from "@/components/editor/comic-canvas";
import { ApiKeyModal } from "@/components/api-key-modal";
import { PageInfoSheet } from "@/components/editor/page-info-sheet";
import { GeneratePageModal } from "@/components/editor/generate-page-modal";

interface PageData {
  id: number; // pageNumber for component compatibility
  title: string;
  image: string;
  prompt: string;
  characterUploads?: string[];
  style: string;
  dbId?: string; // actual database UUID
}

interface StoryData {
  id: string;
  title: string;
  description?: string | null;
  userId?: string | null;
}

export default function StoryEditorPage() {
  const params = useParams();
  const slug = params.storySlug as string;

  const [story, setStory] = useState<StoryData | null>(null);
  const [pages, setPages] = useState<PageData[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [showApiModal, setShowApiModal] = useState(false);
  const [showInfoSheet, setShowInfoSheet] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [loadingPageId, setLoadingPageId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [existingCharacterImages, setExistingCharacterImages] = useState<
    string[]
  >([]);
  const { toast } = useToast();

  // Load story and pages from API
  useEffect(() => {
    const loadStoryData = async () => {
      try {
        const response = await fetch(`/api/stories/${slug}`);
        if (!response.ok) {
          throw new Error("Story not found");
        }

        const result = await response.json();
        const { story: storyData, pages: pagesData } = result;

        setStory(storyData);
        setPages(
          pagesData.map((page: any) => ({
            id: page.pageNumber,
            title: storyData.title,
            image: page.generatedImageUrl || "",
            prompt: page.prompt,
            characterUploads: page.characterImageUrls,
            style: storyData.style || "noir",
            dbId: page.id,
          }))
        );

        // Load existing character images for reuse
        const uniqueImages = [
          ...new Set(
            pagesData.flatMap((page: any) => page.characterImageUrls || [])
          ),
        ];
        setExistingCharacterImages(uniqueImages as string[]);
      } catch (error) {
        console.error("Error loading story:", error);
        toast({
          title: "Error loading story",
          description: "Failed to load story data.",
          variant: "destructive",
          duration: 4000,
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (slug) {
      loadStoryData();
    }
  }, [slug, toast]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        setCurrentPage((prev) => (prev < pages.length - 1 ? prev + 1 : prev));
      } else if (e.key === "ArrowLeft") {
        setCurrentPage((prev) => (prev > 0 ? prev - 1 : prev));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pages.length]);

  const handleAddPage = () => {
    const storedKey = localStorage.getItem("together_api_key");
    if (!storedKey && pages.length >= 1) {
      setShowApiModal(true);
      return;
    }
    setShowGenerateModal(true);
  };

  const handleApiKeyClick = () => {
    setShowApiModal(true);
  };

  const handleApiKeySubmit = (key: string) => {
    localStorage.setItem("together_api_key", key);
    setShowApiModal(false);
    const wasGenerating = showGenerateModal;
    if (wasGenerating) {
      setShowGenerateModal(true);
    }

    toast({
      title: "API key saved",
      description: "Your Together API key has been saved successfully",
      duration: 3000,
    });
  };

  const handleGeneratePage = async (data: {
    prompt: string;
    style: string;
    characterFiles?: File[];
    characterUrls?: string[];
    isContinuation?: boolean;
  }) => {
    try {
      const apiKey = localStorage.getItem("together_api_key");
      if (!apiKey) {
        setShowApiModal(true);
        return;
      }

      const response = await fetch("/api/generate-comic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          storyId: story?.id,
          prompt: data.prompt,
          apiKey,
          style: data.style,
          characterImages: data.characterUrls || [],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate image");
      }

      const result = await response.json();

      setPages((prevPages) => [
        ...prevPages,
        {
          id: pages.length + 1,
          title: story?.title || "",
          image: result.imageUrl,
          prompt: data.prompt,
          characterUploads: data.characterUrls || [],
          style: data.style,
        },
      ]);
      setCurrentPage(pages.length);
      setShowGenerateModal(false);
    } catch (error) {
      console.error("Error generating page:", error);
      toast({
        title: "Generation failed",
        description:
          error instanceof Error ? error.message : "Failed to generate page",
        variant: "destructive",
        duration: 4000,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-white">Loading story...</div>
      </div>
    );
  }

  if (!story) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-white">Story not found</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <EditorToolbar
        title={story.title}
        onInfoClick={() => setShowInfoSheet(true)}
        onContinueStory={handleAddPage}
      />

      <div className="flex-1 flex overflow-hidden">
        <PageSidebar
          pages={pages}
          currentPage={currentPage}
          onPageSelect={setCurrentPage}
          onAddPage={handleAddPage}
          loadingPageId={loadingPageId}
          onApiKeyClick={handleApiKeyClick}
        />
        <ComicCanvas page={pages[currentPage]} />
      </div>

      <ApiKeyModal
        isOpen={showApiModal}
        onClose={() => setShowApiModal(false)}
        onSubmit={handleApiKeySubmit}
      />
      <GeneratePageModal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        onGenerate={handleGeneratePage}
        pageNumber={pages.length + 1}
        allPages={pages.map((page, index) => ({
          pageNumber: page.id,
          characterImages: page.characterUploads || [],
          prompt: page.prompt,
          imageUrl: page.image,
          style: page.style,
        }))}
      />
      <PageInfoSheet
        isOpen={showInfoSheet}
        onClose={() => setShowInfoSheet(false)}
        page={pages[currentPage]}
      />
    </div>
  );
}
