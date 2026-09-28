import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";

export const DEFAULT_LOGO = "/icon.png";

export const logoUrl = (version?: number) => (version ? `/api/logo?v=${version}` : DEFAULT_LOGO);

/** Public company name + logo version; works before login. */
export const useBranding = () =>
  useQuery({
    queryKey: ["branding"],
    queryFn: () => api<{ companyName: string; logoVersion: number }>("/branding"),
    staleTime: 5 * 60_000,
  });

/** The company logo, falling back to the bundled icon if it fails to load. */
export function BrandLogo({ version, className }: { version?: number; className?: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [version]);
  return (
    <img
      src={broken ? DEFAULT_LOGO : logoUrl(version)}
      onError={() => setBroken(true)}
      alt=""
      className={cn("object-contain", className)}
    />
  );
}

/** Keeps the browser tab icon in sync with the uploaded logo. */
export function useFavicon(version?: number) {
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) return;
    link.href = logoUrl(version);
    link.type = version ? "" : "image/png";
  }, [version]);
}

/**
 * Fits any image into a 256×256 transparent PNG so uploads stay small and
 * square, whatever the source photo's size or aspect ratio.
 */
export async function prepareLogo(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("این فایل تصویر معتبری نیست"));
      i.src = url;
    });
    const size = 256;
    const scale = Math.min(size / img.naturalWidth, size / img.naturalHeight, 1) || 1;
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = Math.max(w, h);
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("پردازش تصویر ناموفق بود"))), "image/png"),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
