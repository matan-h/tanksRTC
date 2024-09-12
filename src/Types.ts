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
export interface Player{
    peerId:string,
    originalScreenSize:GameSize

}
export interface TankControls {
    up: string;
    down: string;
    left: string;
    right: string;
    shoot: string;
};


// Utility function for defining coordinates
export interface Point {
    x: number;
    y: number;
}

export interface TankShape {
    rect: Point[];
    turret: Point[];
}
