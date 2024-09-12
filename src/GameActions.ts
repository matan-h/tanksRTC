// GameActions.ts

import { GameSize,Maze } from "./Types";

// Enum for defining action types in the game
export enum ActionTypes {
    MOVE = 'move',
    SHOOT = 'shoot',
    MAZE = 'maze',
    WALL_COLOR_CHANGE = 'wallColorChange',
    NEW_MAZE = 'newGame',
    NEW_USER = 'newUser',
    GAME_OVER = 'gameOver',
    ELIMINATED = 'eliminated',
    PING = 'ping'
}

// Base interface for all actions
interface BaseAction {
    type: ActionTypes;
}

// Action for moving a game element
export interface MoveAction extends BaseAction {
    type: ActionTypes.MOVE;
    x: number;
    y: number;
    angle: number;
}

// Action for creating a new user
export interface NewUserAction extends BaseAction {
    type: ActionTypes.NEW_USER;
    x: number;
    y: number;
    angle: number;
    screen: GameSize;
    originalCreationTime: number;
    seed?: number;
}

// Action for shooting a projectile
export interface ShootAction extends BaseAction {
    type: ActionTypes.SHOOT;
}

// Action for changing wall color
export interface WallColorChangeAction extends BaseAction {
    type: ActionTypes.WALL_COLOR_CHANGE;
    wallsUpdated: { wallIndex: number; }[];
}

// Action for initializing a new maze
export interface NewMazeAction extends BaseAction {
    type: ActionTypes.NEW_MAZE;
    maze: Maze;
}

// Action for game over scenario
export interface GameOverAction extends BaseAction {
    type: ActionTypes.GAME_OVER;
    winner: string;
}

// Action for an eliminated player or entity
export interface EliminatedAction extends BaseAction {
    type: ActionTypes.ELIMINATED;
    bullet_id: number;
}

// Action for a ping message
export interface PingAction extends BaseAction {
    type: ActionTypes.PING;
    seed?: number;
    mazeTime?: number;
}

// Union type representing all possible actions
export type Action =
    | MoveAction
    | ShootAction
    | WallColorChangeAction
    | NewMazeAction
    | GameOverAction
    | PingAction
    | EliminatedAction
    | NewUserAction;
