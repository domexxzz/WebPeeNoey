import Image from "next/image";
import { SIGNAL_PROOF_SECTION, SIGNAL_PROOF_SHOTS, type ProofShot } from "@/config/marketing";
import { staggerStyle } from "@/lib/motion";

/**
 * ภาพหน้าจอจริงจากห้องสัญญาณ — เรียงเป็นแถวเลื่อนได้ เพิ่มภาพใหม่ได้โดยแก้แค่ SIGNAL_PROOF_SHOTS
 * ไม่มีภาพ = ไม่แสดงหัวข้อทั้งก้อน ดีกว่าโชว์หัวข้อว่าง ๆ ค้างไว้
 */
export function SignalProof({ shots = SIGNAL_PROOF_SHOTS }: { shots?: ProofShot[] }) {
  if (shots.length === 0) return null;

  return (
    <section aria-labelledby="signal-proof-heading" className="mt-12">
      <h2 id="signal-proof-heading" className="font-display text-lg font-bold tracking-tight text-fg">
        {SIGNAL_PROOF_SECTION.title}
      </h2>
      <p className="mt-1.5 text-xs text-fg-subtle leading-relaxed">{SIGNAL_PROOF_SECTION.description}</p>

      <ul className="mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
        {shots.map((shot, index) => (
          <li
            key={shot.src}
            data-reveal="up"
            style={staggerStyle(index, 90)}
            className="w-[min(78vw,320px)] shrink-0 snap-start"
          >
            <figure className="flex h-full flex-col overflow-hidden border border-line bg-surface rounded-2xl">
              <Image
                src={shot.src}
                width={shot.width}
                height={shot.height}
                sizes={shot.sizes}
                alt={shot.alt}
                className="w-full h-auto"
              />
              <figcaption className="px-4 py-3 text-xs text-fg-subtle leading-relaxed">{shot.caption}</figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}
