// Game.ts

import { Tank } from './Tank';

import { GameSize, Maze } from './Types';
import { Bullet } from './Bullet';
import { Action, ActionTypes, EliminatedAction, GameOverAction, MoveAction, NewUserAction, ShootAction, WallColorChangeAction } from './GameActions';
import { Constants } from './Constants';

import { fixSize, generateMaze, getRandomColor, StringToSeed } from './Utils';
import { selfId, joinRoom, Room, ActionSender, DataPayload, ActionReceiver } from 'trystero';

declare type actionType = { send: ActionSender<DataPayload>; receive: ActionReceiver<DataPayload>; }

export class Game {
    private gameSize: GameSize;
    private originalGameSize: GameSize;
    private ctx: CanvasRenderingContext2D;
    private localTank: Tank;
    private remoteTanks: Tank[] = [];
    private bullets: Bullet[] = [];
    private maze: Maze | null = null;

    private keys: { [key: string]: boolean } = {};
    private winMessage: string = '';
    private restartTimeout: number | null = null;

    private room: Room;
    private actions: actionType;

    constructor(canvasId: string, roomId: string) {
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        canvas.style.visibility = "visible";

        this.ctx = canvas.getContext('2d')!;

        this.originalGameSize = this.gameSize = fixSize({ height: canvas.height, width: canvas.width })
        this.setGameSize(this.gameSize)

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
            }, { peerId: selfId, originalScreenSize: this.originalGameSize }
        );

        this.room = this.joinRoom(roomId);
        this.actions = this.createActions();

        // debug info:
        if (location.hostname === 'localhost') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).dbg = { localTank: this.localTank, remoteTanks: this.remoteTanks, maze: this.maze, game: this, ctx: this.ctx }
        }


        this.setupEventListeners();
        this.startNewGame();
        this.gameLoop();
    }
    setGameSize(gameSize: GameSize) {
        this.ctx.canvas.width = gameSize.width;
        this.ctx.canvas.height = gameSize.height;
        this.gameSize = gameSize
    }

    private joinRoom(roomId: string): Room {
        return joinRoom({ appId: Constants.APP_ID }, roomId);
    }

    private createActions(): actionType {
        const [sendAction, getAction] = this.room.makeAction('action');
        return { send: sendAction, receive: getAction };
    }

    private setupEventListeners() {
        const clearkeys = () => this.keys = {};
        window.addEventListener('blur', clearkeys)
        window.addEventListener('contextmenu', clearkeys)

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



    private tank(peerId: string) {
        return this.remoteTanks.find(t => t.player.peerId === peerId);

    }

    private handlePeerJoin(peerId: string) {
        console.log(`${peerId} joined`);
        this.sendAction({
            type: ActionTypes.NEW_USER,
            x: this.localTank.x,
            y: this.localTank.y,
            angle: this.localTank.angle,
            screen: this.localTank.player.originalScreenSize,
            originalCreationTime: this.localTank.originalCreationTime,
            seed: this.maze?.seed
        }, peerId);

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
            case ActionTypes.WALL_COLOR_CHANGE:
                this.handleWallColorChange(data, peerId);
                break; 
            case ActionTypes.NEW_MAZE:
                this.localGotoRandom(); this.generateMaze(data.seed, data.gamesize)
                break;
            case ActionTypes.NEW_USER:
                this.handleNewUser(data, peerId);
                break;
            case ActionTypes.GAME_OVER:
                this.handleGameOver(data);
                break;
            case ActionTypes.Eliminated:
                this.handleEliminatedAction(data, peerId);
                break;

            case ActionTypes.PING:
                this.handlePing(peerId);
                break;
            default:
                console.warn('Unknown action data:', data);
        }
    }
    private getLowestTank(): Tank {
        // get minimum:
        const TankValue = (t: Tank) => t.player.originalScreenSize.width + t.player.originalScreenSize.height
        return [...this.remoteTanks, this.localTank].sort((a, b) => a.originalCreationTime - b.originalCreationTime).reduce(((prev, curr) => TankValue(prev) < TankValue(curr) ? prev : curr));
    }
    /**
     * handle the newUserAction - called to a new tank that joined into the room, then after that, when tank sync
     */
    private handleNewUser(data: NewUserAction, peerId: string) {

        if (this.tank(peerId)) return // the sendAction->handleNewUser->sendAction is a loop.

        this.sendAction({
            type: ActionTypes.NEW_USER,
            x: this.localTank.x,
            y: this.localTank.y,
            angle: this.localTank.angle,
            screen: this.originalGameSize,
            originalCreationTime: this.localTank.originalCreationTime,
            seed: this.maze?.seed
        }, peerId)

        const size = fixSize(data.screen);


        // get minimum:
        //
        const color = getRandomColor(StringToSeed(peerId));
        const tank = new Tank(
            data.x,
            data.y,
            color,
            null,
            { peerId: peerId, originalScreenSize: size },
            true,
            data.originalCreationTime
        );
        this.remoteTanks.push(tank);
        //

        const lowestSizeTank = this.getLowestTank();
        if (data.seed && data.seed !== this.maze?.seed && lowestSizeTank.player.peerId === peerId) {
            console.log("[debug] [handleNewUser] generating maze...", lowestSizeTank.player.originalScreenSize)
            this.generateMaze(data.seed, lowestSizeTank.player.originalScreenSize)
        }
        if (lowestSizeTank === this.localTank && this.maze) {
            this.sendAction({ type: ActionTypes.NEW_MAZE, seed: this.maze.seed, gamesize: this.gameSize }, peerId);
        }

    }
    private handleEliminatedAction(data: EliminatedAction, peerId: string) {
        const tank = this.tank(peerId);
        if (!tank) return
        tank.isEliminated = true
        this.bullets = this.bullets.filter(b => (b.owner !== tank.player.peerId && b.id !== data.bullet_id))


    }


    private handleMoveAction(data: MoveAction, peerId: string) {
        const tank = this.tank(peerId);
        if (!tank) {
            /*const color = getRandomColor();
            tank = new Tank(
                data.x,
                data.y,
                color,
                null,
                peerId,
                true,
                data.originalCreationTime
            );
            this.remoteTanks.push(tank);*/
        }
        else {
            // TODO: verify
            tank.x = data.x;
            tank.y = data.y;
            tank.angle = data.angle;
        }
    }


    private handleShootAction(_data: ShootAction, peerId: string) {
        const tank = this.tank(peerId);
        if (!tank) return

        tank.shoot(this.bullets)
    }

    private handleWallColorChange(data: WallColorChangeAction, peerId: string) {
        const wallsUpdated = data.wallsUpdated!;
        wallsUpdated.forEach(wallData => {
            const wall = this.maze?.walls[wallData.wallIndex];
            if (wall) {
                wall.currentColor = this.tank(peerId)?.color;
                setTimeout(() => {
                    wall.currentColor = wall.originalColor;
                }, Constants.WALL_COLOR_CHANGE_DURATION);
            }
        });
    }

    private handleGameOver(data: GameOverAction) {
        const winTank = this.tank(data.winner);
        if (winTank)
            this.onGameOver(winTank)
    }

    private handlePing(peerId: string) {
        const tankPing = this.tank(peerId);
        if (tankPing) {
            tankPing.lastPingSent = Date.now();
        }
    }

    private sendAction(action: Action, peerId?: string) {
        this.actions.send(action as DataPayload, peerId);
    }

    private removeTank(peerId: string) {
        this.remoteTanks = this.remoteTanks.filter(tank => tank.player.peerId !== peerId);
    }
    private generateMaze(seed: number, gamesize: GameSize) {
        console.trace("generateMaze", seed, gamesize)
        const newMaze = generateMaze(gamesize, Constants.WALL_SIZE, seed);
        if (this.gameSize !== gamesize) {
            this.setGameSize(gamesize)
        }
        this.maze = { walls: newMaze, seed: seed, }

    }
    private listen_Maze(failed_tank: Tank) {
        if (this.maze) return
        console.log("tank did not make maze it time:removing", failed_tank.player.peerId)
        this.removeTank(failed_tank.player.peerId); this.startNewGame()

    }


    private startNewGame() {

        // Reset game state
        this.winMessage = '';
        this.maze = null;

        this.bullets = [];
        [...this.remoteTanks, this.localTank].forEach(x => x.isEliminated = false)
        //

        const lowestSizeTank = this.getLowestTank();
        if (lowestSizeTank === this.localTank) {
            // this.sendAction({ type: ActionTypes.MAZE, seed: this.maze.seed, gamesize: this.gameSize },peerId);
            // if (!this.maze) {
            const seed = Math.random();
            this.generateMaze(seed, this.gameSize);
            // }


            console.log('Attempt to start a new game');
            // this.sendAction({ type: ActionTypes.MAZE, seed: this.maze!.seed, gamesize: this.gameSize });
            this.sendAction({ type: ActionTypes.NEW_MAZE, seed: this.maze!.seed, gamesize: this.gameSize });
        } else {

            console.log('Waiting for PID// TODO', lowestSizeTank.player.peerId);
            setTimeout(() => this.listen_Maze(lowestSizeTank), Constants.GETMAZE_TIMEOUT)
            // TODO: handle the case it errors.
        }

        this.localGotoRandom();


        // Start the game loop
    }
    private onGameOver(winningTank: Tank) {

        if (winningTank.player.peerId === selfId && this.remoteTanks.length !== 0) {
            // If the local tank is the winner
            this.winMessage = 'You Win!';
            this.sendAction({ type: ActionTypes.GAME_OVER, winner: selfId });
        } else {
            // If the local tank loses, display the color of the winning tank

            this.winMessage = "You Lose!";
            if (this.remoteTanks.length === 0) this.winMessage = "Game Over!";
            if (this.remoteTanks.length > 1) {
                this.winMessage += `(the ${winningTank.color} tank wins)`
            }
        }
        this.drawWinLoseBanner();
        if (this.restartTimeout === null) {
            this.restartTimeout = window.setTimeout(() => {
                this.startNewGame();
                this.restartTimeout = null;
            }, Constants.WINLOSE_BANNER_TIMEOUT); // Wait for 3 seconds before restarting
        }


    }
    private checkGameOverConditions() {
        const allTanks = [this.localTank, ...this.remoteTanks]
        // Get active tanks (tanks that are not eliminated)
        const activeTanks = allTanks.filter(tank => !tank.isEliminated);

        if (activeTanks.length === 0 || (activeTanks.length === 1 && allTanks.length !== 1)) { // Only one active tank left, they are the winner
            this.onGameOver(activeTanks[0] || this.localTank)
            return true
        }
    }


    private gameLoop() {
        // if gameover, wait until end of timer
        if (this.checkGameOverConditions()) { requestAnimationFrame(() => this.gameLoop());; return }

        // TODO: clear the whole aria alwase
        this.ctx.clearRect(0, 0, this.originalGameSize.width, this.originalGameSize.height);

        // Update local tank and bullets
        if (this.maze) {
            const { shootBullet, wallsUpdated } = this.localTank.updateControls(this.keys, this.bullets, this.maze!.walls, this.gameSize);
            if (shootBullet) this.sendAction({ type: ActionTypes.SHOOT, });
            if (wallsUpdated) this.sendAction({ type: ActionTypes.WALL_COLOR_CHANGE, wallsUpdated: wallsUpdated })
        }

        this.updateBullets();
        this.sendAction({
            type: ActionTypes.MOVE,
            x: this.localTank.x,
            y: this.localTank.y,
            angle: this.localTank.angle
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
        let eliminated = false
        // Check collisions with walls and other game elements
        this.bullets.forEach(bullet => {

            if (this.localTank.checkCollisionWithBullet(bullet)) {
                eliminated = true
                this.localTank.isEliminated = true;
                bullet.creationTime = 0;
                this.sendAction({ type: ActionTypes.Eliminated, bullet_id: bullet.id })
                // TODO: this.sendAction
            }

        });
        if (eliminated) this.bullets = this.bullets.filter(x => x.owner !== selfId)
    }

    private checkInactiveTanks() {
        const now = Date.now();
        this.remoteTanks.forEach(tank => {
            if (now - tank.lastPingSent > Constants.PING_TIMEOUT) {
                this.removeTank(tank.player.peerId);
            }
        });
    }

    private sendPing() {
        this.sendAction({ type: ActionTypes.PING });
    }


    private localGotoRandom() {

        this.localTank.x = Math.random() * this.gameSize.width;
        this.localTank.y = Math.random() * this.gameSize.height;

        this.localTank.moveOut(this.maze?.walls || [], this.gameSize)
    }
}
