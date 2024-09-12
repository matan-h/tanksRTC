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
    walls:Wall[],
    time:number,
    size:GameSize
}
export interface Player{
    peerId:string,
    originalScreenSize:GameSize
    lastPingSent?: number;

}
export interface TankControls {
    up: string;
    down: string;
    left: string;
    right: string;
    shoot: string;
};


export interface Point {
    x: number;
    y: number;
}

export interface TankShape {
    rect: Point[];
    turret: Point[];
}
