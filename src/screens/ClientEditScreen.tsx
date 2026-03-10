import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  StatusBar,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../config/theme';
import AddUserModal, { UserData } from '../components/AddUserModal';

interface RouteParams {
  clientId: string;
}

export const ClientEditScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { clientId } = route.params as RouteParams;

  // In a real app you'd fetch the client info by id
  const [user, setUser] = useState<UserData>({
    name: '',
    phone: '',
    email: '',
  });

  const [showModal, setShowModal] = useState(true);

  const handleSave = (data: UserData) => {
    Alert.alert('Modifié', `Client ${clientId} mis à jour`);
    setShowModal(false);
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <AddUserModal
        visible={showModal}
        onClose={() => navigation.goBack()}
        onSubmit={handleSave}
        initialData={user}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
});

export default ClientEditScreen;
