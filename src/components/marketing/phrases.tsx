import { Fragment } from "react";
import { indexStyle } from "@/lib/motion";

/**
 * ตัดบรรทัดหัวข้อภาษาไทยเฉพาะตรงช่องว่างระหว่างวลี
 * เบราว์เซอร์ตัดคำไทยด้วยพจนานุกรม ซึ่งไม่รู้จักคำทับศัพท์ (เช่น "คอมมูนิตี้" ถูกตัดเป็น "คอม|มูนิตี้")
 * แต่ละวลีเป็น inline-block + max-w-full: ถ้าวลียาวกว่าความกว้างจอ จะยอมตัดภายในวลีแทนการล้นจอ
 * animate = ให้แต่ละวลีลอยขึ้นทีละวลี (ต้องอยู่ใต้ [data-reveal="words"] หรือ .mx-load-words)
 */
export function Phrases({ text, animate = false, startIndex = 0 }: { text: string; animate?: boolean; startIndex?: number }) {
  const phrases = text.split(" ").filter(Boolean);
  return (
    <>
      {phrases.map((phrase, index) => (
        <Fragment key={`${phrase}-${index}`}>
          {index > 0 && " "}
          {animate ? (
            <span className="mx-word inline-block max-w-full" style={indexStyle(startIndex + index)}>
              {phrase}
            </span>
          ) : (
            <span className="inline-block max-w-full">{phrase}</span>
          )}
        </Fragment>
      ))}
    </>
  );
}
