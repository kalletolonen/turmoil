import Phaser from 'phaser';
import { RapierManager } from '../physics/RapierManager';
import { TurnManager, TurnPhase } from '../logic/TurnManager';
import { FleetRenderer } from '../renderer/FleetRenderer';
import { SeededRNG } from '../logic/SeededRNG';
import { Planet } from '../objects/Planet';
import { Debris } from '../objects/Debris';
import { Projectile } from '../objects/Projectile';
import { Turret } from '../objects/Turret';
import { GravitySystem } from '../logic/GravitySystem';
import { TeamManager } from '../logic/TeamManager';
import { AIManager } from '../logic/AIManager';
import { ProjectileType, PROJECTILE_DATA } from '../objects/ProjectileTypes';
import { UIManager } from '../ui/UIManager';
import { InputManager } from '../input/InputManager';
import { TrajectorySystem } from '../logic/TrajectorySystem';
import { FXManager } from '../logic/FXManager';

export class MainScene extends Phaser.Scene {
  public rapierManager: RapierManager;
  public teamManager: TeamManager;
  public aiManager: AIManager;
  public turnManager: TurnManager;
  private fleetRenderer!: FleetRenderer;
  private rng: SeededRNG;
  public planets: Planet[] = [];
  private debris: Debris[] = [];
  private initialized = false;
  private graphics!: Phaser.GameObjects.Graphics;
  private projectiles: Projectile[] = [];
  
  
  public selectedTurret: Turret | null = null;
  
  public isDevMode: boolean = true;
  public showAITrajectories: boolean = false;
  
  
  public uiManager!: UIManager;
  public inputManager!: InputManager;
  public trajectorySystem!: TrajectorySystem;

  constructor() {
    super('MainScene');
    this.rapierManager = RapierManager.getInstance();
    this.teamManager = new TeamManager();
    this.aiManager = new AIManager();
    this.turnManager = new TurnManager();
    this.rng = new SeededRNG(12345);
  }

  preload() {
    // Assets would go here
  }

