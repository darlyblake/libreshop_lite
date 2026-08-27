const fs = require('fs');
let content = fs.readFileSync('src/screens/BarLiveScreen.tsx', 'utf8');

// Add handleParticipate
const handleParticipateCode = `
  const handleParticipate = async () => {
    if (!user) {
      navigation.navigate('ClientAuth', { pendingAction: 'participate' });
      return;
    }
    if (!activeEvent) return;
    try {
      await barContestService.participateInEvent(activeEvent.id);
      setUserParticipated(true);
      setParticipantCount(prev => prev + 1);
      Alert.alert('Succès', 'Vous participez maintenant au concours ! Vous pouvez envoyer une photo.');
    } catch (error: any) {
      console.error(error);
      Alert.alert('Erreur', error.message || 'Impossible de participer.');
    }
  };
`;

content = content.replace(
  /const handleUploadPhoto = async \(\) => \{/g,
  handleParticipateCode + "\n  const handleUploadPhoto = async () => {"
);

// Fix handleUploadPhoto error checking and alerts
content = content.replace(
  /if \(userParticipated\) \{\s*Alert\.alert\('Oups', 'Vous avez déjà participé à ce concours !'\);\s*return;\s*\}/g,
  `if (!userParticipated) {
            Alert.alert('Oups', 'Vous devez d\'abord participer au concours.');
            return;
          }`
);

// We need to allow upload even if userParticipated is true, but maybe only once per contest? The plan says "Vous devez participer à l'événement avant de soumettre une photo." It doesn't strictly say you can't submit multiple, but we will assume one is enough or standard. Actually let's just let it upload.

// Fix the bottom UI rendering for the button
const buttonRenderOld = `          <TouchableOpacity 
            style={styles.cameraBtn}
            onPress={handleUploadPhoto}
            disabled={uploading || (activeTab === 'contest' && userParticipated)}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="camera" size={24} color="#FFF" />
                <Text style={styles.cameraBtnText}>
                  {activeTab === 'contest' && userParticipated ? "Vous avez participé !" : "Participer avec une photo"}
                </Text>
              </>
            )}
          </TouchableOpacity>`;

const buttonRenderNew = `
          {activeTab === 'contest' && activeEvent?.contest_phase === 'participation' && (
            <Text style={{ textAlign: 'center', marginBottom: 10, color: '#FFF' }}>
              Participants : {participantCount} {activeEvent.contest_participant_limit ? \`/ \${activeEvent.contest_participant_limit}\` : ''}
            </Text>
          )}

          {activeTab === 'contest' && activeEvent?.contest_phase === 'participation' && !userParticipated && (
            <TouchableOpacity 
              style={[styles.cameraBtn, { backgroundColor: COLORS.primary }]}
              onPress={handleParticipate}
              disabled={activeEvent?.contest_participant_limit && participantCount >= activeEvent.contest_participant_limit}
            >
              <Text style={styles.cameraBtnText}>Participer</Text>
            </TouchableOpacity>
          )}

          {(!activeTab || activeTab === 'wall' || (activeTab === 'contest' && userParticipated && activeEvent?.contest_phase === 'participation')) && (
            <TouchableOpacity 
              style={styles.cameraBtn}
              onPress={handleUploadPhoto}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="camera" size={24} color="#FFF" />
                  <Text style={styles.cameraBtnText}>
                    {activeTab === 'contest' ? "Envoyer ma photo" : "Ajouter une photo"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
`;

content = content.replace(buttonRenderOld, buttonRenderNew);

fs.writeFileSync('src/screens/BarLiveScreen.tsx', content, 'utf8');

