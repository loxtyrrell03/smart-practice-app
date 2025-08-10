import { useLocalSearchParams } from 'expo-router';
import FolderScreen from '../../folders';
import { getFolderById } from '../../utils/folderHelpers';

export const options = { headerShown: false };   // hides default bar

export default function FolderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const folder = getFolderById(id);
  return <FolderScreen parentFolder={folder} />;
}

