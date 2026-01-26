import Phaser from 'phaser';
import { RapierManager } from '../physics/RapierManager';
import RAPIER from '@dimforge/rapier2d-compat';
import { ProjectileType } from './ProjectileTypes';
import { GameConfig } from '../config';

export class Turret {
    private body: RAPIER.RigidBody;
    public visual: Phaser.GameObjects.Sprite;

    public armed: boolean = false;
    public readonly id: string = Phaser.Utils.String.UUID();


    public aimVector: { x: number, y: number } | null = null;
    public projectileType: ProjectileType = ProjectileType.BASIC;
    
    public health: number = 3;
    public maxHealth: number = 3;
    
    public actionPoints: number = 1;
    public maxActionPoints: number = 10;
    
    private healthBar: Phaser.GameObjects.Graphics;

    /**
     * @param scene Phaser Scene
     * @param x World X position
     * @param y World Y position
     * @param angle Angle in radians (rotation of the turret)
     * @param width Width of the turret base
     * @param height Height of the turret (pointing outwards)
     */
    public teamId: string | null = null;

    /**
     * @param scene Phaser Scene
     * @param x World X position
     * @param y World Y position
     * @param angle Angle in radians (rotation of the turret)
     * @param width Width of the turret base
     * @param height Height of the turret (pointing outwards)
     * @param teamId Team ID
     */
    constructor(scene: Phaser.Scene, x: number, y: number, angle: number, width: number = 10, height: number = 10, teamId: string | null = null) {
        this.teamId = teamId;
        const rapierManager = RapierManager.getInstance();
        if (!rapierManager.world) {
             throw new Error("Rapier World not initialized");
        }

        // Physics: Static body
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(x, y)
            .setRotation(angle);
            
        this.body = rapierManager.world.createRigidBody(bodyDesc);
        (this.body as any).userData = { type: 'turret', parent: this };
        
        const colliderDesc = RAPIER.ColliderDesc.cuboid(width / 2, height / 2);
        colliderDesc.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
        rapierManager.world.createCollider(colliderDesc, this.body);

        // Visual: Sprite
        let color = 0xff0000;
        if (this.teamId === 'red') color = 0xff0000;
        if (this.teamId === 'green') color = 0x00ff00;
        
        this.visual = scene.add.sprite(x, y, 'turret_base');
        this.visual.setTint(color);
        this.visual.setRotation(angle);
        
        // Scale to match width/height if needed, but texture is 32x32.
        // Turrets are passed width/height args (usually 10x10 or 20x20).
        // Let's scale it to fit.
        const scaleX = width / 32;
        const scaleY = height / 32;
        this.visual.setScale(scaleX, scaleY);
        
        // Health Bar
        this.healthBar = scene.add.graphics();
        this.updateHealthBar();
        
        // Interaction
        this.visual.setInteractive();
        
        // Selection Bracket
        this.selectionBracket = scene.add.graphics();
        this.selectionBracket.setDepth(100);
        this.selectionBracket.setVisible(false);
    }

    public setArmed(value: boolean, vector?: { x: number, y: number }) {
        this.armed = value;
        if (this.armed && vector) {
            this.aimVector = vector;
            this.visual.setTint(0xffff00); // Yellow when armed
        } else {
            this.aimVector = null;
            // Restore team color
            let color = 0xff0000;
            if (this.teamId === 'red') color = 0xff0000;
            if (this.teamId === 'green') color = 0x00ff00;
            if (!this.teamId) color = 0xaaaaaa; // Neutral

            this.visual.setTint(color); // Revert to team color
            this.armed = false;
        }
    }
    
    public takeDamage(amount: number): boolean {
        this.health -= amount;
        if (this.health < 0) this.health = 0;
        this.updateHealthBar();
        return this.health <= 0;
    }
    
    public addActionPoints(amount: number) {
        this.actionPoints += amount;
        if (this.actionPoints > this.maxActionPoints) {
            this.actionPoints = this.maxActionPoints;
        }
        this.updateHealthBar();
    }
    
