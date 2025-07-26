import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import ColorPalette from 'react-native-color-palette';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Pdf from 'react-native-pdf';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Path, Rect, Text as SvgText } from 'react-native-svg';

// --- Type Definitions ---
interface Props {
  uri: string;
  pdfId: string;
  onClose: () => void;
}

type DrawPath = { id: string; d: string; color: string };
type TextNote = {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
};
type HistoryItem = { type: 'path' | 'text'; id: string };
type RectType = { x: number; y: number; width: number; height: number };

// --- Helper Functions ---
function pathContainsPoint(d: string, x: number, y: number, threshold = 15): boolean {
  const coords = d.match(/[-\d.]+/g)?.map(Number);
  if (!coords) return false;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < coords.length; i += 2) {
    xs.push(coords[i]);
    ys.push(coords[i + 1]);
  }
  const minX = Math.min(...xs) - threshold;
  const maxX = Math.max(...xs) + threshold;
  const minY = Math.min(...ys) - threshold;
  const maxY = Math.max(...ys) + threshold;
  return x >= minX && x <= maxX && y >= minY && y <= maxY;
}

function rectContainsPoint(
  rect: RectType,
  x: number,
  y: number,
  threshold = 10
): boolean {
  const left = Math.min(rect.x, rect.x + rect.width) - threshold;
  const right = Math.max(rect.x, rect.x + rect.width) + threshold;
  const top = Math.min(rect.y, rect.y + rect.height) - threshold;
  const bottom = Math.max(rect.y, rect.y + rect.height) + threshold;
  return x >= left && x <= right && y >= top && y <= bottom;
}