  async create() {
    // 1. Init Physics
    await this.rapierManager.init();
    
    // 2. Setup Renderer
    // 2. Setup Renderer
    this.fleetRenderer = new FleetRenderer(this); // Pass 'this' as scene
    this.graphics = this.add.graphics();
    this.graphics.setDepth(1000);
    
    // ...

    this.uiManager = new UIManager(this);
    this.uiManager.createWeaponSelectionUI();
    this.uiManager.createDebugUI();
    
    // 3. Init AI Physics (after Rapier is ready)
    this.aiManager.init();

    // Generate all textures
    this.generateTextures();
    
    // Init FXManager
    FXManager.init(this);

    // 3. Create Debug Bodies (Visual Test)
    if (this.rapierManager.world) {

        // Initialize Teams
        const redTeam = this.teamManager.addTeam({ id: 'red', name: 'Red Faction', color: 0xff0000 });
        const greenTeam = this.teamManager.addTeam({ id: 'green', name: 'Green Faction', color: 0x00ff00, isAI: true });

        // Spawn Planets with Overlap Prevention
        const MAX_RETRIES = 50;
        const MIN_SEPARATION = 120; // Increased padding for more interesting trajectories

        for (let i = 0; i < 6; i++) { // Increased planet count
            let placed = false;
            let attempts = 0;

            while (!placed && attempts < MAX_RETRIES) {
                attempts++;
                
                const radius = this.rng.nextRange(25, 70); // Slightly smaller range for better fit
                const x = this.rng.nextRange(80, 720);
                const y = this.rng.nextRange(80, 520);
                
                // Check overlap with existing planets
                let overlap = false;
                for (const other of this.planets) {
                    const otherPos = other.position;
                    const dist = Phaser.Math.Distance.Between(x, y, otherPos.x, otherPos.y);
                    const minDist = radius + other.radiusValue + MIN_SEPARATION; 
                    
                    if (dist < minDist) {
                        overlap = true;
                        break;
                    }
                }

                if (!overlap) {
                    // 30% chance for a completely neutral planet (obstacle only)
                    const isNaturalNeutral = this.rng.nextFloat() < 0.3;
                    
                    let teamId = null;
                    let color = 0x888888; // Default Grey
                    let turretCount = 0;

                    if (!isNaturalNeutral) {
                        // Assign Team based on X position for gameplay balance
                        if (x < 400) {
                            teamId = redTeam.id;
                        } else {
                            teamId = greenTeam.id;
                        }
                        turretCount = this.rng.nextInt(2, 6);
                    } else {
                        color = 0x666666; // Darker Grey for natural obstacles
                    }

                    const planet = new Planet(this, x, y, radius, color, teamId);
                    
                    if (teamId === redTeam.id) redTeam.addPlanet(planet);
                    if (teamId === greenTeam.id) greenTeam.addPlanet(planet);
                    
                    if (turretCount > 0) {
                        planet.spawnTurrets(this.rng, turretCount);
                    }

                    this.planets.push(planet);
                    placed = true;
                }
            }
            
            if (!placed) {
                console.warn(`Could not place planet ${i} after ${MAX_RETRIES} attempts.`);
            }
        }

        // Spawn Debris
        // for (let i = 0; i < 20; i++) {
        //     const x = this.rng.nextRange(50, 750);
        //     const y = this.rng.nextRange(50, 550);
        //     const radius = this.rng.nextRange(3, 8);
        //     this.debris.push(new Debris(this, x, y, radius));
        // }
    }


    this.turnManager.onPhaseChange = (phase) => {
        // UI Update could happen here
        this.add.text(10, 10, `Phase: ${phase}`, { color: '#0f0' })
            .setName('phaseTextTemp')
            .setDepth(100)
            .setScrollFactor(0)
            .destroy(); 

        if (phase === TurnPhase.PLANNING) {
            this.teamManager.resetResources(); // Kept for AI logic? Or remove entirely?
            // User requested "omit faction energy". So we should ignore resources.
            // But AI might use it? Assuming I need to check AI logic separately.
            
            this.projectiles.forEach(p => p.destroy());
            this.projectiles = [];
            this.graphics.clear();

            // AP Accumulation Phase
            this.planets.forEach(planet => {
                const controllerId = planet.getControllerTeamId();
                planet.turretsList.forEach(turret => {
                    let apGain = 1;
                    if (controllerId && turret.teamId === controllerId) {
                        apGain = 2;
                    }
                    turret.addActionPoints(apGain);
                });
            });

            // TRIGGER AI
            // We give it a slight delay so it doesn't happen INSTANTLY after resolution, 
            // but for now synchronous is fine.
            const teams = this.teamManager.getTeams();
            const aiTeams = teams.filter(t => t.isAI);
            const humanTeams = teams.filter(t => !t.isAI);
            
            aiTeams.forEach(aiTeam => {
                this.aiManager.calculateMoves(aiTeam, humanTeams, this.planets);
            });
             // this.updateTeamUI(); // Removed
        }
    };
    
    // UI Text
    this.add.text(10, 10, 'Press SPACE to Execute Turn', { fontSize: '16px', color: '#ffffff' }).setScrollFactor(0);
    this.data.set('phaseText', this.add.text(10, 30, 'Phase: PLANNING', { fontSize: '16px', color: '#00ff00' }).setScrollFactor(0));

     this.initialized = true;

     // Trigger initial state if we missed the event
     if (this.turnManager.currentPhase === TurnPhase.PLANNING) {
          // Re-run the planning setup manually
          this.teamManager.resetResources();
          // this.updateTeamUI();
          
          const teams = this.teamManager.getTeams();
          const aiTeams = teams.filter(t => t.isAI);
          
          aiTeams.forEach(aiTeam => {
              const enemies = teams.filter(t => t.id !== aiTeam.id);
              this.aiManager.calculateMoves(aiTeam, enemies, this.planets);
          });
           // this.updateTeamUI();
     }

     this.uiManager = new UIManager(this);
     this.uiManager.createWeaponSelectionUI();
     this.uiManager.createDebugUI();
     
     this.inputManager = new InputManager(this);
     this.inputManager.handleInput();
     
     // Handle Audio Context Resume
     this.input.on('pointerdown', () => {
         const soundManager = this.sound as Phaser.Sound.WebAudioSoundManager;
         if (soundManager.context && soundManager.context.state === 'suspended') {
             soundManager.context.resume();
         }
     });

     this.trajectorySystem = new TrajectorySystem(this);
  }

