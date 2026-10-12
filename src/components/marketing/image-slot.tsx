import Image from "next/image";
import { ImageIcon } from "lucide-react";
import type { ImageSlotSpec } from "@/config/marketing";

interface ImageSlotProps {
  spec: ImageSlotSpec;
  alt: string;
  /** path ใน /public — ถ้ายังไม่มีรูปจริงให้เว้นไว้ จะแสดงกรอบพร้อมสเปกแทน */
  src?: string;
  priority?: boolean;
  className?: string;
}

/**
 * ช่องวางรูปภาพ: ใช้ next/image เมื่อมีรูปจริง (กำหนด sizes ตามสเปก)
 * และแสดงกรอบระบุขนาดที่ต้องเตรียมเมื่อยังไม่มีรูป โดยคงสัดส่วนเดิมเพื่อไม่ให้เกิด Layout Shift
 */
export function ImageSlot({ spec, alt, src, priority = false, className = "" }: ImageSlotProps) {
  const aspectRatio = `${spec.width} / ${spec.height}`;

  if (src) {
    return (
      <Image
        src={src}
        alt={alt}
        width={spec.width}
        height={spec.height}
        sizes={spec.sizes}
        priority={priority}
        className={`w-full h-auto border border-line ${className}`}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={`${alt} (รอใส่รูปภาพ)`}
      style={{ aspectRatio }}
      data-image-slot={spec.label}
      className={`w-full border border-dashed border-line bg-[repeating-linear-gradient(135deg,rgba(110,234,110,0.05)_0,rgba(110,234,110,0.05)_12px,transparent_12px,transparent_24px)] flex flex-col items-center justify-center gap-2 p-4 text-center ${className}`}
    >
      <ImageIcon className="w-7 h-7 text-signal/70" aria-hidden="true" />
      <span className="text-xs font-medium text-signal">{spec.label}</span>
      <span className="text-[11px] text-gray-400">
        {spec.width} × {spec.height} px · WebP/AVIF ไม่เกิน 200KB
      </span>
    </div>
  );
}
