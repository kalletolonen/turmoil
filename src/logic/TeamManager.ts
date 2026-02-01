import { Planet } from '../objects/Planet';

export interface TeamConfig {
    id: string;
    name: string;
    color: number;
    isAI?: boolean;
}

export class Team {
    public id: string;
    public name: string;
    public color: number;
    public resources: number = 10;
    public planets: Planet[] = [];
    public isAlive: boolean = true;
    public isAI: boolean = false;

    constructor(config: TeamConfig) {
        this.id = config.id;
        this.name = config.name;
        this.color = config.color;
        this.isAI = config.isAI || false;
    }

    public addPlanet(planet: Planet) {
        this.planets.push(planet);
    }

    public removePlanet(planet: Planet) {
        const index = this.planets.indexOf(planet);
        if (index > -1) {
            this.planets.splice(index, 1);
        }
        this.checkAlive();
    }

    public checkAlive() {
        // A team is alive if they have at least one planet OR one turret (logic can vary)
        // For now: No planets = Dead? Or maybe planets are indestructible and we just count turrets?
        // Let's say: If all turrets on all planets are gone, you might be in trouble.
        // But for RUDIMENTARY logic, let's just track checking alive status based on planets for now.
        if (this.planets.length === 0) {
            // this.isAlive = false; // logic TBD
        }
    }
}

export class TeamManager {
    private teams: Team[] = [];

    constructor() {}

    public addTeam(config: TeamConfig): Team {
        const team = new Team(config);
        this.teams.push(team);
        return team;
    }

    public reset(): void {
        this.teams = [];
    }

    public getTeam(id: string): Team | undefined {
        return this.teams.find(t => t.id === id);
    }

    public getTeams(): Team[] {
        return this.teams;
    }

    public resetResources() {
        this.teams.forEach(t => t.resources = 10);
    }
}
