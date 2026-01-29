import Phaser from 'phaser';
import { RapierManager } from '../physics/RapierManager';
import RAPIER from '@dimforge/rapier2d-compat';
import { INTERACTION_DEBRIS } from '../physics/PhysicsGroups';

export class Debris {
    private body: RAPIER.RigidBody;
    private visual: Phaser.GameObjects.Sprite;

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
        colliderDesc.setCollisionGroups(INTERACTION_DEBRIS);
        rapierManager.world.createCollider(colliderDesc, this.body);

        // Visual
        this.visual = scene.add.sprite(x, y, 'debris');
        this.visual.setDisplaySize(radius * 2, radius * 2);
    }

    update() {
         const translation = this.body.translation();
         this.visual.setPosition(translation.x, translation.y);

         // Bounds check
         if (translation.x < -2000 || translation.x > 4000 || translation.y < -2000 || translation.y > 4000) {
             // We need a destroy method
             if (this.body) {
                 RapierManager.getInstance().world?.removeRigidBody(this.body);
             }
             this.visual.destroy();
             // Note: Debris array in MainScene won't be updated automatically here. 
             // Ideally Debris should extend Sprite or have a proper lifecycle. 
             // For now, this cleans up physics and visual, but leaves a "dead" object in the array.
             // We'll leave it simple for now as Debris isn't heavily used yet.
         }
    }
}
