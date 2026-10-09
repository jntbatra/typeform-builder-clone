"use client";

import { useLayoutEffect, useRef } from "react";

/** A textarea that grows to fit its text, so it can stand in for a heading or paragraph. */
export function AutoTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Before paint, so the field never flashes at the wrong height.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [props.value]);

  return <textarea ref={ref} rows={1} {...props} />;
}
