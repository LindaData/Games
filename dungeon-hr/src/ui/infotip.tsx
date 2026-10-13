import { useEffect, useState } from 'react';

interface Info {
  id: number;
  title: string;
  text: string;
}

let show: ((i: Info) => void) | null = null;
let counter = 0;

/** True on phones and tablets, where hover tooltips can't be reached. */
export function isTouch(): boolean {
  try {
    return window.matchMedia('(hover: none)').matches;
  } catch {
    return false;
  }
}

/** Shows a short explanation panel (the touch replacement for a hover tooltip). */
export function showInfo(title: string, text: string) {
  show?.({ id: ++counter, title, text });
}

export function InfoHost() {
  const [info, setInfo] = useState<Info | null>(null);
  useEffect(() => {
    show = setInfo;
    return () => {
      show = null;
    };
  }, []);
  useEffect(() => {
    if (!info) return;
    const t = setTimeout(() => setInfo((cur) => (cur?.id === info.id ? null : cur)), 6000);
    return () => clearTimeout(t);
  }, [info]);
  if (!info) return null;
  return (
    <div className="infotip" role="status" onClick={() => setInfo(null)} key={info.id}>
      <b>{info.title}</b>
      <span>{info.text}</span>
      <span className="xs dim">Tap to close</span>
    </div>
  );
}
