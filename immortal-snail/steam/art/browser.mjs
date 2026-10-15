/** Launches Chromium for the art and screenshot scripts (never downloads a browser by itself). */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const CANDIDATES = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].filter(Boolean);

export async function launchChromium() {
  const executablePath = CANDIDATES.find((p) => existsSync(p));
  try {
    return await chromium.launch({ executablePath, args: ['--font-render-hinting=none', '--disable-lcd-text'] });
  } catch (e) {
    console.error(
      `Could not start Chromium${executablePath ? ` at ${executablePath}` : ''}.\n` +
        'Set CHROMIUM_PATH to a Chrome/Chromium binary, or run "npx playwright-core install chromium" once.',
    );
    throw e;
  }
}
