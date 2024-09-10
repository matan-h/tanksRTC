// Game.ts

import { Tank } from './Tank';

import { GameSize, Maze } from './Types';
import { Bullet } from './Bullet';
import { Action, ActionTypes, GameOverAction, MoveAction, ShootAction, WallColorChangeAction } from './GameActions';
import { Constants } from './Constants';

import { generateMaze, getRandomColor } from './Utils';
import { selfId, joinRoom, Room, ActionSender, DataPayload, ActionReceiver } from 'trystero';

declare type actionType = { send: ActionSender<DataPayload>; receive: ActionReceiver<DataPayload>; }

export class Game {
    private gameSize: GameSize;
    private ctx: CanvasRenderingContext2D;
    private localTank: Tank;
    private remoteTanks: Tank[] = [];
    private bullets: Bullet[] = [];
    private maze: Maze | null = null;

    private keys: { [key: string]: boolean } = {};
    private gameOver: boolean = false;
    private winMessage: string = '';
    private restartTimeout: number | null = null;
    private room: Room; // Replace with appropriate type from Trystero librarymultiplayer-tank-game
    private actions: actionType;

    constructor(canvasId: string, roomId: string) {
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        canvas.style.visibility = "visible";

        this.ctx = canvas.getContext('2d')!;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        this.gameSize = { height: canvas.height, width: canvas.width };

        this.localTank = new Tank(
            this.gameSize.width / 2,
            this.gameSize.height / 2,
            'blue',
            {
                up: 'ArrowUp',
                down: 'ArrowDown',
                left: 'ArrowLeft',
                right: 'ArrowRight',
                shoot: ' '
            }, selfId
        );

        this.room = this.joinRoom(roomId);
        this.actions = this.createActions();

        this.setupEventListeners();
        this.startNewGame();
    }

    private joinRoom(roomId: string): Room {
        // Replace with the actual room joining logic
        return joinRoom({ appId: Constants.APP_ID }, roomId);
    }

    private createActions(): actionType {
        const [sendAction, getAction] = this.room.makeAction('action');
        return { send: sendAction, receive: getAction };
    }

    private setupEventListeners() {
        window.addEventListener('keydown', (event) => {
            this.keys[event.key] = true;
        });

        window.addEventListener('keyup', (event) => {
            this.keys[event.key] = false;
        });

        this.room.onPeerJoin(this.handlePeerJoin.bind(this));
        this.room.onPeerLeave(this.handlePeerLeave.bind(this));

        this.actions.receive(this.handleAction.bind(this));

        setInterval(this.sendPing.bind(this), Constants.PING_INTERVAL);
    }

    private handlePeerJoin(peerId: string) {
        console.log(`${peerId} joined`);
        if (peerId.localeCompare(selfId) === 1 && this.maze) {
            this.sendAction({ type: ActionTypes.MAZE, seed: this.maze.seed, gamesize: this.gameSize });
            this.sendAction({
                type: ActionTypes.MOVE,
                x: this.localTank.x,
                y: this.localTank.y,
                angle: this.localTank.angle,
                originalCreationTime: this.localTank.originalCreationTime
            });

            this.remoteTanks.forEach(tank => {
                this.sendAction({
                    type: ActionTypes.MOVE,
                    x: tank.x,
                    y: tank.y,
                    angle: tank.angle,
                    originalCreationTime: tank.originalCreationTime
                }, peerId);
            });
        }
    }

    private handlePeerLeave(peerId: string) {
        console.log(`${peerId} left`);
        this.removeTank(peerId);
    }

    private handleAction(raw_data: DataPayload, peerId: string) {
        if (!(raw_data && (raw_data as Action).type)) { return }

        const data = raw_data as Action;

        switch (data.type) {
            case ActionTypes.MOVE:
                this.handleMoveAction(data, peerId);
                break;
            case ActionTypes.SHOOT:
                this.handleShootAction(data, peerId);
                break;
            case ActionTypes.MAZE:
                this.generateMaze(data.seed, data.gamesize)
                break;
            case ActionTypes.WALL_COLOR_CHANGE:
                this.handleWallColorChange(data, peerId);
                break;
            case ActionTypes.NEW_GAME:
                this.localGotoRandom()
                break;
            case ActionTypes.GAME_OVER:
                this.handleGameOver(data);
                break;
            case ActionTypes.PING:
                this.handlePing(peerId);
                break;
            default:
                console.warn('Unknown action data:', data);
        }
    }

    private handleMoveAction(data: MoveAction, peerId: string) {
        let tank = this.remoteTanks.find(t => t.peerId === peerId);
        if (!tank) {
            const color = getRandomColor();
            tank = new Tank(
                data.x,
                data.y,
                color,
                null,
                peerId,
                true,
                data.originalCreationTime
            );
            this.remoteTanks.push(tank);
        }
        else {
            // TODO: verify
            tank.x = data.x;
            tank.y = data.y;
            tank.angle = data.angle;
        }
    }

    private handleShootAction(_data: ShootAction, peerId: string) {
        const tank = this.remoteTanks.find(t => t.peerId === peerId);
        if (!tank) return

        // this.bullets.push(bullet);
        tank.shoot(this.bullets)
    }

    private handleWallColorChange(data: WallColorChangeAction, peerId: string) {
        const wallsUpdated = data.wallsUpdated!;
        wallsUpdated.forEach(wallData => {
            const wall = this.maze?.walls[wallData.wallIndex];
            if (wall) {
                wall.currentColor = this.remoteTanks.find(t => t.peerId === peerId)?.color;
                setTimeout(() => {
                    wall.currentColor = wall.originalColor;
                }, 300);
            }
        });
    }

