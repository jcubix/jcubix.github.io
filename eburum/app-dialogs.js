import {ui} from './src/ui-service.ts';export const closeWorkspaceEditors=(options)=>ui.closeAll(options);export const hasOpenDialogs=()=>ui.getSnapshot().surfaces.length>0;
