import { planService } from "./src/services/planService";
planService.getAll().then(console.log).catch(console.error);
