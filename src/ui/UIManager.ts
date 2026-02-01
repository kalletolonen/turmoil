import Phaser from 'phaser';
import { MainScene } from '../scenes/MainScene';
import { ProjectileType, PROJECTILE_DATA } from '../objects/ProjectileTypes';

import { TurnPhase } from '../logic/TurnManager';

export class UIManager {
    private scene: MainScene;
    private uiScene: Phaser.Scene;
    private weaponUIContainer: Phaser.GameObjects.Container | null = null;

    constructor(scene: MainScene, uiScene: Phaser.Scene) {
        this.scene = scene;
        this.uiScene = uiScene;
    }

    public createWeaponSelectionUI() {
        // Create a container for the bottom UI
        const width = this.uiScene.scale.width;
        const height = 120;
        const y = this.uiScene.scale.height - height;
        
        this.weaponUIContainer = this.uiScene.add.container(0, y);
        this.weaponUIContainer.setScrollFactor(0);
        this.weaponUIContainer.setDepth(2000);
        
        // Background (Sprite)
        const bg = this.uiScene.add.image(width/2, height/2, 'white_1x1');
        bg.setDisplaySize(width, height);
        bg.setTint(0x222222);
        bg.setAlpha(0.9);
        this.weaponUIContainer.add(bg);
        
        const types = [ProjectileType.BASIC, ProjectileType.GIGA_BLASTER, ProjectileType.COLONIZER, ProjectileType.RADAR, ProjectileType.DEFENDER];
        
        // Dynamic Spacing Calculation
        // We have 5 items. We want some padding on sides.
        // Total Width = Scale Width
        // Max button width = 140 (as before).
        // Max spacing = 150.
        
        const count = types.length;
        const availableWidth = width;
        const maxButtonWidth = 140;
        
        // Calculate fit
        let itemWidth = maxButtonWidth;
        let spacing = itemWidth + 10;
        
        // If (count * spacing) > availableWidth, shrink
        if (count * spacing > availableWidth) {
             // Fit to screen
             spacing = availableWidth / count;
             itemWidth = spacing - 10; // 5px gap each side
        }
        
        // Center the group
        const totalGroupWidth = count * spacing;
        const startX = (width - totalGroupWidth) / 2 + (spacing / 2);
        
        const buttonHeight = Math.min(100, itemWidth * 0.8); // Adjust height ratio slightly if really small

        types.forEach((type, i) => {
            const stats = PROJECTILE_DATA[type];
            
            const boxX = startX + i * spacing;
            const boxY = height / 2;
            
            // Button Background
            const button = this.uiScene.add.image(boxX, boxY, 'white_1x1');
            button.setDisplaySize(itemWidth, buttonHeight);
            button.setTint(0x000000); // Black background
            button.setInteractive({ useHandCursor: true });
            button.setName(`btn_${type}`); // Identify for update
            button.setData('isUI', true);

            // Selection Frame (Stroke)
            const frame = this.uiScene.add.rectangle(boxX, boxY, itemWidth, buttonHeight);
            frame.setStrokeStyle(3, 0x4444ff); // Blue width 3
            frame.setFillStyle(0, 0); // Transparent fill
            frame.setVisible(false);
            frame.setName(`frame_${type}`);
            this.weaponUIContainer?.add(frame);
            
            // Click Handler
            button.on('pointerdown', () => {
                if (this.scene.selectedTurret && this.scene.turnManager.currentPhase === TurnPhase.PLANNING) {
                    this.handleWeaponChange(type);
                }
            });
            
            this.weaponUIContainer?.add(button);
            
            // Icon/Color
            let icon: Phaser.GameObjects.Image;
            let iconSize: number;
            
            if (stats.icon) {
                // Use custom icon
                icon = this.uiScene.add.image(boxX, boxY - 15, stats.icon);
                icon.setTint(0xffffff); // No tint for custom icon
                iconSize = Math.min(50, itemWidth * 0.5); // Larger for custom icon
            } else {
                // Fallback to particle
                icon = this.uiScene.add.image(boxX, boxY - 15, 'particle');
                icon.setTint(stats.color);
                iconSize = Math.min(30, itemWidth * 0.3); // Slightly larger for particles too
            }
            
            icon.setDisplaySize(iconSize, iconSize);
            this.weaponUIContainer?.add(icon);
            
            // Text
            // Scale font size based on width
            const fontSize = Math.max(10, Math.min(14, itemWidth / 10));
            const nameText = this.uiScene.add.text(boxX, boxY + 5, stats.name, { fontSize: `${fontSize}px`, color: '#fff' }).setOrigin(0.5, 0);
            const costText = this.uiScene.add.text(boxX, boxY + 20, `Cost: ${stats.cost}`, { fontSize: `${Math.max(10, fontSize - 2)}px`, color: '#aaa' }).setOrigin(0.5, 0);
            
            // Allow text to wrap if too long for button? 
            // Better: truncate or just trust scaling. 
            // "Giga Blaster" is long.
            nameText.setWordWrapWidth(itemWidth - 4);
            
            this.weaponUIContainer?.add(nameText);
            this.weaponUIContainer?.add(costText);
        });
        
        this.weaponUIContainer.setVisible(false);
    }

