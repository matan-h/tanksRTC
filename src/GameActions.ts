// GameActions.ts
//

import { GameSize } from "./Types";

// Define action types and action interfaces
export enum ActionTypes {
    MOVE = 'move',
    SHOOT = 'shoot',
    MAZE = 'maze',
    WALL_COLOR_CHANGE = 'wallColorChange',
    NEW_GAME = 'newGame',
    GAME_OVER = 'gameOver',
    Eliminated = 'eliminated',
    PING = 'ping'
}

interface BaseAction {
    type: ActionTypes;
}

export interface MoveAction extends BaseAction {
    type: ActionTypes.MOVE;
    x: number;
    y: number;
    angle: number;
    originalCreationTime: number;
}

export interface ShootAction extends BaseAction {
    type: ActionTypes.SHOOT;
    // bullet: Bullet;
}

export interface MazeAction extends BaseAction {
    type: ActionTypes.MAZE;
    seed: number;
    gamesize:GameSize
}

export interface WallColorChangeAction extends BaseAction {
    type: ActionTypes.WALL_COLOR_CHANGE;
    wallsUpdated: { wallIndex: number; }[];
}

export interface NewGameAction extends BaseAction {
    type: ActionTypes.NEW_GAME;
}

export interface GameOverAction extends BaseAction {
    type: ActionTypes.GAME_OVER;
    winner: string;
}
export interface EliminatedAction extends BaseAction{
    type:ActionTypes.Eliminated;
    bullet_id:number
}

export interface PingAction extends BaseAction {
    type: ActionTypes.PING;
}

export type Action =
    | MoveAction
    | ShootAction
    | MazeAction
    | WallColorChangeAction
    | NewGameAction
    | GameOverAction
    | PingAction| EliminatedAction;

// Define the interface for action methods
export interface ActionMethods {
    send: (action: Action, peerId?: string) => void;
    receive: (callback: (data: Action, peerId: string) => void) => void;
}