export const PdfAnnotator = ({ uri, pdfId, onClose }: Props) => {
  const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

  // --- State ---
  const [paths, setPaths] = useState<DrawPath[]>([]);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [mode, setMode] = useState<'draw' | 'text' | 'erase'>('draw');
  const [drawColor, setDrawColor] = useState<string>('#ff0000');
  const activeColor = useRef<string>(drawColor);
  const [texts, setTexts] = useState<TextNote[]>([]);
  const [selectedTextIndex, setSelectedTextIndex] = useState<number | null>(null);
  const [textInput, setTextInput] = useState<string>('');
  const [textRect, setTextRect] = useState<RectType | null>(null);
  const [drawingRect, setDrawingRect] = useState<RectType | null>(null);
  const [pickerVisible, setPickerVisible] = useState<boolean>(false);
  const historyRef = useRef<HistoryItem[]>([]);
  const STORAGE_KEY = `annotations-${pdfId}`;

  // --- Sidebar State & Animation ---
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const sidebarX = useSharedValue(screenWidth - 80);
  const sidebarY = useSharedValue(100);
  const dragContext = useSharedValue({ x: 0, y: 0 });

  // Load and Save Annotations
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const { paths: storedPaths, texts: storedTexts, history: storedHistory } = JSON.parse(stored);
          setPaths(storedPaths || []);
          setTexts(storedTexts || []);
          historyRef.current = storedHistory || [];
        }
      } catch (e) {
        console.warn('Failed to load annotations', e);
      }
    })();
  }, [STORAGE_KEY]);

  useEffect(() => {
    const dataToSave = JSON.stringify({ paths, texts, history: historyRef.current });
    AsyncStorage.setItem(STORAGE_KEY, dataToSave).catch(e => console.warn('Save error', e));
  }, [paths, texts, STORAGE_KEY]);


  const undoLast = () => {
    const lastAction = historyRef.current.pop();
    if (!lastAction) return;

    if (lastAction.type === 'path') {
      setPaths(prev => prev.filter(p => p.id !== lastAction.id));
    } else {
      setTexts(prev => prev.filter(t => t.id !== lastAction.id));
    }
  };

  const eraseAtPoint = (x: number, y: number) => {
    setPaths(prev => prev.filter(p => !pathContainsPoint(p.d, x, y)));
    setTexts(prev => prev.filter(t => t && !rectContainsPoint(t, x, y)));
  };

  // --- Gestures ---
  const pdfDrawGesture = Gesture.Pan()
    .onBegin(e => {
      if (mode === 'draw') {
        activeColor.current = drawColor;
        setCurrentPath(`M${e.x},${e.y}`);
      } else if (mode === 'text') {
        setDrawingRect({ x: e.x, y: e.y, width: 0, height: 0 });
      } else if (mode === 'erase') {
        eraseAtPoint(e.x, e.y);
      }
    })
    .onUpdate(e => {
      if (mode === 'draw' && currentPath) {
        setCurrentPath(prev => `${prev} L${e.x},${e.y}`);
      } else if (mode === 'text' && drawingRect) {
        setDrawingRect({ ...drawingRect, width: e.x - drawingRect.x, height: e.y - drawingRect.y });
      } else if (mode === 'erase') {
        eraseAtPoint(e.x, e.y);
      }
    })
    .onEnd(() => {
      if (mode === 'draw' && currentPath) {
        const id = Date.now().toString();
        setPaths(prev => [...prev, { id, d: currentPath, color: activeColor.current }]);
        historyRef.current.push({ type: 'path', id });
        setCurrentPath(null);
      } else if (mode === 'text' && drawingRect) {
        const finalRect = {
          x: drawingRect.width < 0 ? drawingRect.x + drawingRect.width : drawingRect.x,
          y: drawingRect.height < 0 ? drawingRect.y + drawingRect.height : drawingRect.y,
          width: Math.abs(drawingRect.width),
          height: Math.abs(drawingRect.height),
        };
        if (finalRect.width > 5 && finalRect.height > 5) {
          setTextRect(finalRect);
        }
        setDrawingRect(null);
      }
    })
    .minDistance(1);
    
  const sidebarDragGesture = Gesture.Pan()
    .onStart(() => {
        dragContext.value = { x: sidebarX.value, y: sidebarY.value };
    })
    .onUpdate(event => {
        sidebarX.value = dragContext.value.x + event.translationX;
        sidebarY.value = dragContext.value.y + event.translationY;
    })
    .onEnd(() => {
        if (sidebarX.value > screenWidth / 2) {
            sidebarX.value = withSpring(screenWidth - (sidebarVisible ? 200 : 80));
        } else {
            sidebarX.value = withSpring(20);
        }
        if (sidebarY.value < 50) sidebarY.value = withSpring(50);
        if (sidebarY.value > screenHeight - 200) sidebarY.value = withSpring(screenHeight - 200);
    });

  const animatedSidebarStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: sidebarX.value }, { translateY: sidebarY.value }],
    };
  });


  // --- Text Handling ---
  const handleConfirmText = () => {
    if (!textRect || !textInput.trim()) {
      setTextInput('');
      setTextRect(null);
      setSelectedTextIndex(null);
      return;
    }

    if (selectedTextIndex !== null) {
      const originalText = texts[selectedTextIndex];
      const updatedText = { ...originalText, text: textInput, ...textRect };
      setTexts(prev => prev.map((t, i) => (i === selectedTextIndex ? updatedText : t)));
    } else {
      const id = Date.now().toString();
      const newText: TextNote = {
        id, text: textInput, ...textRect, color: '#000000',
        width: Math.max(textRect.width, 50), height: Math.max(textRect.height, 20),
      };
      setTexts(prev => [...prev, newText]);
      historyRef.current.push({ type: 'text', id });
    }
    setTextInput('');
    setTextRect(null);
    setSelectedTextIndex(null);
  };

  const handleSelectText = (t: TextNote, index: number) => {
    setSelectedTextIndex(index);
    setTextInput(t.text);
    setTextRect({ x: t.x, y: t.y, width: t.width, height: t.height });
    setMode('text');
  };

  const handleDeleteText = () => {
    if (selectedTextIndex !== null) {
      setTexts(ts => ts.filter((_, idx) => idx !== selectedTextIndex));
      setSelectedTextIndex(null);
      setTextInput('');
      setTextRect(null);
    }
  };

  // --- Component Render ---
  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.viewer}>
        <Pdf source={{ uri }} style={styles.pdf} singlePage={true}/>
        <GestureDetector gesture={pdfDrawGesture}>
          <Svg style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {paths.map(p => (
              <Path key={p.id} d={p.d} stroke={p.color} strokeWidth={3} fill="none" />
            ))}
            {currentPath && (
              <Path d={currentPath} stroke={activeColor.current} strokeWidth={3} fill="none" />
            )}
            {texts.map((t, i) => (
              <React.Fragment key={t.id}>
                <Rect
                  x={t.x} y={t.y} width={t.width} height={t.height}
                  stroke={selectedTextIndex === i ? '#FF9900' : 'transparent'}
                  strokeWidth={2} fill="transparent"
                  onPress={() => handleSelectText(t, i)}
                />
                <SvgText x={t.x + 5} y={t.y + 16} fill={t.color} fontSize={16} fontWeight="bold">
                  {t.text}
                </SvgText>
              </React.Fragment>
            ))}
            {drawingRect && (
              <Rect
                x={drawingRect.x} y={drawingRect.y} width={drawingRect.width} height={drawingRect.height}
                stroke="grey" strokeDasharray="4" strokeWidth={1} fill="rgba(0,0,0,0.1)"
              />
            )}
          </Svg>
        </GestureDetector>
      </View>

      {textRect && mode === 'text' && (
        <View style={styles.textInputContainer}>
          <TextInput value={textInput} onChangeText={setTextInput} placeholder="Enter text" style={styles.input} autoFocus />
          <TouchableOpacity onPress={handleConfirmText} style={styles.addTextBtn}>
            <Text style={styles.btnText}>Done</Text>
          </TouchableOpacity>
          {selectedTextIndex !== null && (
            <TouchableOpacity onPress={handleDeleteText} style={styles.addTextBtn}>
              <Text style={[styles.btnText, { color: '#D11A2A' }]}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* --- Draggable Sidebar --- */}
      <GestureDetector gesture={sidebarDragGesture}>
          <Animated.View style={[styles.sidebarContainer, animatedSidebarStyle]}>
              { sidebarVisible ? (
                  // --- EXPANDED VIEW ---
                  <View style={styles.sidebarExpanded}>
                      <TouchableOpacity onPress={() => setSidebarVisible(false)} style={styles.sidebarHeader}>
                          <Ionicons name="chevron-forward" size={24} color="#555" />
                      </TouchableOpacity>
                      <View style={styles.toolGrid}>
                          <TouchableOpacity onPress={() => setMode('draw')} style={styles.toolBtn}>
                              <Ionicons name="pencil" size={24} color={mode === 'draw' ? '#007AFF' : '#444'}/>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setMode('text')} style={styles.toolBtn}>
                              <Ionicons name="text" size={24} color={mode === 'text' ? '#007AFF' : '#444'}/>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setMode('erase')} style={styles.toolBtn}>
                              <MaterialCommunityIcons name="eraser" size={24} color={mode === 'erase' ? '#007AFF' : '#444'}/>
                          </TouchableOpacity>
                           <TouchableOpacity onPress={undoLast} style={styles.toolBtn}>
                               <Ionicons name="arrow-undo" size={24} color="#444" />
                           </TouchableOpacity>
                      </View>
                      {mode === 'draw' && (
                           <View style={styles.colorRow}>
                                {['#ff0000', '#00aa00', '#0000ff', '#000000'].map(c => (
                                <TouchableOpacity key={c} onPress={() => setDrawColor(c)} style={[ styles.colorSwatch, { backgroundColor: c, borderColor: drawColor === c ? '#007AFF' : '#fff' }]} />
                                ))}
                                <TouchableOpacity onPress={() => setPickerVisible(true)} style={[styles.colorSwatch, styles.centerContent]}>
                                <Ionicons name="color-palette" size={20} color="#444" />
                                </TouchableOpacity>
                           </View>
                      )}
                  </View>
              ) : (
                  // --- COLLAPSED VIEW (FAB) ---
                  <TouchableOpacity onPress={() => setSidebarVisible(true)} style={styles.fab}>
                      <Ionicons name="ellipsis-horizontal" size={28} color="white" />
                  </TouchableOpacity>
              )}
          </Animated.View>
      </GestureDetector>

      <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close-circle" size={32} color="rgba(0,0,0,0.6)" />
      </TouchableOpacity>
      
      <Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={() => setPickerVisible(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setPickerVisible(false)}>
          <View style={styles.colorPickerContainer} onStartShouldSetResponder={() => true}>
            <ColorPalette onChange={(color: string) => setDrawColor(color)} value={drawColor}
              colors={['#C0392B','#E74C3C','#9B59B6','#8E44AD','#2980B9','#3498DB','#1ABC9C','#16A085','#27AE60','#2ECC71','#F1C40F','#F39C12','#E67E22','#D35400','#FFFFFF','#000000']}
              title={"Select a color:"}
            />
          </View>
        </TouchableOpacity>
      </Modal>

    </GestureHandlerRootView>
  );
}


