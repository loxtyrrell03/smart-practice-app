import * as DocumentPicker from 'expo-document-picker';
import { Alert, Button, View } from 'react-native';

export default function TestPicker() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Button
        title="Pick PDF"
        onPress={async () => {
          const result = await DocumentPicker.getDocumentAsync({
            type: 'application/pdf',
            copyToCacheDirectory: true,
          });
          if (result.canceled || !result.assets || !result.assets[0]) {
            Alert.alert('No file picked');
            return;
          }
          Alert.alert('Picked', result.assets[0].name);
        }}
      />
    </View>
  );
}
