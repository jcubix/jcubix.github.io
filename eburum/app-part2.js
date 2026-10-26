import {canManage} from './app-part1.js';import {ui} from './src/ui-service.ts';export function playerModal(player={}){if(canManage())return ui.open('player-edit',{player})}
