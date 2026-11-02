"use client";

import { useCallback, useEffect, useState } from "react";
import { DownloadIcon, Share2Icon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { downloadBlob } from "@/lib/charts/export-png";
import { cn } from "@/lib/utils";

interface Pending {
  file: File;
  url: string;
  title: string;
  canShare: boolean;
}

/**
 * Saves an exported image. With a mouse or trackpad the file downloads straight away. Phones and tablets block
 * downloads started by a script, so there a sheet shows the image with a Share button (the system sheet offers
 * "Save Image"), a real Download link the reader taps, and the press-and-hold menu of the image itself.
 */
export function useImageExport() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const url = pending?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [pending?.url]);

  const save = useCallback((blob: Blob, filename: string, title: string) => {
    if (!window.matchMedia("(pointer: coarse)").matches) {
      downloadBlob(blob, filename);
      return;
    }
    const file = new File([blob], filename, { type: blob.type || "image/png" });
    let canShare = false;
    try {
      canShare = typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
    } catch {
      canShare = false;
    }
    setPending({ file, url: URL.createObjectURL(file), title, canShare });
    setNote(null);
    setOpen(true);
  }, []);

  const share = async () => {
    if (!pending) return;
    try {
      await navigator.share({ files: [pending.file], title: pending.title });
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError")
        setNote("Sharing did not work in this browser. Press and hold the image, or use Download.");
    }
  };

  const sheet = (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="bottom"
        className="max-h-[92dvh] gap-3 overflow-y-auto rounded-t-xl pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="pr-12 pb-0">
          <SheetTitle className="display text-xl uppercase">Save the image</SheetTitle>
          <SheetDescription>
            Press and hold the image to save it to your photos, or use a button below.
          </SheetDescription>
        </SheetHeader>
        {pending ? (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL of the generated PNG
          <img
            src={pending.url}
            alt={pending.title}
            className="mx-4 max-h-[55dvh] w-auto max-w-[calc(100%-2rem)] self-center rounded-md border object-contain"
          />
        ) : null}
        {pending ? (
          <div className={cn("grid gap-2 px-4", pending.canShare && "grid-cols-2")}>
            {pending.canShare ? (
              <Button size="lg" className="h-10" onClick={share}>
                <Share2Icon aria-hidden />
                Share or save
              </Button>
            ) : null}
            <a
              href={pending.url}
              download={pending.file.name}
              className={buttonVariants({ variant: "outline", size: "lg", className: "h-10" })}
            >
              <DownloadIcon aria-hidden />
              Download
            </a>
          </div>
        ) : null}
        {note ? (
          <p role="status" className="px-4 text-xs text-muted-foreground">
            {note}
          </p>
        ) : null}
      </SheetContent>
    </Sheet>
  );

  return { save, sheet };
}
