import AsyncStorage from '@react-native-async-storage/async-storage';
import { OnboardKeys } from '@moajoa/core';

/**
 * Phase 5 ONBOARD-02 — D-20.
 * Type-safe wrapper around AsyncStorage for onboarding dismiss flags.
 * Keys come from @moajoa/core to keep storage layout in one place.
 *
 * Read returns `false` on any storage error so the UI degrades gracefully:
 * users see the (still-useful) onboarding card instead of getting a blank
 * empty state. Write swallows errors with a warn for the same reason — a
 * failed dismiss should not crash the board screen.
 */
export async function isLinkCardDismissed(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(OnboardKeys.LinkCardDismissed);
    return v === 'true';
  } catch (e) {
    console.warn('[onboarding] read failed, treating as not dismissed:', e);
    return false;
  }
}

export async function dismissLinkCard(): Promise<void> {
  try {
    await AsyncStorage.setItem(OnboardKeys.LinkCardDismissed, 'true');
  } catch (e) {
    console.warn('[onboarding] write failed:', e);
  }
}

/**
 * First-run tab walkthrough (Mozi-style coachmark). Same graceful-degrade
 * contract as the link card: read errors → treat as not-done so the overlay
 * still shows; write errors are swallowed so a failed dismiss can't wedge it on.
 */
export async function isWalkthroughDone(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(OnboardKeys.WalkthroughDone);
    return v === 'true';
  } catch (e) {
    console.warn('[onboarding] read failed, treating as not done:', e);
    return false;
  }
}

export async function completeWalkthrough(): Promise<void> {
  try {
    await AsyncStorage.setItem(OnboardKeys.WalkthroughDone, 'true');
  } catch (e) {
    console.warn('[onboarding] write failed:', e);
  }
}
