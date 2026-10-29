import { authApi } from "@/app/services/authApi";

let cached: boolean | null = null;
let inflight: Promise<boolean> | null = null;

/** Public admin switch. Defaults to on if the setting cannot be read. */
export function fetchPhoneOtpEnabled(): Promise<boolean> {
  if (cached !== null) return Promise.resolve(cached);
  if (!inflight) {
    inflight = authApi
      .getPhoneOtpEnabled()
      .then((enabled) => {
        cached = enabled;
        return enabled;
      })
      .catch(() => true)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function clearPhoneOtpEnabledCache(): void {
  cached = null;
}
