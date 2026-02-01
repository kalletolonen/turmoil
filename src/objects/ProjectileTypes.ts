export enum ProjectileType {
    BASIC = 'basic',
    GIGA_BLASTER = 'blaster',
    COLONIZER = 'colonizer',
    RADAR = 'radar',
    DEFENDER = 'defender'
}

export interface ProjectileStats {
    type: ProjectileType;
    damage: number;
    cost: number; // Keeping 'cost' name for compatibility for now, treating as AP cost
    name: string;
    description: string;
    color: number;
    explosionRadius: number;
    pushForce: number; // New property
    icon?: string; // Optional icon key
}

export const PROJECTILE_DATA: Record<ProjectileType, ProjectileStats> = {
    [ProjectileType.BASIC]: {
        type: ProjectileType.BASIC,
        damage: 30,
        cost: 1,
        name: 'Basic',
        description: 'Standard projectile',
        color: 0xffff00,
        explosionRadius: 20,
        pushForce: 5,
        icon: 'icon_basic'
    },
    [ProjectileType.GIGA_BLASTER]: {
        type: ProjectileType.GIGA_BLASTER,
        damage: 75,
        cost: 4,
        name: 'Giga Blaster',
        description: 'High damage projectile',
        color: 0xff00ff,
        explosionRadius: 40,
        pushForce: 20,
        icon: 'icon_giga_blaster'
    },
    [ProjectileType.COLONIZER]: {
        type: ProjectileType.COLONIZER,
        damage: 0, // No damage, gentle landing
        cost: 8,
        name: 'Colonizer',
        description: 'Spawns a turret on impact',
        color: 0x00ffff,
        explosionRadius: 0,
        pushForce: 0,
        icon: 'icon_colonizer'
    },
    [ProjectileType.RADAR]: {
        type: ProjectileType.RADAR,
        damage: 0,
        cost: 10,
        name: 'Radar',
        description: 'Reveals enemy plans',
        color: 0x00ff00, 
        explosionRadius: 0,
        pushForce: 0,
        icon: 'icon_radar'
    },
    [ProjectileType.DEFENDER]: {
        type: ProjectileType.DEFENDER,
        damage: 0,
        cost: 2,
        name: 'Defender',
        description: 'Intercepts projectiles',
        color: 0x0000ff,
        explosionRadius: 35,
        pushForce: 10,
        icon: 'icon_defender'
    }
};
