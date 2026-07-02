import { describe, it, expect } from 'vitest';
import { placeVibe, VIBE_META, isBookableActivity, type Vibe } from './category';

describe('placeVibe — exact vibe-key passthrough (6 canonical keys)', () => {
  const keys: Vibe[] = ['food', 'cafe', 'nature', 'culture', 'shopping', 'other'];
  for (const k of keys) {
    it(`placeVibe('${k}') === '${k}'`, () => {
      expect(placeVibe(k)).toBe(k);
    });
  }
});

describe('placeVibe — Google primaryType substring mapping', () => {
  it("'ramen_restaurant' → food", () => {
    expect(placeVibe('ramen_restaurant')).toBe('food');
  });
  it("'coffee_shop' → cafe (cafe split, NOT food)", () => {
    expect(placeVibe('coffee_shop')).toBe('cafe');
  });
  it("'bakery' → cafe", () => {
    expect(placeVibe('bakery')).toBe('cafe');
  });
  it("'bar' → food (bar collapses to food per D1)", () => {
    expect(placeVibe('bar')).toBe('food');
  });
  it("'tourist_attraction' → culture", () => {
    expect(placeVibe('tourist_attraction')).toBe('culture');
  });
  it("'shopping_mall' → shopping", () => {
    expect(placeVibe('shopping_mall')).toBe('shopping');
  });
  it("'national_park' → nature", () => {
    expect(placeVibe('national_park')).toBe('nature');
  });
});

describe('placeVibe — wellness/lodging collapse to other', () => {
  it("'onsen' → other", () => {
    expect(placeVibe('onsen')).toBe('other');
  });
  it("'lodging' → other", () => {
    expect(placeVibe('lodging')).toBe('other');
  });
  it("'spa' → other", () => {
    expect(placeVibe('spa')).toBe('other');
  });
});

describe('placeVibe — null/empty/undefined default to other', () => {
  it('null → other', () => {
    expect(placeVibe(null)).toBe('other');
  });
  it("'' → other", () => {
    expect(placeVibe('')).toBe('other');
  });
  it('undefined → other', () => {
    expect(placeVibe(undefined)).toBe('other');
  });
});

describe('placeVibe — case-insensitive', () => {
  it("'RAMEN_RESTAURANT' → food", () => {
    expect(placeVibe('RAMEN_RESTAURANT')).toBe('food');
  });
});

describe('VIBE_META — color hex per canonical vibe', () => {
  const keys: Vibe[] = ['food', 'cafe', 'nature', 'culture', 'shopping', 'other'];
  it('has an entry for all 6 vibes', () => {
    for (const k of keys) {
      expect(VIBE_META[k]).toBeDefined();
    }
  });
  it('each color is a non-empty 6-digit hex string', () => {
    for (const k of keys) {
      expect(VIBE_META[k].color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe('isBookableActivity — D-08 bookability boundary (Phase 20)', () => {
  it('culture-family categories are bookable', () => {
    for (const c of ['tourist_attraction', 'museum', 'temple']) {
      expect(isBookableActivity(c)).toBe(true);
    }
  });

  it('theme-park family is bookable (placeVibe says nature, D-08 overrides)', () => {
    for (const c of ['amusement_park', 'theme_park', 'aquarium', 'zoo', 'water_park']) {
      expect(isBookableActivity(c)).toBe(true);
    }
  });

  it('food/cafe are NOT bookable', () => {
    for (const c of ['ramen_restaurant', 'cafe', 'coffee_shop']) {
      expect(isBookableActivity(c)).toBe(false);
    }
  });

  it('shopping is NOT bookable', () => {
    expect(isBookableActivity('clothing_store')).toBe(false);
  });

  it('null/undefined/empty are NOT bookable', () => {
    expect(isBookableActivity(null)).toBe(false);
    expect(isBookableActivity(undefined)).toBe(false);
    expect(isBookableActivity('')).toBe(false);
  });
});
