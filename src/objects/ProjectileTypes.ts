export enum ProjectileType {
    BASIC = 'basic',
    GIGA_BLASTER = 'blaster',
    COLONIZER = 'colonizer',
    RADAR = 'radar'
}

export interface ProjectileStats {
    type: ProjectileType;
    damage: number;
    cost: number; // Keeping 'cost' name for compatibility for now, treating as AP cost
    name: string;
    description: string;
    color: number;
}

export const PROJECTILE_DATA: Record<ProjectileType, ProjectileStats> = {
    [ProjectileType.BASIC]: {
        type: ProjectileType.BASIC,
        damage: 1,
        cost: 1,
        name: 'Basic',
        description: 'Standard projectile',
        color: 0xffff00
    },
    [ProjectileType.GIGA_BLASTER]: {
        type: ProjectileType.GIGA_BLASTER,
        damage: 3,
        cost: 4,
        name: 'Giga Blaster',
        description: 'High damage projectile',
        color: 0xff00ff
    },
    [ProjectileType.COLONIZER]: {
        type: ProjectileType.COLONIZER,
        damage: 0.5, // Low impact damage
        cost: 8,
        name: 'Colonizer',
        description: 'Spawns a turret on impact',
        color: 0x00ffff
    },
    [ProjectileType.RADAR]: {
        type: ProjectileType.RADAR,
        damage: 1,
        cost: 10,
        name: 'Radar',
        description: 'Reveals enemy plans',
        color: 0x00ff00 // Green?
    }
};