  update(_time: number, delta: number) {
    if (!this.initialized) return;

    // Convert delta to ms
    const shouldStep = this.turnManager.update(delta);

    if (shouldStep) {
        GravitySystem.applyGravity(this.projectiles, this.planets);
        this.rapierManager.step();
        this.projectiles.forEach(p => p.update(this.planets));
    }

    if (this.turnManager.currentPhase === TurnPhase.PLANNING) {
        this.uiManager.updateWeaponSelectionUI();
    }


    // Update Renderer
    const bodies = this.rapierManager.getAllBodyData();
    this.fleetRenderer.update(bodies);
    
    // Update Debris visuals
    this.debris.forEach(d => d.update());

    // List of pending destruction tasks
    const pendingDestruction: (() => void)[] = [];

    // Update FX
    FXManager.getInstance().update(delta);

    // Handle Collisions
    this.rapierManager.drainCollisionEvents((handle1, handle2, started) => {
        if (!started) return;
        // console.log(`Collision Detected: ${handle1} <-> ${handle2}`);

        // Find bodies by handle
        // Rapier events return collider handles
        const collider1 = this.rapierManager.world?.getCollider(handle1);
        const collider2 = this.rapierManager.world?.getCollider(handle2);

        if (!collider1 || !collider2) {
             console.log("Could not find colliders for handles:", handle1, handle2);
             return;
        }
        
        const body1 = collider1.parent();
        const body2 = collider2.parent();

        if (!body1 || !body2) {
            console.log("Colliders have no parent bodies");
            return;
        }

        const data1 = (body1 as any).userData;
        const data2 = (body2 as any).userData;
        
        // console.log("Collision userData:", data1, data2);

        // Check Collision Types
        
        // 1. Projectile vs Turret
        if ((data1?.type === 'projectile' && data2?.type === 'turret') || 
            (data2?.type === 'projectile' && data1?.type === 'turret')) {
            
            const pBody = data1.type === 'projectile' ? body1 : body2;
            const tBody = data1.type === 'turret' ? body1 : body2;
            
            pendingDestruction.push(() => this.handleProjectileHitTurret(pBody, tBody));
        }
        
        // 2. Projectile vs Planet
        else if ((data1?.type === 'projectile' && data2?.type === 'planet') || 
                 (data2?.type === 'projectile' && data1?.type === 'planet')) {
            
            const pBody = data1.type === 'projectile' ? body1 : body2;
            pendingDestruction.push(() => this.handleProjectileHitPlanet(pBody));
        }
        
        // 3. Projectile vs Projectile
        else if (data1?.type === 'projectile' && data2?.type === 'projectile') {
            pendingDestruction.push(() => this.handleProjectileHitProjectile(body1, body2));
        }
    });

    // Execute pending destructions
    pendingDestruction.forEach(fn => fn());
    
    // Prediction handling during PLANNING
    if (this.turnManager.currentPhase === TurnPhase.PLANNING) {
        this.graphics.clear();
        
        this.trajectorySystem.predictTrajectory(this.graphics);
    }
    
    // Update Phase Text
    const phaseText = this.data.get('phaseText') as Phaser.GameObjects.Text;
    if (phaseText) {
        phaseText.setText(`Phase: ${this.turnManager.currentPhase}`);
    }
  }

  private handleProjectileHitTurret(projectileBody: any, turretBody: any) {
      const projParams = projectileBody.userData;
      const turretParams = turretBody.userData;
      
      const projectileVisual = projParams.visual as Projectile;
      const turretObj = turretParams.parent as Turret;
      
      if (projectileVisual && turretObj) {
          // Visuals
          const team = this.teamManager.getTeam(projectileVisual.teamId || '');
          const color = team ? team.color : 0xffffff;
          this.createExplosion(projectileVisual.x, projectileVisual.y, color);

          const destroyed = turretObj.takeDamage(projectileVisual.damage);
          projectileVisual.destroy();
          this.removeProjectile(projectileVisual);

          if (destroyed) {
              for (const planet of this.planets) {
                  const tIndex = planet.turretsList.indexOf(turretObj);
                  if (tIndex > -1) {
                      planet.turretsList.splice(tIndex, 1);
                      // Cache position before destroy
                      const tx = turretObj.position.x;
                      const ty = turretObj.position.y;
                      
                      turretObj.destroy();
                      this.createExplosion(tx, ty, 0xffaa00, 30); // Use cached position
                      break;
                  }
              }
          }
      }
  }

  private handleProjectileHitPlanet(projectileBody: any) {
      const projParams = projectileBody.userData;
      const projectileVisual = projParams.visual as Projectile;
      
      if (projectileVisual) {
          const team = this.teamManager.getTeam(projectileVisual.teamId || '');
          const color = team ? team.color : 0xffffff;
          
          // Use FX Manager for visual explosion
          FXManager.getInstance().createExplosion(projectileVisual.x, projectileVisual.y, color);
          
          // Check if we hit a planet
          const hitPlanet = this.planets.find(p => p.id === (projectileBody?.userData?.parent as Planet)?.id) || 
                            this.planets.find(p => Phaser.Math.Distance.Between(projectileVisual.x, projectileVisual.y, p.position.x, p.position.y) < p.radiusValue + 20); // Fallback

          if (hitPlanet) {
              const stats = PROJECTILE_DATA[projectileVisual.projectileType];
              const radius = stats ? stats.explosionRadius : 15;
              
              if (radius > 0) {
                 hitPlanet.takeDamage(projectileVisual.x, projectileVisual.y, radius);
              }
          }

          // Colonizer Effect
          if (projectileVisual.projectileType === ProjectileType.COLONIZER && hitPlanet) {
              // Calculate angle from planet center to impact point
              const angle = Math.atan2(projectileVisual.y - hitPlanet.position.y, projectileVisual.x - hitPlanet.position.x);
              hitPlanet.addTurretAtAngle(angle, projectileVisual.teamId);
          }

          projectileVisual.destroy();
          this.removeProjectile(projectileVisual);
      }
  }

