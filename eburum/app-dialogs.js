import {ui} from './src/ui-service.ts';export const closeWorkspaceEditors=()=>ui.closeAll();export const hasOpenDialogs=()=>ui.getSnapshot().surfaces.length>0;
