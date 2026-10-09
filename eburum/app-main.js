import { registerCommunications } from './app-communications.js';
import { registerDiscipline } from './app-discipline.js';
import { registerOperations } from './app-operations.js';
import { boot } from './app-part1.js';
import { registerWorkflows } from './app-workflows.js';

registerOperations();
registerWorkflows();
registerDiscipline();
registerCommunications();
boot();
