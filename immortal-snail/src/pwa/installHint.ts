/**
 * Who sees the "Add to Home Screen to play offline" hint: people in Safari on an iPhone or iPad,
 * not yet playing from the home screen, who have not closed the hint before. Other iOS browsers
 * and in-app web views (Instagram, Facebook, …) are left out: they can't add to the home screen,
 * or do it differently.
 */

export interface Device {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  /** Already running from the home screen (iOS navigator.standalone, or display-mode standalone). */
  standalone: boolean;
}

const OTHER_IOS_BROWSERS =
  /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|YaBrowser|DuckDuckGo|Brave|FBAN|FBAV|FBIOS|Instagram|Line\/|Twitter|Snapchat|TikTok|musical_ly|Pinterest|LinkedInApp|WhatsApp|MicroMessenger|Discord/i;

export function isIosSafari({ userAgent, platform, maxTouchPoints }: Omit<Device, 'standalone'>): boolean {
  // iPadOS Safari reports itself as a Mac; a Mac with a touch screen is an iPad.
  const ios = /iPhone|iPad|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
  return ios && /Version\/[\d.]+.*Safari\//.test(userAgent) && !OTHER_IOS_BROWSERS.test(userAgent);
}

export function shouldShowInstallHint(device: Device, dismissed: boolean): boolean {
  return !dismissed && !device.standalone && isIosSafari(device);
}

/** This browser, right now. */
export function currentDevice(): Device {
  let standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  try {
    standalone ||= window.matchMedia('(display-mode: standalone)').matches;
  } catch {
    /* no matchMedia */
  }
  return { userAgent: navigator.userAgent, platform: navigator.platform, maxTouchPoints: navigator.maxTouchPoints ?? 0, standalone };
}
