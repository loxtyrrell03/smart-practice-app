/* ------------------------------------------------------------------
   Folder & PDF grid (safe picker) • app/folders.tsx
------------------------------------------------------------------- */

import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Dimensions,
  FlatList,
  InteractionManager,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';

import {
  Folder,
  Item,
  PdfFile,
  addChildFolder,
  addFileToFolder,
  deleteChildFolder,
  deleteFileFromFolder,
  getChildFiles,
  getChildFolders,
  getDescendantFolderIds,
  getFolderPath,
  moveItem
} from './utils/folderHelpers';

/* ---------- constants ---------- */
const W = Dimensions.get('window').width;
const TILE_SPACING = 18;
const TILE = (W - 40 - TILE_SPACING * 2) / 3;

/* ================================================================= */
export default function FolderScreen({ parentFolder }: { parentFolder: Folder | null }) {
  const router = useRouter();
  const safeTop = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 20;

  /* ---------- state ---------- */
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [currentPdfUri, setCurrentPdfUri] = useState<string | null>(null);
  const [menuState, setMenuState] = useState<{ visible: boolean; x: number; y: number; item: Item | null }>({ visible: false, x: 0, y: 0, item: null });
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [movePath, setMovePath] = useState<(Folder | null)[]>([null]);
  const [refreshKey, setRefreshKey] = useState(0); // More reliable refresh mechanism
  // [RESTORED] State for sorting
  const [sortOpen, setSortOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<'name-asc' | 'name-desc' | 'newest' | 'oldest'>('name-asc');
  
  const currentMoveFolder = movePath[movePath.length - 1];

  /* ---------- derived data ---------- */
  const { name: title, path: subtitle } = getFolderPath(parentFolder?.id ?? null);
  const foldersForMove = getChildFolders(currentMoveFolder?.id);

  // [REWRITTEN] This logic now correctly sorts data and reliably refreshes.
  const items: Item[] = useMemo(() => {
    const folders = getChildFolders(parentFolder?.id);
    const files = getChildFiles(parentFolder?.id);

    const sortFn = (a: Item, b: Item) => {
      switch (sortOrder) {
        case 'name-desc': return b.name.localeCompare(a.name);
        case 'newest': return +b.id - +a.id;
        case 'oldest': return +a.id - +b.id;
        case 'name-asc':
        default:
          return a.name.localeCompare(b.name);
      }
    };

    return [...folders.sort(sortFn), ...files.sort(sortFn)];
  }, [parentFolder, sortOrder, refreshKey]);


  /* ---------- CRUD & Move Logic ---------- */
  const makeFolder = () => {
    if (!newName.trim()) return;
    const f: Folder = { id: Date.now().toString(), name: newName.trim(), type: 'folder', children: [], files: [] };
    addChildFolder(parentFolder?.id ?? null, f);
    setNewName('');
    setCreateOpen(false);
    setRefreshKey(k => k + 1);
  };

  const removeItem = (item: Item) => {
    if (item.type === 'folder') deleteChildFolder(parentFolder?.id ?? null, item.id);
    else deleteFileFromFolder(parentFolder?.id ?? null, item.id);
    setMenuState({ visible: false, x: 0, y: 0, item: null });
    setRefreshKey(k => k + 1);
  };

  const onMovePress = () => {
    setMenuState(prev => ({ ...prev, visible: false }));
    setMovePath([null]);
    setMoveModalVisible(true);
  };

  const handleMoveConfirm = () => {
    if (!menuState.item) return;
    const destinationId = currentMoveFolder?.id ?? null;
    moveItem(menuState.item, parentFolder?.id ?? null, destinationId);
    setMoveModalVisible(false);
    setRefreshKey(k => k + 1);
  };

  const navigateMoveForward = (folder: Folder) => {
    if (menuState.item?.type === 'folder') {
      const descendantIds = getDescendantFolderIds(menuState.item.id);
      if (folder.id === menuState.item.id || descendantIds.includes(folder.id)) {
        Alert.alert("Invalid Destination", "A folder cannot be moved into itself or one of its own subfolders.");
        return;
      }
    }
    setMovePath(prev => [...prev, folder]);
  };

  const navigateMoveBack = () => {
    if (movePath.length > 1) setMovePath(prev => prev.slice(0, -1));
  };
  
  /* ---------- Other Handlers ---------- */
  const importPdf = () => {
    InteractionManager.runAfterInteractions(async () => {
      try {
        const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
        if (res.canceled || !res.assets?.[0]) return;
        const a = res.assets[0];
        const pdf: PdfFile = { id: Date.now().toString(), name: a.name, uri: a.uri, type: 'pdf' };
        addFileToFolder(parentFolder?.id ?? null, pdf);
        setRefreshKey(k => k + 1);
      } catch (e) {
        Alert.alert('Picker error', String(e));
      }
    });
  };

  const openPlus = () => {
    const opts = ['Create Folder', 'Import PDF', 'Cancel'];
    const create = () => setCreateOpen(true);
    const pick = () => importPdf();
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ options: opts, cancelButtonIndex: 2 }, i => { if (i === 0) create(); if (i === 1) pick(); });
    } else {
      Alert.alert('Add', undefined, [{ text: 'Create Folder', onPress: create }, { text: 'Import PDF', onPress: pick }, { text: 'Cancel', style: 'cancel' }]);
    }
  };
  
  const openPdfViewer = (uri: string) => {
    setCurrentPdfUri(uri);
    setPdfViewerOpen(true);
  };

  const openItemMenu = (item: Item, event: { pageX: number; pageY: number }) => {
    setMenuState({ visible: true, x: event.pageX, y: event.pageY, item: item });
  };
  
  /* -----------------------------  RENDER  ----------------------------- */
  return (
    <View style={styles.container}>
      <View style={[styles.headerContainer, { paddingTop: safeTop }]}>
        <View style={styles.headerTopRow}>
            <View style={styles.headerLeft}>
                {parentFolder && (
                <TouchableOpacity onPress={router.back} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={34} color="#007AFF" />
                </TouchableOpacity>
                )}
                <Text style={styles.titleText}>{title}</Text>
            </View>
            <View style={styles.headerActions}>
                {/* [RESTORED] Sort button */}
                <TouchableOpacity style={styles.sortBtn} onPress={() => setSortOpen(o => !o)}>
                    <MaterialIcons name="sort" size={24} color="#424242" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.addBtn} onPress={openPlus}>
                    <Ionicons name="add" size={22} color="#fff" />
                </TouchableOpacity>
            </View>
        </View>
        <Text style={styles.subtitleText}>{subtitle}</Text>
      </View>
      
      {/* [RESTORED] Sort dropdown */}
      {sortOpen && (
        <View style={styles.sortMenu}>
          {[ ['name-asc', 'Name (A–Z)'], ['name-desc', 'Name (Z–A)'], ['newest', 'Newest'], ['oldest', 'Oldest'] ].map(([k, l]) => (
            <TouchableOpacity key={k} onPress={() => { setSortOrder(k as any); setSortOpen(false); }}>
              <Text style={styles.sortOption}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <FlatList
        data={items}
        extraData={refreshKey}
        numColumns={3}
        keyExtractor={i => i.type + i.id}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={{ justifyContent: 'flex-start', gap: TILE_SPACING }}
        renderItem={({ item }) => (
            <View style={styles.tile}>
              <TouchableOpacity style={styles.menuBtn} onPress={e => openItemMenu(item, e.nativeEvent)} hitSlop={12}>
                <MaterialCommunityIcons name="dots-vertical" size={20} color="#555" />
              </TouchableOpacity>
              <Pressable 
                style={styles.tilePress} 
                onPress={() => item.type === 'folder' 
                    ? router.push({ pathname: '/folder/[id]', params: { id: item.id } })
                    : openPdfViewer(item.uri)
                }
              >
                <Ionicons name={item.type === 'folder' ? "folder" : "document"} size={28} color={item.type === 'folder' ? "#62a0ea" : "#FF5252"} style={{ marginBottom: 6 }} />
                <Text numberOfLines={2} style={styles.tileLabel}>{item.name}</Text>
              </Pressable>
            </View>
        )}
      />

      <Modal visible={createOpen} transparent animationType="fade" onRequestClose={() => setCreateOpen(false)}>
        <View style={styles.overlay}><View style={styles.modal}>
            <Text style={styles.modalTitle}>Create Folder</Text>
            <TextInput style={styles.input} placeholder="Folder name" value={newName} onChangeText={setNewName} autoFocus />
            <View style={styles.modalBtns}>
              <TouchableOpacity onPress={() => setCreateOpen(false)}><Text style={styles.cancel}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={makeFolder}><Text style={styles.create}>Create</Text></TouchableOpacity>
            </View>
        </View></View>
      </Modal>

      <Modal visible={pdfViewerOpen} animationType="slide" onRequestClose={() => setPdfViewerOpen(false)}>
        <View>
          <TouchableOpacity style={styles.pdfViewerCloseButton} onPress={() => setPdfViewerOpen(false)}>
            <Ionicons name="close-circle" size={30} color="#007AFF" />
          </TouchableOpacity>
          {currentPdfUri && <WebView source={{ uri: currentPdfUri }} style={styles.pdfWebView} />}
        </View>
      </Modal>

      <Modal visible={menuState.visible} transparent animationType="fade" onRequestClose={() => setMenuState({ ...menuState, visible: false })}>
        <Pressable style={styles.menuOverlay} onPress={() => setMenuState({ ...menuState, visible: false })}>
          <View style={[styles.itemMenu, { top: menuState.y, left: menuState.x - 120 }]}>
            <TouchableOpacity style={styles.itemMenuOption} onPress={onMovePress}><Text>Move</Text></TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.itemMenuOption} onPress={() => Alert.alert('Delete Item', `Are you sure you want to delete "${menuState.item?.name}"?`, [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: () => removeItem(menuState.item!) }])}>
              <Text style={{ color: '#D11A2A' }}>Delete</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={moveModalVisible} transparent animationType="fade" onRequestClose={() => setMoveModalVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setMoveModalVisible(false)}>
          <Pressable style={styles.moveModalContainer}>
            <View style={styles.moveHeader}>
                <TouchableOpacity onPress={navigateMoveBack} disabled={movePath.length === 1} style={styles.moveBackBtn}>
                    <Ionicons name="arrow-back" size={24} color={movePath.length === 1 ? '#ccc' : '#007AFF'}/>
                </TouchableOpacity>
                <Text style={styles.moveTitle} numberOfLines={1}>Move to: {currentMoveFolder?.name ?? 'Home'}</Text>
            </View>
            <FlatList
                style={styles.moveList}
                data={foldersForMove}
                keyExtractor={(item) => item.id}
                renderItem={({item}) => (
                    <TouchableOpacity style={styles.moveDestination} onPress={() => navigateMoveForward(item)}>
                        <Ionicons name="folder-outline" size={22} color="#62a0ea" />
                        <Text style={styles.moveDestinationText}>{item.name}</Text>
                        <Ionicons name="chevron-forward" size={20} color="#ccc" />
                    </TouchableOpacity>
                )}
                ListEmptyComponent={<View style={styles.emptyListContainer}><Text style={styles.emptyListText}>No subfolders</Text></View>}
            />
            <View style={styles.moveFooter}>
                <TouchableOpacity 
                    style={[styles.moveConfirmBtn, {opacity: (currentMoveFolder?.id ?? null) === (parentFolder?.id ?? null) ? 0.5 : 1}]} 
                    disabled={(currentMoveFolder?.id ?? null) === (parentFolder?.id ?? null)}
                    onPress={handleMoveConfirm}
                >
                    <Text style={styles.moveConfirmText}>Move Item Here</Text>
                </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/* --------------------------- STYLES --------------------------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6faff' },
  headerContainer: { paddingHorizontal: 20, paddingBottom: 10, backgroundColor: '#f6faff', zIndex: 100, borderBottomWidth: 1, borderBottomColor: '#e5e5ea' },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  backBtn: { marginRight: 6, marginLeft: -8 },
  titleText: { fontSize: 34, fontWeight: 'bold' },
  subtitleText: { fontSize: 15, color: '#8e8e93', paddingLeft: 4 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  sortBtn: { backgroundColor: '#e9e9eb', padding: 8, borderRadius: 20, marginRight: 10 },
  addBtn: { backgroundColor: '#007AFF', borderRadius: 22, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', elevation: 3 },
  sortMenu: { position: 'absolute', top: 110, right: 70, backgroundColor: '#fff', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 14, elevation: 5, shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, zIndex: 1000 },
  sortOption: { fontSize: 15, paddingVertical: 7, minWidth: 110, color: '#444' },
  grid: { paddingTop: 10, paddingBottom: 48, paddingHorizontal: 20 },
  tile: { backgroundColor: '#fff', borderRadius: 16, width: TILE, height: TILE, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e5e5ea', marginBottom: TILE_SPACING },
  tilePress: { alignItems: 'center', flex: 1, justifyContent: 'center', width: '100%', padding: 4 },
  tileLabel: { fontSize: 13.5, fontWeight: '600', color: '#384454', textAlign: 'center', maxWidth: TILE - 10, marginTop: 4 },
  menuBtn: { position: 'absolute', top: 4, right: 4, padding: 4, zIndex: 10 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  modal: { width: '85%', backgroundColor: '#fff', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 11, borderRadius: 7, fontSize: 16, marginTop: 4 },
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 22 },
  cancel: { marginRight: 18, fontSize: 16, color: '#555' },
  create: { color: '#007AFF', fontSize: 16, fontWeight: 'bold' },
  pdfWebView: { width: '100%', height: '100%' },
  pdfViewerCloseButton: { position: 'absolute', top: 50, right: 20, zIndex: 1, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 15, padding: 2 },
  menuOverlay: { flex: 1 },
  itemMenu: { position: 'absolute', backgroundColor: 'white', borderRadius: 8, paddingVertical: 5, width: 120, elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  itemMenuOption: { paddingVertical: 12, paddingHorizontal: 15 },
  menuDivider: { height: 1, backgroundColor: '#eee' },
  moveModalContainer: { width: '90%', height: '65%', backgroundColor: '#f6faff', borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  moveHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#e5e5ea' },
  moveBackBtn: { padding: 5 },
  moveTitle: { fontSize: 17, fontWeight: '600', flex: 1, textAlign: 'center', marginHorizontal: 10 },
  moveList: { flex: 1 },
  moveDestination: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  moveDestinationText: { marginLeft: 15, fontSize: 16, flex: 1 },
  emptyListContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyListText: { color: '#8e8e93' },
  moveFooter: { padding: 20, borderTopWidth: 1, borderTopColor: '#e5e5ea', backgroundColor: '#fff' },
  moveConfirmBtn: { backgroundColor: '#007AFF', padding: 15, borderRadius: 12, alignItems: 'center' },
  moveConfirmText: { color: '#fff', fontSize: 17, fontWeight: '600' },
});

//test