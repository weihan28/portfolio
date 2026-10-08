"use client";

import { useEffect, useRef } from "react";
import { mountMla } from "../lab/mla-flow";

// DeepSeek-V2 Multi-Head Latent Attention, animated beside the intro (see app/lab/mla-flow.js).
export default function MlaFlow() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => mountMla(ref.current), []);
  return <figure className="mla" id="mla-bg" ref={ref} />;
}