    public consumeActionPoints(amount: number): boolean {
        // Red Faction Max AP config or Debug Infinite AP bypass consumption
        if (GameConfig.DEBUG_INFINITE_AP || (GameConfig.RED_FACTION_MAX_AP && this.teamId === 'red')) {
            return true;
        }

        if (this.actionPoints >= amount) {
            this.actionPoints -= amount;
            this.updateHealthBar();
            return true;
        }
        return false;
    }

    public setMaxActionPoints() {
        this.actionPoints = this.maxActionPoints;
        this.updateHealthBar();
    }
    
    public updateHealthBar() {
        this.healthBar.clear();
        if (this.health <= 0) return;
        
        const width = 20;
        const height = 4;
        const x = this.position.x - width / 2;
        const y = this.position.y - 15;
        
        // Background
        this.healthBar.fillStyle(0x000000);
        this.healthBar.fillRect(x, y, width, height);
        
        // Health
        const percent = this.health / this.maxHealth;
        this.healthBar.fillStyle(0x00ff00);
        this.healthBar.fillRect(x, y, width * percent, height);
        
        this.drawAPPips();
    }
    
    public getBounds(): Phaser.Geom.Rectangle {
        return this.visual.getBounds();
    }
    
    public get position(): { x: number, y: number } {
        return this.body.translation();
    }
    
    public get rotation(): number {
        return this.body.rotation();
    }

    private selectionBracket: Phaser.GameObjects.Graphics;
    public isSelected: boolean = false;

    public setSelected(selected: boolean) {
        this.isSelected = selected;
        this.selectionBracket.setVisible(selected);
        this.updateSelectionBracket();
    }

    private updateSelectionBracket() {
        this.selectionBracket.clear();
        if (!this.isSelected) return;

        const width = 20;
        const height = 20;
        const x = this.position.x;
        const y = this.position.y;
        const bracketSize = 8;

        this.selectionBracket.lineStyle(2, 0xffffff, 1.0);
        
        // Top Left
        this.selectionBracket.beginPath();
        this.selectionBracket.moveTo(x - width/2, y - height/2 + bracketSize);
        this.selectionBracket.lineTo(x - width/2, y - height/2);
        this.selectionBracket.lineTo(x - width/2 + bracketSize, y - height/2);
        this.selectionBracket.strokePath();

         // Top Right
        this.selectionBracket.beginPath();
        this.selectionBracket.moveTo(x + width/2 - bracketSize, y - height/2);
        this.selectionBracket.lineTo(x + width/2, y - height/2);
        this.selectionBracket.lineTo(x + width/2, y - height/2 + bracketSize);
        this.selectionBracket.strokePath();

        // Bottom Left
        this.selectionBracket.beginPath();
        this.selectionBracket.moveTo(x - width/2, y + height/2 - bracketSize);
        this.selectionBracket.lineTo(x - width/2, y + height/2);
        this.selectionBracket.lineTo(x - width/2 + bracketSize, y + height/2);
        this.selectionBracket.strokePath();

        // Bottom Right
        this.selectionBracket.beginPath();
        this.selectionBracket.moveTo(x + width/2 - bracketSize, y + height/2);
        this.selectionBracket.lineTo(x + width/2, y + height/2);
        this.selectionBracket.lineTo(x + width/2, y + height/2 - bracketSize);
        this.selectionBracket.strokePath();
    }

    private drawAPPips() {
        // Draw AP pips above health bar
        const width = 20;
        const pipsY = this.position.y - 20; 
        const startX = this.position.x - width / 2;
        
        const pipSize = 3;
        const spacing = 4;

        for (let i = 0; i < this.maxActionPoints; i++) {
            const px = startX + i * spacing;
            const py = pipsY;
            
            // Empty pip border
            this.healthBar.lineStyle(1, 0x888888);
            this.healthBar.strokeRect(px, py, pipSize, pipSize);
            
            // Fill if active
            if (i < this.actionPoints) {
                this.healthBar.fillStyle(0x00ffff); // Cyan for AP
                this.healthBar.fillRect(px, py, pipSize, pipSize);
            }
        }
    }

    public destroy() {
        this.healthBar.destroy();
        this.visual.destroy();
        this.selectionBracket.destroy();
        
        const rapierManager = RapierManager.getInstance();
        if (rapierManager.world && this.body) {
            rapierManager.world.removeRigidBody(this.body);
        }
    }
}
