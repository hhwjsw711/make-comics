"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { Key, ExternalLink, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { TOGETHER_LINK } from "@/lib/utils";

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (key: string) => void;
}

export function ApiKeyModal({ isOpen, onClose, onSubmit }: ApiKeyModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [existingKey, setExistingKey] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && isOpen) {
      const storedKey = localStorage.getItem("together_api_key");
      setExistingKey(storedKey);
      setApiKey((current) => {
        if (storedKey && current === "") {
          return storedKey;
        }
        return current;
      });
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;

    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setIsLoading(false);
    onSubmit(apiKey.trim());
    setApiKey("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="border border-border/50 rounded-lg bg-background max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4">
            <div className="w-14 h-14 glass-panel rounded-full flex items-center justify-center">
              <Key className="w-6 h-6 text-indigo" />
            </div>
          </div>

          <DialogTitle className="text-xl text-center text-white">
            {existingKey
              ? "Update your API key"
              : "Add your API key to continue"}
          </DialogTitle>

          <DialogDescription className="text-center text-muted-foreground">
            {existingKey
              ? "Update your Together API key or add a new one."
              : "Your first page was free! Add your Together API key to generate more pages."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your API key..."
            className="bg-secondary border-border/50 text-white placeholder-muted-foreground py-5"
          />

          <a
            href={TOGETHER_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-indigo hover:text-indigo-light flex items-center gap-1.5 transition-colors"
          >
            Get your free API key
            <ExternalLink className="h-3.5 w-3.5" />
          </a>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="flex-1 text-muted-foreground hover:text-white hover:bg-secondary"
            >
              Maybe Later
            </Button>
            <Button
              type="submit"
              disabled={!apiKey.trim() || isLoading}
              className="flex-1 gap-2 bg-white hover:bg-neutral-200 text-black"
            >
              {isLoading ? "Validating..." : "Continue"}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </form>

        <div className="mt-4 p-3 glass-panel rounded-lg">
          <p className="text-xs text-muted-foreground text-center">
            Your API key is stored locally and never sent to our servers.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
