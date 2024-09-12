// Game.ts

import { Tank } from './Tank';
import { GameSize, Maze, Wall } from './Types';
import { Bullet } from './Bullet';
import {
    Action, ActionTypes, EliminatedAction, GameOverAction, MoveAction,
    NewMazeAction,
    NewUserAction, PingAction, ShootAction, WallColorChangeAction
} from './GameActions';
import { Constants } from './Constants';
import { dummyrandom, fixSize, generateMaze, getRandomColor, StringToSeed } from './Utils';
import { selfId, joinRoom, Room, ActionSender, DataPayload, ActionReceiver } from 'trystero';

// Type alias for action type sender and receiver
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
    private roomId: string;
    private actions: actionType;

    constructor(canvasId: string, roomId: string) {
        // Initialize canvas and context
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        canvas.style.visibility = "visible";
        this.ctx = canvas.getContext('2d')!;
        this.originalGameSize = this.gameSize = fixSize({ height: window.innerHeight, width: window.innerWidth });
        this.setGameSize(this.gameSize);

        // Initialize local tank
        this.localTank = new Tank(
            this.gameSize.width / 2,
            this.gameSize.height / 2,
            'blue',
            { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', shoot: ' ' },
            { peerId: selfId, originalScreenSize: this.originalGameSize }
        );
        this.roomId = roomId;

        this.room = this.joinRoom(roomId);
        this.actions = this.createActions();

        // Debug information for local development
        if (location.hostname === 'localhost') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).dbg = { localTank: this.localTank, remoteTanks: this.remoteTanks, maze: this.maze, game: this, ctx: this.ctx };
        }

        this.setupEventListeners();
        this.startNewGame();
        this.gameLoop();
    }

    /**
     * Set the game size and resize the canvas.
     */
    setGameSize(gameSize: GameSize) {
        this.ctx.canvas.width = gameSize.width;
        this.ctx.canvas.height = gameSize.height;
        this.gameSize = gameSize;
    }

    private joinRoom(roomId: string): Room {
        // Join a room with the given ID
        return joinRoom({ appId: Constants.APP_ID }, roomId);
    }

    private createActions(): actionType {
        // Create actions for sending and receiving data
        const [sendAction, getAction] = this.room.makeAction('action');
        return { send: sendAction, receive: getAction };
    }

    private setupEventListeners() {
        // Clear keys on certain events
        const clearKeys = () => this.keys = {};
        window.addEventListener('blur', clearKeys);
        window.addEventListener('contextmenu', clearKeys);

        // Handle key down and up events
        window.addEventListener('keydown', (event) => {
            this.keys[event.key] = true;
        });

        window.addEventListener('keyup', (event) => {
            this.keys[event.key] = false;
        });

        // Handle room events
        this.room.onPeerJoin(this.registerInPID.bind(this));
        this.room.onPeerLeave(this.handlePeerLeave.bind(this));
        this.actions.receive(this.handleAction.bind(this));

        // Periodically send a ping
        // setInterval(this.sendPing.bind(this), Constants.PING_INTERVAL);
    }

    private GetTank(peerId: string): Tank | undefined {
        // Find a tank by peer ID
        return this.remoteTanks.find(t => t.player.peerId === peerId);
    }

    private registerInPID(peerId: string) {
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
        const tank = this.GetTank(peerId);

        switch (data.type) {
            case ActionTypes.MOVE:
                this.handleMoveAction(data, tank);
                break;
            case ActionTypes.SHOOT:
                this.handleShootAction(data, tank);
                break;
            case ActionTypes.WALL_COLOR_CHANGE:
                this.handleWallColorChange(data, tank);
                break;
            case ActionTypes.NEW_MAZE:
                this.handleNewMaze(data, tank);
                break;
            case ActionTypes.NEW_USER:
                this.handleNewUser(data, tank, peerId);
                break;
            case ActionTypes.GAME_OVER:
                this.handleGameOver(data, tank);
                break;
            case ActionTypes.ELIMINATED:
                this.handleEliminatedAction(data, tank);
                break;
            case ActionTypes.PING:
                this.handlePing(data, tank, peerId);
                break;
            default:
                console.warn('Unknown action data:', data);
        }
    }

    private getLowestTank(tankList?: Tank[]): Tank {
        // Get the tank with the smallest screen size
        const tankValue = (t: Tank) => t.player.originalScreenSize.width + t.player.originalScreenSize.height;
        return (tankList || [...this.remoteTanks, this.localTank])
            .sort((a, b) => a.originalCreationTime - b.originalCreationTime)
            .reduce((prev, curr) => tankValue(prev) < tankValue(curr) ? prev : curr);
    }

    private handleNewMaze(data: NewMazeAction, tank?: Tank) {
        if (!tank) return // dont allow removed users to set maze.
        // if they are late, dont accept the map.
        if (this.maze && data.maze.time > this.maze.time) return
        this.maze = this.generateMaze(data.maze.seed, fixSize(data.maze.size));
        this.localGotoRandom();
    }

    /**
     * Handle a new user action when a new tank joins the room.
    */
   private handleNewUser(data: NewUserAction, already_tank: Tank | undefined, peerId: string) {
       if (already_tank) return; // Avoid duplicate handling (sendAction->handleNewUser->sendAction)
       const lowestSizeTank = this.getLowestTank();
       
        this.sendAction({
            type: ActionTypes.NEW_USER,
            x: this.localTank.x,
            y: this.localTank.y,
            angle: this.localTank.angle,
            screen: this.originalGameSize,
            originalCreationTime: this.localTank.originalCreationTime,
            seed: this.maze?.seed
        }, peerId);

        const size = fixSize(data.screen);
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

        // if (data.seed && data.seed !== this.maze?.seed && lowestSizeTank.player.peerId === peerId) {
        //     console.log("[debug] [handleNewUser] generating maze...", lowestSizeTank.player.originalScreenSize);
        //     this.maze = this.generateMaze(data.seed, lowestSizeTank.player.originalScreenSize);
        // }
        if (lowestSizeTank === this.localTank && this.maze) {
            this.sendAction({ type: ActionTypes.NEW_MAZE, maze: this.maze }, peerId);
        }
    }

    private handleEliminatedAction(data: EliminatedAction, tank?: Tank) {
        if (tank) {
            tank.isEliminated = true;
            this.bullets = this.bullets.filter(b => (b.owner !== tank.player.peerId && b.id !== data.bullet_id));
        }
    }

    private handleMoveAction(data: MoveAction, tank?: Tank) {
        if (tank) {
            tank.x = data.x;
            tank.y = data.y;
            tank.angle = data.angle;
        }
    }

    private handleShootAction(_data: ShootAction, tank?: Tank) {
        if (tank) {
            tank.shoot(this.bullets);
        }
    }

    private handleWallColorChange(data: WallColorChangeAction, tank?: Tank) {
        if (!tank) return

        const wallsUpdated = data.wallsUpdated;
        wallsUpdated.forEach(wallData => {
            const wall = this.maze?.walls[wallData.wallIndex];
            if (wall) {
                wall.currentColor = tank.color;
                setTimeout(() => {
                    wall.currentColor = wall.originalColor;
                }, Constants.WALL_COLOR_CHANGE_DURATION);
            }
        });
    }

    private handleGameOver(data: GameOverAction, tank?: Tank) {
        if (!tank) return
        const winTank = this.GetTank(data.winner);
        if (winTank) {
            this.onGameOver(winTank);
        }
    }

    private handlePing(data: PingAction, tank: Tank | undefined, peerId: string) {
        if (tank) {
            tank.player.lastPingSent = Date.now();

            if (this.maze && (!(data.mazeTime && data.seed) || (data.mazeTime && data.seed !== this.maze.seed && data.mazeTime < this.maze?.time))) {
                this.sendAction({ type: ActionTypes.NEW_MAZE, maze: this.maze });

            }

        }
        else {
            this.registerInPID(peerId)
        }
    }

    private sendAction(action: Action, peerId?: string) {
        this.actions.send(action as DataPayload, peerId);
    }

    private removeTank(peerId: string) {
        this.remoteTanks = this.remoteTanks.filter(tank => tank.player.peerId !== peerId);
    }

    private generateMaze(seed: number, gamesize: GameSize): Maze {
        if (seed===this.maze?.seed && this.maze.size.width===gamesize.width && this.maze.size.height===gamesize.height) return this.maze
        console.trace("generateMaze", seed, gamesize);
        const newMaze = generateMaze(gamesize, Constants.WALL_SIZE, seed);
        if (this.gameSize.height !== gamesize.height || this.gameSize.width !== gamesize.width ) {
            this.setGameSize(gamesize);
        }
        return { walls: newMaze, seed: seed, time: Date.now(), size: gamesize };
    }

    private listen_Maze(failed_tanks: Tank[]) {
        if (this.maze) return;
        if (failed_tanks.length >= this.remoteTanks.length) return // if there more/eq failed then the number of tanks

        this.startNewGame(failed_tanks);
    }

    private startNewGame(failed_tanks: Tank[] = []) {
        console.log("startNewGame")
        // Reset game state
        this.winMessage = '';
        this.maze = null;
        this.bullets = [];
        const tanks = [...this.remoteTanks, this.localTank]
        tanks.forEach(x => x.isEliminated = false);

        const lowestSizeTank = this.getLowestTank(tanks.filter(t=>!failed_tanks.includes(t)));
        if (lowestSizeTank === this.localTank) {
            const seed = Math.random();
            this.maze = this.generateMaze(seed, this.gameSize);
            this.localGotoRandom();
            console.log('Attempt to start a new game');
            this.sendAction({ type: ActionTypes.NEW_MAZE, maze: this.maze });
        } else {
            console.log('Waiting for PID// TODO', lowestSizeTank.player.peerId);
            setTimeout(() => this.listen_Maze([lowestSizeTank, ...failed_tanks]), Constants.GETMAZE_TIMEOUT);
        }

    }

    private onGameOver(winningTank: Tank) {
        if (winningTank.player.peerId === selfId && this.remoteTanks.length !== 0) {
            this.winMessage = 'You Win!';
            this.sendAction({ type: ActionTypes.GAME_OVER, winner: selfId });
        } else {
            this.winMessage = "You Lose!";
            if (this.remoteTanks.length === 0) this.winMessage = "Game Over!";
            if (this.remoteTanks.length > 1) {
                this.winMessage += `(the ${winningTank.color} tank wins)`;
            }
        }
        this.drawWinLoseBanner();
        if (this.restartTimeout === null) {
            this.restartTimeout = window.setTimeout(() => {
                this.startNewGame();
                this.restartTimeout = null;
            }, Constants.WINLOSE_BANNER_TIMEOUT);
        }
    }

    private checkGameOverConditions() {
        const allTanks = [this.localTank, ...this.remoteTanks];
        const activeTanks = allTanks.filter(tank => !tank.isEliminated);

        if (activeTanks.length === 0 || (activeTanks.length === 1 && allTanks.length !== 1)) {
            this.onGameOver(activeTanks[0] || this.localTank);
            return true;
        }
    }

    private gameLoop() {
        // setInterval works when the tab is completely inactive, so it make sense here to check if the gameloop is active
        if (Date.now() - this.localTank.player.lastPingSent! >= Constants.PING_INTERVAL) this.sendPing()

        if (this.checkGameOverConditions()) {
            requestAnimationFrame(() => this.gameLoop());
            return;
        }

        this.ctx.clearRect(0, 0, window.innerWidth,window.innerHeight);

        if (this.maze) {
            const { shootBullet, wallsUpdated } = this.localTank.updateControls(this.keys, this.bullets, this.maze!.walls, this.gameSize);
            if (shootBullet) this.sendAction({ type: ActionTypes.SHOOT });
            if (wallsUpdated) this.sendAction({ type: ActionTypes.WALL_COLOR_CHANGE, wallsUpdated: wallsUpdated });
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
        if (!this.maze) return;
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
        if (!this.maze) return;
        this.bullets = this.bullets.filter(bullet => bullet.update(this.maze!.walls, this.gameSize));
    }

    private checkCollisions() {
        if (this.localTank.isEliminated) return
        let eliminated = false;
        this.bullets.forEach(bullet => {
            if (this.localTank.checkCollisionWithBullet(bullet)) {
                eliminated = true;
                this.localTank.isEliminated = true;
                bullet.creationTime = 0;
                this.sendAction({ type: ActionTypes.ELIMINATED, bullet_id: bullet.id });
            }
        });
        if (eliminated) {
            this.bullets = this.bullets.filter(x => x.owner !== selfId);
        }
    }

    private checkInactiveTanks() {
        const now = Date.now();
        this.remoteTanks.forEach(tank => {
            if (now - tank.player.lastPingSent! > Constants.PING_TIMEOUT) {
                this.removeTank(tank.player.peerId);
            }
        });
    }

    private sendPing() {
        this.sendAction({ type: ActionTypes.PING, seed: this.maze?.seed, mazeTime: this.maze?.time });
        this.localTank.player.lastPingSent = Date.now();
    }

    private localGotoRandom() {
        if (!this.maze) return
        // make sure in one world, the same player in the same room would result in the same location.
        const seed = StringToSeed(this.roomId+selfId)

        // Define the size of each grid cell
        const cellSize = Constants.TANK_SIZE * 2; // Size of the grid cell
        const numCols = Math.ceil(this.gameSize.width / cellSize); // Number of columns in the grid
        const numRows = Math.ceil(this.gameSize.height / cellSize); // Number of rows in the grid

        // Array to hold valid cell positions
        const validCells: { x: number, y: number }[] = [];

        // Iterate through each cell in the grid
        for (let row = 0; row < numRows; row++) {
            for (let col = 0; col < numCols; col++) {
                // Calculate the center position of the cell
                const cellX = col * cellSize + cellSize / 2;
                const cellY = row * cellSize + cellSize / 2;

                // Check if the cell is valid (not colliding with walls and within bounds)
                if (!isCellColliding(cellX, cellY, this.maze?.walls, this.gameSize)) {
                    validCells.push({ x: cellX, y: cellY });
                }
            }
        }

        // If there are valid cells, select a random one
        if (validCells.length > 0) {
            const randomIndex = Math.floor(dummyrandom(seed) * validCells.length);
            const { x, y } = validCells[randomIndex];
            this.localTank.x = x;
            this.localTank.y = y;
            this.localTank.angle = dummyrandom(seed) * 2 * Math.PI; // set a random angle
        }
        function isCellColliding(x: number, y: number, walls: Wall[], gameSize: GameSize): boolean {
            // Check if the cell is out of bounds
            if (x < 0 || x > gameSize.width || y < 0 || y > gameSize.height) {
                return true;
            }

            // Check if the cell collides with any walls
            const tankSize = Constants.TANK_SIZE;
            return walls.some(wall => {
                const left = x - tankSize / 2;
                const right = x + tankSize / 2;
                const top = y - tankSize / 2;
                const bottom = y + tankSize / 2;
                return left < wall.x + wall.width && right > wall.x &&
                    top < wall.y + wall.height && bottom > wall.y;
            });
        }

        // this.localTank.x = Math.random() * this.gameSize.width;
        // this.localTank.y = Math.random() * this.gameSize.height;
        this.localTank.moveOut(this.maze?.walls || [], this.gameSize);
    }
}
