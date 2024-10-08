// Constants.ts

export const Constants = {
    // Application ID for Trystero or equivalent
    APP_ID: 'multiplayer-tank-game',

    // Game configurations
    MIN_GAME_WIDTH: 800,
    MIN_GAME_HEIGHT: 600,

    MAX_GAME_WIDTH: 1920,
    MAX_GAME_HEIGHT: 1080,

    // Tank properties
    TANK_SPEED: 3,
    TANK_ROTATION_SPEED: 0.1,
    TANK_SIZE: 40,
    TURRET_SIZE:20,
    TANK_BULLETS_MAX: 10,
    SHOOT_COOLDOWN: 200,//ms
    INACTIVE_TANKS_TIMEOUT: 3000, //ms //TODO

    // Bullet properties
    BULLET_COLOR:"black",
    BULLET_SPEED: 1,
    BULLET_SIZE: 10,
    BULLET_LIFE: 6.7, // seconds
    BULLET_FADE_START: 5.7, // seconds

    // Wall properties
    WALL_COLOR: 'gray',
    WALL_VSPACING: 2,
    WALL_SIZE: 100,

    // Ping & timeout intervals
    PING_INTERVAL: 3000, // ms
    PING_TIMEOUT: 7000, // 2.5 missed pings allowed.

    GETMAZE_TIMEOUT: 1900, // ms players can stay without map

    // Teleport
    // If the angle is greater than n radians, reject teleportation
    MAX_TELEPORT_DEGREES: Math.PI / 4, // 45 degrees in radians
    // Maximum teleport wall iterations
    MAX_TELEPORT_DISTANCE: 200,


    // Misc
    WALL_COLOR_CHANGE_DURATION: 300, // milliseconds
    WINLOSE_BANNER_TIMEOUT:2000, // 2s
    BG_COLOR:"rgba(0,0,0,0)",
    ADMIN_ROOM:"ADMIN"
};
