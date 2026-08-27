const fs = require('fs');
let content = fs.readFileSync('src/screens/BarContestScreen.tsx', 'utf8');

content = content.replace(
  "import { barService, BarEvent, BarEventPhoto } from '../services/barService';",
  "import { barService, BarEvent, BarEventPhoto } from '../services/barService';\nimport { barContestService } from '../services/barContestService';"
);

content = content.replace(
  /barService\.getContestPhotosPending/g,
  "barContestService.getPendingContestPhotos"
);

content = content.replace(
  /barService\.startContest\(/g,
  "barContestService.startContest("
);

content = content.replace(
  /barService\.startContestVotingPhase\(/g,
  "barContestService.startVoting("
);

content = content.replace(
  /barService\.endContest\(/g,
  "barContestService.endContest("
);

content = content.replace(
  /barService\.moderateContestPhoto\(/g,
  "barContestService.moderateContestPhoto("
);

fs.writeFileSync('src/screens/BarContestScreen.tsx', content, 'utf8');
