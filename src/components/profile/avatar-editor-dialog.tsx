"use client";

import { useState, useCallback, useRef } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Camera, Loader2, ZoomIn, ZoomOut, Upload } from "lucide-react";

interface AvatarEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (avatarUrl: string) => void;
}

/**
 * Create a cropped image from canvas based on pixel crop area.
 */
async function getCroppedBlob(
  imageSrc: string,
  pixelCrop: Area
): Promise<Blob> {
  const image = new Image();
  image.crossOrigin = "anonymous";

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
    image.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob failed"));
      },
      "image/png",
      1
    );
  });
}

export function AvatarEditorDialog({
  open,
  onOpenChange,
  onSuccess,
}: AvatarEditorDialogProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type on client side
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels) return;

    setIsUploading(true);
    setError(null);

    try {
      // 1. Crop on canvas
      const croppedBlob = await getCroppedBlob(imageSrc, croppedAreaPixels);

      // 2. Upload to server
      const formData = new FormData();
      formData.append("file", croppedBlob, "avatar.png");

      const response = await fetch("/api/avatar", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Upload failed");
      }

      const data = await response.json();
      onSuccess(data.avatarUrl);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload avatar");
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-coral-500" />
            Change Avatar
          </DialogTitle>
          <DialogDescription>
            Select an image and adjust the crop area. The image will be
            automatically compressed.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm p-2.5 rounded-md border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        {!imageSrc ? (
          /* File picker */
          <div
            className="flex flex-col items-center justify-center gap-3 py-10 border-2 border-dashed border-stone-200 dark:border-stone-700 rounded-xl cursor-pointer hover:border-coral-300 dark:hover:border-coral-700 hover:bg-stone-50 dark:hover:bg-stone-900/50 transition-all"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-coral-100 to-amber-100 dark:from-coral-950/40 dark:to-amber-950/40 flex items-center justify-center">
              <Upload className="h-6 w-6 text-coral-500" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-stone-700 dark:text-stone-300">
                Click to select an image
              </p>
              <p className="text-xs text-stone-400 mt-1">
                JPEG, PNG, GIF, WebP — any size
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        ) : (
          /* Cropper */
          <div className="space-y-4">
            {/* Crop area */}
            <div className="relative h-72 bg-stone-900 rounded-xl overflow-hidden">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>

            {/* Zoom control */}
            <div className="flex items-center gap-3 px-2">
              <ZoomOut className="h-4 w-4 text-stone-400 shrink-0" />
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 h-1.5 bg-stone-200 dark:bg-stone-700 rounded-full appearance-none cursor-pointer accent-coral-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-coral-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer"
              />
              <ZoomIn className="h-4 w-4 text-stone-400 shrink-0" />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setImageSrc(null);
                  setCrop({ x: 0, y: 0 });
                  setZoom(1);
                }}
              >
                Choose Different
              </Button>
              <Button
                className="flex-1 bg-coral-600 hover:bg-coral-700 text-white"
                onClick={handleSave}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Camera className="mr-2 h-4 w-4" />
                    Save Avatar
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
