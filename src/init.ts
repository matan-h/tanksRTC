import { Game } from "./Game";

// Initialization
const roomIdStr = 'roomId'
const params = new URLSearchParams(location.search)
const query_id = params.get(roomIdStr)

const RoomIdInput = document.getElementById(roomIdStr) as HTMLInputElement
if (query_id) RoomIdInput.value = query_id;


const HTMLform = document.getElementById('roomIdForm') as HTMLFormElement;
const RoomIdButton = document.getElementById("roomIdButton") as HTMLButtonElement

RoomIdButton.disabled = false;


HTMLform.addEventListener('submit', (event) => {
    
    event.preventDefault();
    HTMLform.style.display = 'none';

    const roomId = RoomIdInput.value.trim()||"public";
    if (query_id!==roomId){params.set(roomIdStr,roomId); window.history.replaceState(null, '', "?"+params);}

    new Game('gameCanvas', (roomId || "public"));
});