  private handleProjectileHitProjectile(body1: any, body2: any) {
      const p1 = body1.userData.visual as Projectile;
      const p2 = body2.userData.visual as Projectile;
      
      if (p1) {
          const team = this.teamManager.getTeam(p1.teamId || '');
          const color = team ? team.color : 0xffffff;
          this.createExplosion(p1.x, p1.y, color);
          p1.destroy();
          this.removeProjectile(p1);
      }
      if (p2) {
          const team = this.teamManager.getTeam(p2.teamId || '');
          const color = team ? team.color : 0xffffff;
          this.createExplosion(p2.x, p2.y, color);
          p2.destroy();
          this.removeProjectile(p2);
      }
  }
  
  private createExplosion(x: number, y: number, color: number, radius: number = 15) {
      // Visual Explosion (Sprite)
      const circle = this.add.image(x, y, 'particle');
      circle.setTint(color);
      circle.setDepth(2000);
      
      const targetScale = radius / 4; // Base 8x8 -> radius 4. 
      circle.setScale(0.1);

      this.tweens.add({
          targets: circle,
          scale: targetScale,
          alpha: 0,
          duration: 300,
          onComplete: () => circle.destroy()
      });
  }
  
  private removeProjectile(p: Projectile) {
        const pIndex = this.projectiles.indexOf(p);
        if (pIndex > -1) this.projectiles.splice(pIndex, 1);
  }


  
  public fireProjectiles() {
       this.planets.forEach(p => {
         p.turretsList.forEach(t => {
             if (t.armed && t.aimVector) {
                 const angle = Math.atan2(t.aimVector.y, t.aimVector.x);
                 const speed = Math.sqrt(t.aimVector.x * t.aimVector.x + t.aimVector.y * t.aimVector.y);
                 
                 const pos = t.position;
                 const tipLen = 15;
                  const tipX = pos.x + Math.cos(angle) * tipLen;
                  const tipY = pos.y + Math.sin(angle) * tipLen;
                  
                  const proj = new Projectile(this, tipX, tipY, angle, speed, undefined, t.projectileType, t.teamId);
                  if (t.teamId) {
                     // Color projectile based on team if we want?
                     // proj.setTint ...
                     const team = this.teamManager.getTeam(t.teamId);
                     if (team) proj.setTint(team.color);
                 }
                 this.projectiles.push(proj);
             }
         });
     });
  }





  private generateTextures() {
      // 1. Projectile (16x16 Yellow Circle)
      if (!this.textures.exists('projectile')) {
          const g = this.make.graphics({ x: 0, y: 0 });
          g.fillStyle(0xffff00);
          g.fillCircle(8, 8, 5);
          g.generateTexture('projectile', 16, 16);
          g.destroy();
      }

      // 2. Ship (32x32 Green Triangle)
      if (!this.textures.exists('ship')) {
          const g = this.make.graphics({ x: 0, y: 0 });
          g.lineStyle(2, 0x00ff00);
          g.fillStyle(0x000000);
          
          g.beginPath();
          g.moveTo(16, 6);   // Top (shifted relative to center)
          g.lineTo(24, 26);  // Bottom Right
          g.lineTo(16, 22);  // Bottom Center (notch)
          g.lineTo(8, 26);   // Bottom Left
          g.closePath();
          
          g.fillPath();
          g.strokePath();
          
          g.generateTexture('ship', 32, 32);
          g.destroy();
      }

      // 3. Turret Base (32x32 White Box)
      if (!this.textures.exists('turret_base')) {
          const g = this.make.graphics({ x: 0, y: 0 });
          g.fillStyle(0xffffff);
          g.fillRect(6, 6, 20, 20);
          g.generateTexture('turret_base', 32, 32);
          g.destroy();
      }

      // 4. Debris (16x16 Grey Circle)
      if (!this.textures.exists('debris')) {
          const g = this.make.graphics({ x: 0, y: 0 });
          g.fillStyle(0x888888);
          g.fillCircle(8, 8, 5);
          g.generateTexture('debris', 16, 16);
          g.destroy();
      }

      // 5. Particle (8x8 White Circle)
      if (!this.textures.exists('particle')) {
          const g = this.make.graphics({ x: 0, y: 0 });
          g.fillStyle(0xffffff);
          g.fillCircle(4, 4, 3);
          g.generateTexture('particle', 8, 8);
          g.destroy();
      }

      // 6. 1x1 White Pixel
      if (!this.textures.exists('white_1x1')) {
          const g = this.make.graphics({ x: 0, y: 0 });
          g.fillStyle(0xffffff);
          g.fillRect(0, 0, 1, 1);
          g.generateTexture('white_1x1', 1, 1);
          g.destroy();
      }
  }
}