    public updateWeaponSelectionUI() {
        if (!this.weaponUIContainer) return;
        
        if (!this.scene.selectedTurret) {
            this.weaponUIContainer.setVisible(false);
            return;
        }
        
        // Only show for player owned turrets
        const team = this.scene.teamManager.getTeam(this.scene.selectedTurret.teamId!);
        if (team && team.isAI) {
             this.weaponUIContainer.setVisible(false);
             return;
        }
 
        this.weaponUIContainer.setVisible(true);
        
        const types = [ProjectileType.BASIC, ProjectileType.GIGA_BLASTER, ProjectileType.COLONIZER, ProjectileType.RADAR, ProjectileType.DEFENDER];
        
        types.forEach(type => {
            const button = this.weaponUIContainer?.getByName(`btn_${type}`) as Phaser.GameObjects.Image;
            if (button) {
                const stats = PROJECTILE_DATA[type];
                const isSelected = this.scene.selectedTurret?.projectileType === type;
                
                const frame = this.weaponUIContainer?.getByName(`frame_${type}`) as Phaser.GameObjects.Rectangle;
                
                // Highlight selection
                if (isSelected) {
                     frame?.setVisible(true);
                     button.setTint(0x000000); // Keep black
                } else {
                     frame?.setVisible(false);
                     button.setTint(0x000000); // Back to black
                }
                
                // Check affordability
                // If already owned, cost is 0 (refund logic handled on switch)
                let affordable = true;
                if (!isSelected) {
                     // Calculate buying power
                     let currentReserved = 0;
                     if (this.scene.selectedTurret?.projectileType === ProjectileType.RADAR) {
                         // Radar cost is sunken. Buying power is just current AP.
                         currentReserved = 0; 
                     } else {
                         // Normal weapon: If armed, we get refund.
                         currentReserved = this.scene.selectedTurret?.armed ? PROJECTILE_DATA[this.scene.selectedTurret.projectileType].cost : 0;
                     }

                     const buyingPower = this.scene.selectedTurret!.actionPoints + currentReserved;
                     if (buyingPower < stats.cost) {
                         affordable = false;
                     }
                }
                
                button.setAlpha(affordable ? 1 : 0.1); // Darker when disabled
                if (affordable) {
                    button.setInteractive();
                } else {
                    button.disableInteractive();
                    button.setTint(0x550000); // Reddish for disabled
                    // button.setStrokeStyle(2, 0xff0000); // Red stroke for disabled (unsupported)
                }
            }
        });
    }

    private handleWeaponChange(newType: ProjectileType) {
        if (!this.scene.selectedTurret) return;
        const team = this.scene.teamManager.getTeam(this.scene.selectedTurret.teamId!);
        if (!team) return;
  
        const currentStats = PROJECTILE_DATA[this.scene.selectedTurret.projectileType];
        const newStats = PROJECTILE_DATA[newType];
        
        if (this.scene.selectedTurret.projectileType === newType) return;
        
        const turret = this.scene.selectedTurret;
        
        // 1. Save AIM state
        const wasArmed = turret.armed;
        const savedVector = turret.aimVector;

        // 2. Refund Logic (if Armed and NOT Radar)
        // Note: Radar is never "armed", so we don't refund it here (assumed sunk cost)
        if (turret.projectileType !== ProjectileType.RADAR) {
             if (wasArmed) {
                  turret.addActionPoints(currentStats.cost);
                  turret.setArmed(false);
             }
        }
        
        // 3. Handle Switch
        if (newType === ProjectileType.RADAR) {
             // Strict Check: Must afford 
             if (turret.actionPoints >= newStats.cost) {
                 turret.consumeActionPoints(newStats.cost);
                 turret.projectileType = newType;
             } else {
                 console.log("Cannot afford Radar - Reverting refund if needed");
                 // If we refunded above, we need to revert that state effectively cancelling the action
                 if (wasArmed) {
                     // Re-lock the AP we just refunded
                     turret.consumeActionPoints(currentStats.cost);
                     turret.setArmed(true, savedVector ?? undefined);
                 }
                 return; // Abort switch
             }
        } else {
             // Normal Weapon Switch
             turret.projectileType = newType;
             
             // Optional Re-Arm Logic
             if (wasArmed && savedVector) {
                 if (turret.actionPoints >= newStats.cost) {
                     turret.consumeActionPoints(newStats.cost);
                     turret.setArmed(true, savedVector);
                 } else {
                     console.log("Not enough AP to maintain shot with new weapon");
                     // We leave it unarmed, but type is switched. AP refunded.
                 }
             }
        }
        
        // Visual update
        this.updateWeaponSelectionUI();
    }

