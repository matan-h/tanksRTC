// Types.ts

// Game size and configuration
export interface GameSize {
    width: number;
    height: number;
}

// Wall dimensions and properties
export interface Wall {
    x: number;
    y: number;
    width: number;
    height: number;
    originalColor: string;
    currentColor?: string;
}
export interface Maze{
    seed:number,
    walls:Wall[]
}

export interface TankControls {
    up: string;
    down: string;
    left: string;
    right: string;
    shoot: string;
};

export interface TankMovement {
    UP:boolean,
    DOWN:boolean,
    LEFT:boolean,
    RIGHT:boolean,
}

// Tank properties
export interface Tank {
    x: number;
    y: number;
    angle: number;
    color: string;
    peerId: string;
    originalCreationTime: number;
    lastPingSent?: number; // Optional property for tracking pings
    isRemote?: boolean; // Optional property for distinguishing local vs. remote tanks
}

// Utility function for defining coordinates
export interface Point {
    x: number;
    y: number;
}

export interface TankShape {
    rect: Point[];
    turret: Point[];
}