const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#e5e5e5' },
    viewer: { flex: 1, position: 'relative' },
    pdf: { flex: 1, backgroundColor: '#f0f0f0' },
    closeBtn: { position: 'absolute', top: (Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 20) + 10, left: 15, zIndex: 10 },
    btnText: { color: '#007AFF', fontWeight: 'bold', fontSize: 16 },
    
    // -- Sidebar Styles --
    sidebarContainer: { position: 'absolute', zIndex: 20, },
    fab: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(0, 122, 255, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    sidebarExpanded: {
        width: 180,
        backgroundColor: 'rgba(250, 250, 250, 0.92)',
        borderRadius: 20,
        padding: 10,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    sidebarHeader: {
        alignItems: 'flex-start',
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
        paddingBottom: 5,
        marginBottom: 10,
    },
    toolGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-around',
    },
    toolBtn: {
        width: '45%',
        alignItems: 'center',
        paddingVertical: 15,
    },
    colorRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: '#ddd',
      marginTop: 10,
    },
    colorSwatch: {
      width: 28,
      height: 28,
      borderRadius: 14,
      marginHorizontal: 5,
      borderWidth: 3,
    },
    centerContent: { justifyContent: 'center', alignItems: 'center' },

    // -- Text Input Styles --
    textInputContainer: {
        position: 'absolute',
        bottom: 40, left: 20, right: 20,
        flexDirection: 'row',
        backgroundColor: 'white',
        padding: 10, borderRadius: 8,
        elevation: 4, shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25, shadowRadius: 3.84,
    },
    input: {
        flex: 1, borderWidth: 1, borderColor: '#ccc',
        marginRight: 10, padding: 8, borderRadius: 4, fontSize: 16,
    },
    addTextBtn: { justifyContent: 'center', paddingHorizontal: 10 },
    
    // -- Color Picker Modal Styles --
    pickerOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    colorPickerContainer: {
        width: '80%',
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
    },
});