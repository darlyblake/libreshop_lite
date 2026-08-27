const fs = require('fs');

let content = fs.readFileSync('src/screens/BarLiveScreen.tsx', 'utf8');

content = content.replace(
  /if \(userVoted\) \{\s*Alert\.alert\('Info', 'Vous avez déjà voté pour ce concours !'\);\s*return;\s*\}/,
  `if (votedPhotoIds.has(photo.id)) {
          Alert.alert('Info', 'Vous avez déjà voté pour cette photo !');
          return;
        }`
);

content = content.replace(/setUserVoted\(true\);/g, '');

content = content.replace(
  /color=\{userVoted \? COLORS\.success : COLORS\.danger\}/g,
  `color={votedPhotoIds.has(item.id) ? COLORS.success : COLORS.danger}`
);

content = content.replace(
  /name=\{userVoted \? "checkmark-circle" : "heart"\}/g,
  `name={votedPhotoIds.has(item.id) ? "checkmark-circle" : "heart"}`
);

fs.writeFileSync('src/screens/BarLiveScreen.tsx', content, 'utf8');

