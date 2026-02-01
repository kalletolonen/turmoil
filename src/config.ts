export const GameConfig = {
    // Debug Flags
    DEBUG_INFINITE_AP: false,
    RED_FACTION_MAX_AP: false, // New config for the requested feature
    MAX_PROJECTILE_SPEED: 10.0, // Increased by 4x from 2.5 based on feedback
    DRAG_SPEED_SCALE: 0.032, // Adjusted for 10.0 max speed
    PROJECTILE_SPAWN_OFFSET: 20, // Distance from turret center to spawn projectile

    // Physics
    TURRET_FRICTION: 2.0, // High friction to prevent sliding
    TURRET_DAMPING: 0.5,

    // Map Generation
    SEED: 123123123,
    MAP_WIDTH: 800,
    MAP_HEIGHT: 600,
};
