import Phaser from 'phaser';
import { MainScene } from '../scenes/MainScene';
import { Turret } from '../objects/Turret';
import { TurnPhase } from '../logic/TurnManager';
import { PROJECTILE_DATA } from '../objects/ProjectileTypes';
import { GameConfig } from '../config';

export class InputManager {
    private scene: MainScene;
    
    public draggingTurret: Turret | null = null;
    public dragStartPos: Phaser.Math.Vector2 | null = null;
    public dragCurrentPos: Phaser.Math.Vector2 | null = null;
    
    private readonly DRAG_SPEED_SCALE = 2.0;

    private isPanning: boolean = false;
    private panStart: Phaser.Math.Vector2 = new Phaser.Math.Vector2();

    constructor(scene: MainScene) {
        this.scene = scene;
    }

    public handleInput() {
        // Confirm Turn
        this.scene.input.keyboard?.on('keydown-SPACE', () => {
             if (this.scene.turnManager.currentPhase === TurnPhase.PLANNING) {
                 this.scene.executeTurn();
             }
         });

         // Camera Controls (Zoom)
         this.scene.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: any, _deltaX: number, deltaY: number, _deltaZ: number) => {
             const zoom = this.scene.cameras.main.zoom;
             const newZoom = Phaser.Math.Clamp(zoom - deltaY * 0.001, 0.1, 2.0);
             this.scene.cameras.main.setZoom(newZoom);
         });

         // Pinch State
         let initialPinchDistance = 0;
         let initialZoom = 1;
         
         // Prevent context menu
         this.scene.game.canvas.oncontextmenu = (e) => e.preventDefault();

         // POINTER DOWN
         this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
             // 1. Check UI
             const clickedUI = currentlyOver.some(obj => obj.getData('isUI'));
             if (clickedUI) return;

             if (this.scene.turnManager.currentPhase !== TurnPhase.PLANNING) {
                 // Even if not in planning, allow panning?
                 this.startPan(pointer);
                 return;
             }
             
             // 2. Check Turrets
             let clickedTurret: Turret | null = null;
             for (const p of this.scene.planets) {
                 for (const t of p.turretsList) {
                     const bounds = t.getBounds();
                     if (bounds.contains(pointer.worldX, pointer.worldY)) {
                         clickedTurret = t;
                         break;
                     }
                 }
                 if (clickedTurret) break;
             }
             
             if (clickedTurret) {
                 // INTERACT WITH TURRET
                 // Cancel any panning
                 this.isPanning = false;

                 // Selection Logic
                 if (this.scene.selectedTurret && this.scene.selectedTurret !== clickedTurret) {
                     this.scene.selectedTurret.setSelected(false);
                 }
                 this.scene.selectedTurret = clickedTurret;
                 this.scene.selectedTurret.setSelected(true);
                 this.scene.uiManager.updateWeaponSelectionUI();
     
                 // Prevent controlling AI turrets
                 const team = this.scene.teamManager.getTeam(clickedTurret.teamId!);
                 if (team && team.isAI) return;
     
                 // Check AP
                 if (!clickedTurret.armed && clickedTurret.actionPoints < 1) {
                      console.log("Not enough AP");
                      return;
                 }
     
                 this.draggingTurret = clickedTurret;
                 this.dragStartPos = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
                 this.dragCurrentPos = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
                 
                 // Refund if already armed
                 if (clickedTurret.armed) {
                      const stats = PROJECTILE_DATA[clickedTurret.projectileType];
                      clickedTurret.addActionPoints(stats.cost);
                 }
                 clickedTurret.setArmed(false);
             } else {
                 // CLICKED EMPTY SPACE -> DESELECT & START PAN
                  if (this.scene.selectedTurret) {
                      this.scene.selectedTurret.setSelected(false);
                      this.scene.selectedTurret = null;
                      this.scene.uiManager.updateWeaponSelectionUI();
                  }
                  
                  // Start Panning
                  this.startPan(pointer);
             }
         });

         // POINTER MOVE (Consolidated)
         this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
             // 1. PINCH ZOOM CHECK
             if (this.scene.input.pointer1.isDown && this.scene.input.pointer2.isDown) {
                  // Pinching
                  const dist = Phaser.Math.Distance.Between(
                      this.scene.input.pointer1.x, this.scene.input.pointer1.y,
                      this.scene.input.pointer2.x, this.scene.input.pointer2.y
                  );

                  if (initialPinchDistance === 0) {
                      initialPinchDistance = dist;
                      initialZoom = this.scene.cameras.main.zoom;
                  } else {
                      const scale = dist / initialPinchDistance;
                      const newZoom = Phaser.Math.Clamp(initialZoom * scale, 0.2, 3.0);
                      this.scene.cameras.main.setZoom(newZoom);
                  }
                  
                  // Disable panning while pinching
                  this.isPanning = false; 
                  return; // Skip other logic
             } else {
                  // Reset pinch state if not pinching
                  initialPinchDistance = 0;
             }

             // 2. DRAG / PAN LOGIC
             if (this.draggingTurret) {
                 this.dragCurrentPos?.set(pointer.worldX, pointer.worldY);
             } else if (this.isPanning) {
                 // Pan Logic
                 const currentPos = new Phaser.Math.Vector2(pointer.x, pointer.y);
                 const diff = this.panStart.clone().subtract(currentPos);
                 
                 // Adjust for zoom
                 diff.scale(1 / this.scene.cameras.main.zoom);
                 
                 this.scene.cameras.main.scrollX += diff.x;
                 this.scene.cameras.main.scrollY += diff.y;
                 
                 // Reset start for next frame (delta movement)
                 this.panStart.set(pointer.x, pointer.y);
             }
         });
     
         // POINTER UP
         this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
             this.isPanning = false;

             if (this.draggingTurret && this.dragStartPos && this.dragCurrentPos) {
                 const start = this.draggingTurret.position;
                 const end = { x: pointer.worldX, y: pointer.worldY };
                 
                 const dx = start.x - end.x;
                 const dy = start.y - end.y;
                 const len = Math.sqrt(dx*dx + dy*dy);
     
                 if (len > 10) { 
                      const stats = PROJECTILE_DATA[this.draggingTurret.projectileType];
                      const cost = stats.cost;
     
                      if (this.draggingTurret.armed) { // Should be false here usually
                          // Safety fallback
                          this.calculateAndArm(dx, dy);
                      } else {
                          // Try to arm
                          if (this.draggingTurret.actionPoints >= cost) {
                              this.draggingTurret.consumeActionPoints(cost);
                              this.calculateAndArm(dx, dy);
                          } else {
                              console.log("Not enough energy!");
                              this.scene.tweens.add({
                                  targets: this.draggingTurret.visual,
                                  alpha: 0.5,
                                  yoyo: true,
                                  duration: 100,
                                  repeat: 3
                              });
                              this.draggingTurret.setArmed(false);
                          }
                      }
                 } else {
                      // Cancel Drag (Click?)
                      if (this.draggingTurret.armed) {
                          // Refund AP (Shouldn't happen with new logic but safe to keep)
                          const stats = PROJECTILE_DATA[this.draggingTurret.projectileType];
                          this.draggingTurret.addActionPoints(stats.cost);
                      }
                      this.draggingTurret.setArmed(false);
                 }
                 
                 this.draggingTurret = null;
                 this.dragStartPos = null;
                 this.dragCurrentPos = null;
             }
         });
    }

    private startPan(pointer: Phaser.Input.Pointer) {
        this.isPanning = true;
        this.panStart.set(pointer.x, pointer.y);
    }

    private calculateAndArm(dx: number, dy: number) {
        if (!this.draggingTurret) return;

        const vx = dx * this.DRAG_SPEED_SCALE;
        const vy = dy * this.DRAG_SPEED_SCALE;
        
        let finalVx = vx;
        let finalVy = vy;

        const currentSpeed = Math.sqrt(vx*vx + vy*vy);
        if (currentSpeed > GameConfig.MAX_PROJECTILE_SPEED) {
            const scale = GameConfig.MAX_PROJECTILE_SPEED / currentSpeed;
            finalVx *= scale;
            finalVy *= scale;
        }

        this.draggingTurret.setArmed(true, { x: finalVx, y: finalVy });
    }
}
