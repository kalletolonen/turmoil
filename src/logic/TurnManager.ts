export enum TurnPhase {
  PLANNING = 'PLANNING',
  EXECUTION = 'EXECUTION',
  RESOLUTION = 'RESOLUTION'
}

export class TurnManager {
  public currentPhase: TurnPhase = TurnPhase.PLANNING;
  private executionTimer: number = 0;
  private readonly EXECUTION_DURATION_MS = 5000; // 5 seconds
  
  // Callback hooks for scene integration
  public onPhaseChange?: (phase: TurnPhase) => void;
  public checkBusy?: () => boolean;

  constructor() {
    this.enterPlanningPhase();
  }

  public enterPlanningPhase() {
    this.currentPhase = TurnPhase.PLANNING;
    this.executionTimer = 0;
    if (this.onPhaseChange) this.onPhaseChange(this.currentPhase);
    // console.log('Turn Phase: PLANNING');
  }

  public commitTurn() {
    if (this.currentPhase === TurnPhase.PLANNING) {
      this.currentPhase = TurnPhase.EXECUTION;
      this.executionTimer = 0;
      if (this.onPhaseChange) this.onPhaseChange(this.currentPhase);
      // console.log('Turn Phase: EXECUTION');
    }
  }

  public update(dt: number): boolean {
    if (this.currentPhase === TurnPhase.EXECUTION) {
      
      this.executionTimer += dt;
      
      // Check if execution time is over
      if (this.executionTimer >= this.EXECUTION_DURATION_MS) {
        this.finishExecution();
        return false; 
      }
      return true; // Should step physics
    }
    return false; // Do not step physics in other phases
  }

  private finishExecution() {
    this.currentPhase = TurnPhase.RESOLUTION;
    if (this.onPhaseChange) this.onPhaseChange(this.currentPhase);
    // console.log('Turn Phase: RESOLUTION');
    
    // Auto-transition to Planning for now, or wait for UI?
    // Let's auto-transition after a brief moment or immediately?
    // For this implementation plan: "Resolution: Pause physics again for the next turn."
    // So we effectively stay in Resolution or go to Planning. 
    // Usually Resolution handles cleanup, then Planning starts.
    
    setTimeout(() => {
        this.enterPlanningPhase();
    }, 100); // Instant for now
  }
}
