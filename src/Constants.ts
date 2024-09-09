// Constants.ts

export const Constants = {
    // Application ID for Trystero or equivalent
    APP_ID: 'multiplayer-tank-game',

    // Game configurations
    GAME_WIDTH: 800,
    GAME_HEIGHT: 600,

    // Tank properties
    TANK_SPEED: 5,
    TANK_ROTATION_SPEED: 0.1,
    TANK_SIZE: 40,
    TANK_BULLETS_MAX: 10,
    SHOOT_COOLDOWN: 200,//ms

    // Bullet properties
    BULLET_SPEED: 5,
    BULLET_SIZE: 10,
    BULLET_LIFE: 2.7, // seconds
    BULLET_FADE_START: 2, // seconds

    // Wall properties
    WALL_COLOR: 'gray',
    WALL_VSPACING: 2,
    WALL_SIZE: 100,

    // Ping & timeout intervals
    PING_INTERVAL: 10000, // 10 seconds
    PING_TIMEOUT: 15000, // 15 seconds
    // Teleport
    // If the angle is greater than n radians, reject teleportation
    MAX_TELEPORT_DEGREES: Math.PI / 4, // 45 degrees in radians
    // Maximum teleport wall iterations
    MAX_TELEPORT_DISTANCE: 200,


    // Action types
    ACTION_MOVE: 'move',
    ACTION_SHOOT: 'shoot',
    ACTION_UPDATE_BULLET: 'updateBullet',
    ACTION_MAZE: 'maze',
    ACTION_WALL_COLOR_CHANGE: 'wallColorChange',
    ACTION_NEW_GAME: 'newGame',
    ACTION_GAME_OVER: 'gameOver',
    ACTION_PING: 'ping',

    // Key mappings for tank controls
    KEY_UP: 'ArrowUp',
    KEY_DOWN: 'ArrowDown',
    KEY_LEFT: 'ArrowLeft',
    KEY_RIGHT: 'ArrowRight',
    KEY_SHOOT: ' ',

    // Misc
    BULLET_FADE_DURATION: 1.5, // seconds
    WALL_COLOR_CHANGE_DURATION: 300, // milliseconds
};
