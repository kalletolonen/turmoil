import RAPIER from '@dimforge/rapier2d-compat';

export class RapierManager {
  private static instance: RapierManager;
  public world: RAPIER.World | null = null;
  public eventQueue: RAPIER.EventQueue | null = null;
  private isInitialized = false;

  // Physics settings
  public static readonly GRAVITY = { x: 0, y: 0 }; // Space, so no global gravity usually (or use { x: 0, y: 0 })

  private constructor() {}

  public static getInstance(): RapierManager {
    if (!RapierManager.instance) {
      RapierManager.instance = new RapierManager();
    }
    return RapierManager.instance;
  }

  /**
   * Initialize the WASM module. Must be called before creating a world.
   */
  public async init(): Promise<void> {
    if (this.isInitialized) return;
    
    await RAPIER.init();
    this.world = new RAPIER.World(RapierManager.GRAVITY);
    this.eventQueue = new RAPIER.EventQueue(true);
    this.isInitialized = true;
    // console.log('Rapier Physics Initialized');
  }

  /**
   * Advances the physics simulation by one step.
   * @param dt Delta time in seconds (optional, Rapier uses fixed timestep internally usually)
   */
  public step(): void {
    if (!this.world) return;
    this.world.step(this.eventQueue || undefined);
  }

  /**
   * Drains the collision events from the event queue and calls the provided callback for each event.
   */
  public drainCollisionEvents(callback: (handle1: number, handle2: number, started: boolean) => void) {
      if (!this.eventQueue) return;
      this.eventQueue.drainCollisionEvents(callback);
  }

  /**
   * Creates a separate World instance that is a copy of the current world state.
   * Used for trajectory prediction.
   */
  public createPredictionWorld(): RAPIER.World | null {
    if (!this.world) return null;

    const snapshot = this.world.takeSnapshot();
    const newWorld = RAPIER.World.restoreSnapshot(snapshot);
    return newWorld;
  }
  
  public get bodyCount(): number {
      return this.world ? this.world.bodies.len() : 0;
  }

  /**
   * Retrieves position and rotation for all bodies to drive rendering.
   * Optimized to minimize object creation? For now, returns new array.
   */
  public getAllBodyData(): { x: number, y: number, rotation: number, type?: string }[] {
      if (!this.world) return [];
      
      const data: { x: number, y: number, rotation: number, type?: string }[] = [];
      const bodies = this.world.bodies;
      
      bodies.forEach((body) => {
          const translation = body.translation();
          const rotation = body.rotation();
          // Rapier 2D returns rotation in radians
          const userData = (body as any).userData;
          data.push({ x: translation.x, y: translation.y, rotation, type: userData?.type });
      });
      
      return data;
  }
}
