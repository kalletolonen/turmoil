import Phaser from 'phaser';
import { RapierManager } from '../physics/RapierManager';
import RAPIER from '@dimforge/rapier2d-compat';

export class Debris {
    private body: RAPIER.RigidBody;
    private visual: Phaser.GameObjects.Arc;

    constructor(scene: Phaser.Scene, x: number, y: number, radius: number = 5) {
        const rapierManager = RapierManager.getInstance();
        if (!rapierManager.world) {
             throw new Error("Rapier World not initialized");
        }

        // Physics: Dynamic body with damping
        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(x, y)
            .setLinearDamping(0.5)
            .setAngularDamping(0.5);
            
        this.body = rapierManager.world.createRigidBody(bodyDesc);
        (this.body as any).userData = { type: 'debris' };
        
        const colliderDesc = RAPIER.ColliderDesc.ball(radius);
        rapierManager.world.createCollider(colliderDesc, this.body);

        // Visual
        this.visual = scene.add.circle(x, y, radius, 0x888888);
    }

    update() {
         const translation = this.body.translation();
         this.visual.setPosition(translation.x, translation.y);
    }
}
