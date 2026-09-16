import type { LottieAnimation } from "./types";

/** Trigger a client-side download of the Lottie animation as pretty JSON. */
export function downloadLottie(animation: LottieAnimation, filename = "iq-glow.json"): void {
  const json = JSON.stringify(animation, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