    private handleGameOver(data: GameOverAction) {
        this.gameOver = true;
        this.winMessage = data.message!;
    }

    private handlePing(peerId: string) {
        const tankPing = this.remoteTanks.find(t => t.peerId === peerId);
        if (tankPing) {
            tankPing.lastPingSent = Date.now();
        }
    }

    private sendAction(action: Action, peerId?: string) {
        this.actions.send(action as DataPayload, peerId);
    }

    private removeTank(peerId: string) {
        this.remoteTanks = this.remoteTanks.filter(tank => tank.peerId !== peerId);
    }
    private generateMaze(seed: number, gamesize: GameSize) {
        console.trace("generateMaze", seed, gamesize)
        const newMaze = generateMaze(gamesize, Constants.WALL_SIZE, seed);
        this.gameSize = gamesize
        this.maze = { walls: newMaze, seed: seed, }//:gamesize}

    }

    private startNewGame() {
        // Reset game state
        this.gameOver = false;
        this.winMessage = '';
        this.bullets = [];
        //
        const waitingForPid = [...this.remoteTanks, this.localTank].sort((a, b) => a.originalCreationTime - b.originalCreationTime)[0].peerId;
        if (waitingForPid === selfId) {
            const seed = Math.random();
            this.generateMaze(seed, this.gameSize);


            console.log('Attempt to start a new game\nRemote:', [...this.remoteTanks.map(tank => tank.originalCreationTime), this.localTank.originalCreationTime].sort(), selfId);
            this.sendAction({ type: ActionTypes.MAZE, seed: seed, gamesize: this.gameSize });
            this.sendAction({ type: ActionTypes.NEW_GAME });
        } else {
            console.log('Waiting for PID// TODO', waitingForPid);
            // TODO: handle the case it errors.
        }

        this.localGotoRandom();

        // Start the game loop
        this.gameLoop();
    }

    private gameLoop() {
        if (this.gameOver) {
            this.drawWinLoseBanner();
            if (this.restartTimeout === null) {
                this.restartTimeout = window.setTimeout(() => {
                    this.startNewGame();
                    this.restartTimeout = null;
                }, 3000); // Wait for 3 seconds before restarting
            }
            return;
        }

        this.ctx.clearRect(0, 0, this.gameSize.width, this.gameSize.height);

        // Update local tank and bullets
        if (this.maze) {
            const {shootBullet,wallsUpdated} = this.localTank.updateControls(this.keys, this.bullets, this.maze!.walls, this.gameSize);
            if (shootBullet) this.sendAction({ type: ActionTypes.SHOOT, });
            if (wallsUpdated) this.sendAction({type:ActionTypes.WALL_COLOR_CHANGE,wallsUpdated:wallsUpdated})
        }

        this.updateBullets();
        this.sendAction({
            type: ActionTypes.MOVE,
            x: this.localTank.x,
            y: this.localTank.y,
            angle: this.localTank.angle,
            originalCreationTime: this.localTank.originalCreationTime
        });

        this.drawWalls();
        this.localTank.draw(this.ctx);
        this.remoteTanks.forEach(tank => tank.draw(this.ctx));
        this.drawBullets();
        this.checkCollisions();
        this.checkInactiveTanks();

        requestAnimationFrame(() => this.gameLoop());
    }

    private drawWalls() {
        if (!this.maze) return
        this.ctx.fillStyle = 'gray'; // Default color
        this.maze.walls.forEach(wall => {
            this.ctx.fillStyle = wall.currentColor || wall.originalColor;
            this.ctx.fillRect(wall.x, wall.y, wall.width - Constants.WALL_VSPACING, wall.height - Constants.WALL_VSPACING);
        });
    }

    private drawBullets() {
        this.bullets.forEach(bullet => bullet.draw(this.ctx));
    }

    private drawWinLoseBanner() {
        this.ctx.font = '48px sans-serif';
        this.ctx.fillStyle = 'red';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(this.winMessage, this.gameSize.width / 2, this.gameSize.height / 2);
    }

    private updateBullets() {
        if (!this.maze) return
        this.bullets = this.bullets.filter(bullet => bullet.update(this.maze!.walls, this.gameSize));
    }

    private checkCollisions() {
        // Check collisions with walls and other game elements
        this.bullets.forEach(bullet => {

            if (this.localTank.checkCollisionWithBullet(bullet)) {
                this.gameOver = true;
                this.winMessage = 'Game over!';
                this.sendAction({ type: ActionTypes.GAME_OVER, message: 'You win' });
            } else {
                this.remoteTanks.forEach(tank => {
                    if (tank.checkCollisionWithBullet(bullet)) {
                        this.gameOver = true;
                        this.winMessage = 'You Win!';
                        this.sendAction({ type: ActionTypes.GAME_OVER, message: 'Game Over' });
                    }
                });
            }
        });
    }

    private checkInactiveTanks() {
        const now = Date.now();
        this.remoteTanks.forEach(tank => {
            if (now - tank.lastPingSent > Constants.PING_TIMEOUT) {
                this.removeTank(tank.peerId);
            }
        });
    }

    private sendPing() {
        this.sendAction({ type: ActionTypes.PING });
    }


    private localGotoRandom() {

        this.localTank.x = Math.random() * this.gameSize.width;
        this.localTank.y = Math.random() * this.gameSize.height;

        this.localTank.moveOut(this.maze?.walls || [],this.gameSize)
    }
}
