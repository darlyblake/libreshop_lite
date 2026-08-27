const fs = require('fs');

let content = fs.readFileSync('src/screens/BarLiveScreen.tsx', 'utf8');

// Import barContestService
content = content.replace(
  "import { barService, BarPhoto } from '../services/barService';",
  "import { barService, BarPhoto } from '../services/barService';\nimport { barContestService } from '../services/barContestService';"
);

// Update useState for voted/participated
content = content.replace(
  "const [userVoted, setUserVoted] = useState(false);",
  "const [votedPhotoIds, setVotedPhotoIds] = useState<Set<string>>(new Set());"
);
content = content.replace(
  "const [userParticipated, setUserParticipated] = useState(false);",
  "const [userParticipated, setUserParticipated] = useState(false);\n  const [participantCount, setParticipantCount] = useState<number>(0);"
);

// Update data loading logic
const loadingLogicOld = `
        const pts = await barService.getContestPhotos(currentEvent.id, user?.id);
        setContestPhotos(pts);
        
        if (user) {
          const hasVoted = await barService.checkIfUserVoted(currentEvent.id, user.id);
          const hasParticipated = await barService.checkIfUserParticipated(currentEvent.id, user.id);
          setUserVoted(hasVoted);
          setUserParticipated(hasParticipated);
        }

        // Auto-switch to voting phase if participant limit reached
        if (currentEvent.contest_phase === 'participation' && currentEvent.contest_participant_limit) {
          if (pts.length >= currentEvent.contest_participant_limit) {
            // Update to voting
            await barService.updateEvent(currentEvent.id, { contest_phase: 'voting' });
            setActiveEvent({ ...currentEvent, contest_phase: 'voting' });
          }
        }
`;

const loadingLogicNew = `
        const pts = await barContestService.getContestPhotos(currentEvent.id);
        setContestPhotos(pts);
        
        if (user) {
          const hasParticipated = await barContestService.hasParticipated(currentEvent.id);
          setUserParticipated(hasParticipated);
          
          const pCount = await barContestService.getParticipantCount(currentEvent.id);
          setParticipantCount(pCount);

          const votedIds = new Set<string>();
          for (const photo of pts) {
            if (await barContestService.hasVoted(photo.id)) {
              votedIds.add(photo.id);
            }
          }
          setVotedPhotoIds(votedIds);
        }

        // Auto-switch logic (frontend only for display if needed, but db should enforce limit)
        if (currentEvent.contest_phase === 'participation' && currentEvent.contest_participant_limit) {
          const currentCount = await barContestService.getParticipantCount(currentEvent.id);
          if (currentCount >= currentEvent.contest_participant_limit) {
            await barService.updateEvent(currentEvent.id, { contest_phase: 'voting' });
            setActiveEvent({ ...currentEvent, contest_phase: 'voting' });
          }
        }
`;

content = content.replace(loadingLogicOld, loadingLogicNew);

// Replace button calls
content = content.replace(
  /await barService\.startContestVotingPhase\(evt\.id\);/g,
  "await barContestService.startVoting(evt.id);"
);

content = content.replace(
  /await barService\.endContest\(evt\.id\);/g,
  "await barContestService.endContest(evt.id);"
);

content = content.replace(
  /await barService\.uploadContestPhoto\(activeEvent\.id, user\.id, photoUrl\);/g,
  "await barContestService.uploadContestPhoto(activeEvent.id, photoUrl);"
);

content = content.replace(
  /await barService\.voteForContestPhoto\(activeEvent\.id, photo\.id, user\.id\);/g,
  `await barContestService.voteForPhoto(photo.id);
        setVotedPhotoIds(prev => {
          const next = new Set(prev);
          next.add(photo.id);
          return next;
        });`
);

fs.writeFileSync('src/screens/BarLiveScreen.tsx', content, 'utf8');

