// Membership Groups (Bit flags)
export const GROUP_WORLD = 0x0001;      // Planets, Turrets, Walls (Default default is usually FFFF, so it contains this)
export const GROUP_PROJECTILE = 0x0002;
export const GROUP_DEBRIS = 0x0004;

// Filters
// Projectiles collide with World and other Projectiles, but NOT Debris
const FILTER_PROJECTILE = GROUP_WORLD | GROUP_PROJECTILE;

// Debris collides with World and other Debris, but NOT Projectiles
const FILTER_DEBRIS = GROUP_WORLD | GROUP_DEBRIS;

// Interaction Groups word: (Membership << 16) | Filter

export const INTERACTION_PROJECTILE = (GROUP_PROJECTILE << 16) | FILTER_PROJECTILE;
export const INTERACTION_DEBRIS = (GROUP_DEBRIS << 16) | FILTER_DEBRIS;

// Optional: Explicit group for World objects if we ever set them manually
// Default objects (untouched) usually behave as 0xFFFF member / 0xFFFF filter.
// Since World(FFFF) & FILTER_PROJECTILE(3) != 0, they collide.
// Since Projectile(2) & World(FFFF) != 0, they collide.
// So we don't strictly need to update Planets/Turrets if they use defaults.
