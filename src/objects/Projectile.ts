import Phaser from 'phaser';
import { RapierManager } from '../physics/RapierManager';
import RAPIER from '@dimforge/rapier2d-compat';
import { ProjectileType, PROJECTILE_DATA } from './ProjectileTypes';

export class Projectile extends Phaser.GameObjects.Sprite {
    private bodyId: RAPIER.RigidBody;
    private rapierManager: RapierManager;
    private world: RAPIER.World;
    public damage: number;

    constructor(
        scene: Phaser.Scene, 
        x: number, 
        y: number, 
        angle: number, 
        velocity: number = 20, 
        world?: RAPIER.World, 
        public projectileType: ProjectileType = ProjectileType.BASIC,
        public teamId: string | null = null
    ) {
        super(scene, x, y, 'projectile'); 

        const stats = PROJECTILE_DATA[projectileType];
        this.damage = stats.damage;
        
        // If no texture is loaded, we can just use a shape visibly or rely on the scene to have a texture.
        // For safety, let's create a texture if it doesn't exist or just use a circle.
        if (!scene.textures.exists('projectile')) {
            const graphics = scene.make.graphics({ x: 0, y: 0 });
            graphics.fillStyle(0xffff00);
            graphics.fillCircle(5, 5, 5);
            graphics.generateTexture('projectile', 10, 10);
        }
        this.setTexture('projectile');
        
        scene.add.existing(this);
        this.rapierManager = RapierManager.getInstance();

        // Allow passing a specific world (for prediction)
        this.world = world || this.rapierManager.world!;
        
        if (!this.world) {
            throw new Error("Rapier World not initialized");
        }

        // Physics: Dynamic body
        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(x, y)
            .setLinvel(Math.cos(angle) * velocity, Math.sin(angle) * velocity)
            .setCcdEnabled(true); // Continuous collision detection for fast objects

        this.bodyId = this.world.createRigidBody(bodyDesc);
        (this.bodyId as any).userData = { type: 'projectile', visual: this };

        const colliderDesc = RAPIER.ColliderDesc.ball(5.0);
        // Enable collisions
        colliderDesc.setRestitution(0.8);
        colliderDesc.setFriction(0.5);
        // Volume (Area) = PI * 5^2 = ~78.54
        // We want Mass = 1.0 to match AI assumptions and Logic
        // Density = Mass / Volume
        colliderDesc.setDensity(1.0 / (Math.PI * 25));
        colliderDesc.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
        
        this.world.createCollider(colliderDesc, this.bodyId);
    }

    update() {
        if (!this.bodyId.isValid()) return;
        
        const translation = this.bodyId.translation();
        this.setPosition(translation.x, translation.y);
        
        // Cleanup if out of bounds (simple check)
        // if (translation.x < -100 || translation.x > 2000 || translation.y < -100 || translation.y > 2000) {
        //    this.destroy();
        // }
    }
    
    destroy(fromScene?: boolean) {
        if (this.world && this.bodyId.isValid()) {
            this.world.removeRigidBody(this.bodyId);
        }
        super.destroy(fromScene);
    }

    applyForce(x: number, y: number) {
        if (this.bodyId.isValid()) {
            this.bodyId.addForce({ x, y }, true);
        }
    }

    get position(): { x: number, y: number } {
        if (this.bodyId.isValid()) {
            return this.bodyId.translation();
        }
        return { x: this.x, y: this.y };
    }
}
