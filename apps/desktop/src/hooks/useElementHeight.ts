import { useCallback, useRef, useState } from "react";

export const useElementHeight = (initialHeight: number) => {
  const [height, setHeight] = useState(initialHeight);
  const observer = useRef<ResizeObserver | null>(null);

  const ref = useCallback((element: HTMLElement | null) => {
    observer.current?.disconnect();
    if (!element) return;
    setHeight(element.clientHeight);
    observer.current = new ResizeObserver(() => setHeight(element.clientHeight));
    observer.current.observe(element);
  }, []);

  return { height, ref };
};
