const fs = require('fs');
let content = fs.readFileSync('src/screens/BarLiveScreen.tsx', 'utf8');

content = content.replace(
  /setUserParticipated\(true\);\s*Alert\.alert\('Succès', 'Votre participation est enregistrée !'\);/g,
  `Alert.alert('Succès', 'Votre photo a été soumise au concours !');`
);

fs.writeFileSync('src/screens/BarLiveScreen.tsx', content, 'utf8');