    public createFireButton() {
        const width = this.uiScene.scale.width;
        const height = this.uiScene.scale.height;

        // Bottom Right
        const btnRadius = 40;
        const x = width - btnRadius - 20;
        const y = height - btnRadius - 140; // Above weapon selector (120 height)

        const container = this.uiScene.add.container(x, y);
        container.setScrollFactor(0);
        container.setDepth(2000);

        const circle = this.uiScene.add.circle(0, 0, btnRadius, 0xff0000);
        circle.setStrokeStyle(2, 0xffffff);
        circle.setInteractive({ useHandCursor: true });
        
        const text = this.uiScene.add.text(0, 0, 'FIRE!', { 
            fontSize: '18px', 
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        container.add([circle, text]);

        circle.on('pointerdown', () => {
            if (this.scene.turnManager.currentPhase === TurnPhase.PLANNING) {
                this.scene.executeTurn();
            }
        });
        
        // Add hover effect
        circle.on('pointerover', () => circle.setFillStyle(0xff4444));
        circle.on('pointerout', () => circle.setFillStyle(0xff0000));
    }

    public createDebugUI() {
        if (!this.scene.isDevMode) return;

        const x = 10;
        const y = 80;
        
        const container = this.uiScene.add.container(x, y);
        container.setScrollFactor(0);
        container.setDepth(2000); // Above other UI?

        const bg = this.uiScene.add.image(0, 0, 'white_1x1');
        bg.setDisplaySize(150, 40);
        bg.setTint(0x000000);
        bg.setAlpha(0.5);
        bg.setOrigin(0);
        container.add(bg);

        const text = this.uiScene.add.text(10, 10, 'Toggle AI Traj (OFF)', { fontSize: '12px', color: '#ffffff' });
        container.add(text);

        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => {
             this.scene.showAITrajectories = !this.scene.showAITrajectories;
             text.setText(`Toggle AI Traj (${this.scene.showAITrajectories ? 'ON' : 'OFF'})`);
             text.setColor(this.scene.showAITrajectories ? '#00ff00' : '#ffffff');
        });

        // Max AP Toggle
        const maxApBg = this.uiScene.add.image(0, 50, 'white_1x1');
        maxApBg.setDisplaySize(150, 40);
        maxApBg.setTint(0x000000);
        maxApBg.setAlpha(0.5);
        maxApBg.setOrigin(0);
        container.add(maxApBg);
        
        const maxApText = this.uiScene.add.text(10, 60, 'Max AP (Selected)', { fontSize: '12px', color: '#ffffff' });
        container.add(maxApText);
        
        maxApBg.setInteractive({ useHandCursor: true });
        maxApBg.on('pointerdown', () => {
             if (this.scene.selectedTurret) {
                 // Set high AP, ignoring clamp? 
                 // Turret.addActionPoints clamps to max.
                 // We might need to force it or temporarily increase max?
                 // Let's force it directly if property is public? It is public (implied).
                 // Wait, addActionPoints implementation:
                 // "if (this.actionPoints > this.maxActionPoints) this.actionPoints = this.maxActionPoints;"
                 // So we need to increase max first? Or just set it and assume no update checks it immediately?
                 // Or just set maxActionPoints to 10 too?
                 this.scene.selectedTurret.maxActionPoints = 10; 
                 this.scene.selectedTurret.actionPoints = 10;
                 this.scene.selectedTurret.updateVisuals(); // Visual update
                 console.log("Maxed AP for selected turret");
             }
        });
    }
}
