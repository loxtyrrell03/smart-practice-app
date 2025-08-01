import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';
import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  InteractionManager,
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
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path, PathProps, Rect, Text as SvgText } from 'react-native-svg';

// --- Type Definitions ---
interface Props {
  uri: string;
  pdfId: string;
  onClose: () => void;
}

type DrawPath = { id: string; d: string; color: string; page: number };
type TextNote = {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  page: number;
  fontSize: number;
};
type HistoryItem = { type: 'path' | 'text'; id: string };
type RectType = { x: number; y: number; width: number; height: number };

// --- Helper Functions ---
function pathContainsPoint(d: string, x: number, y: number, threshold = 15): boolean {
  const coords = d.match(/[-\d.]+/g)?.map(Number);
  if (!coords) return false;
  for (let i = 0; i < coords.length; i += 2) {
    const px = coords[i];
    const py = coords[i + 1];
    if (Math.sqrt((px - x) ** 2 + (py - y) ** 2) < threshold) {
      return true;
    }
  }
  return false;
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

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const DEFAULT_FONT_SIZE = 16;
const FONT_SIZE_RATIO = 0.4;

export const PdfAnnotator = ({ uri, pdfId, onClose }: Props) => {
  const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

  // --- State ---
  const [paths, setPaths] = useState<DrawPath[]>([]);
  const currentPath = useSharedValue<string | null>(null);
  const [mode, setMode] = useState<'draw' | 'text' | 'erase' | 'cursor'>('draw');
  const [drawColor, setDrawColor] = useState<string>('#CD5C5C');
  const activeColor = useRef<string>(drawColor);
  const [texts, setTexts] = useState<TextNote[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [textInput, setTextInput] = useState<string>('');
  const [textRect, setTextRect] = useState<RectType | null>(null);
  const [pickerVisible, setPickerVisible] = useState<boolean>(false);
  const historyRef = useRef<HistoryItem[]>([]);
  const STORAGE_KEY = `annotations-${pdfId}`;

  // --- Animated Shared Values for Gestures ---
  const textGestureRect = useSharedValue<RectType | null>(null);
  const eraseGesturePoints = useSharedValue<{ x: number; y: number }[]>([]);
  const resizeDragContext = useSharedValue<{ x: number; y: number; width: number; height: number } | null>(null);

  // --- Page Navigation State ---
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [pageInput, setPageInput] = useState<string>('1');
  const [isNavVisible, setIsNavVisible] = useState(true);
  const navBarY = useSharedValue(100);

  // --- Sidebar State & Animation ---
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [sidebarOrientation, setSidebarOrientation] = useState<'vertical' | 'horizontal'>('vertical');
  const sidebarX = useSharedValue(screenWidth - 70);
  const sidebarY = useSharedValue(100);
  const dragContext = useSharedValue({ x: 0, y: 0 });

  useEffect(() => {
    activeColor.current = drawColor;
  }, [drawColor]);

  // Load and Save Annotations
  useEffect(() => {
    const loadAnnotations = async () => {
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
    };

    const task = InteractionManager.runAfterInteractions(() => {
      loadAnnotations();
    });

    return () => task.cancel();
  }, [STORAGE_KEY]);

  useEffect(() => {
    const dataToSave = JSON.stringify({ paths, texts, history: historyRef.current });
    AsyncStorage.setItem(STORAGE_KEY, dataToSave).catch(e => console.warn('Save error', e));
  }, [paths, texts, STORAGE_KEY]);

  // Animate Nav Bar
  useEffect(() => {
    if (totalPages > 1) {
        navBarY.value = withTiming(isNavVisible ? 0 : 100, { duration: 250 });
    }
  }, [isNavVisible, totalPages]);


  const undoLast = () => {
    const lastAction = historyRef.current.pop();
    if (!lastAction) return;

    if (lastAction.type === 'path') {
      setPaths(prev => prev.filter(p => p.id !== lastAction.id));
    } else {
      setTexts(prev => prev.filter(t => t.id !== lastAction.id));
    }
  };

  const eraseAtPoints = (points: { x: number; y: number }[]) => {
    if (points.length === 0) return;
    const pathIdsToDelete = new Set<string>();
    const textIdsToDelete = new Set<string>();

    points.forEach(point => {
        paths.forEach(p => {
            if (p.page === currentPage && pathContainsPoint(p.d, point.x, point.y)) {
                pathIdsToDelete.add(p.id);
            }
        });
        texts.forEach(t => {
            if (t.page === currentPage && rectContainsPoint(t, point.x, point.y)) {
                textIdsToDelete.add(t.id);
            }
        });
    });

    if (pathIdsToDelete.size > 0) {
        setPaths(current => current.filter(p => !pathIdsToDelete.has(p.id)));
    }
    if (textIdsToDelete.size > 0) {
        setTexts(current => current.filter(t => !textIdsToDelete.has(t.id)));
    }
  };
  
  // --- Gesture Handler Worklets ---
  const finishDrawing = (path: string) => {
    if (!path) return;
    const id = Date.now().toString();
    setPaths(prev => [...prev, { id, d: path, color: activeColor.current, page: currentPage }]);
    historyRef.current.push({ type: 'path', id });
    currentPath.value = null;
  };
  
  const finishTextRect = (rect: RectType | null) => {
    if (rect) {
      const finalRect = {
        x: rect.width < 0 ? rect.x + rect.width : rect.x,
        y: rect.height < 0 ? rect.y + rect.height : rect.y,
        width: Math.abs(rect.width),
        height: Math.abs(rect.height),
      };
      if (finalRect.width > 10 && finalRect.height > 10) {
        setTextRect(finalRect);
        setTextInput('');
      }
    }
    textGestureRect.value = null;
  };

  const updateTextSize = (id: string, width: number, height: number) => {
    setTexts(current => current.map(t => t.id === id ? { ...t, width: Math.max(50, width), height: Math.max(40, height), fontSize: Math.max(10, height * FONT_SIZE_RATIO) } : t));
  };

  // --- Gestures ---
  const pdfDrawGesture = Gesture.Pan()
    .enabled(mode !== 'cursor')
    .onBegin(e => {
      if (mode === 'draw') {
        runOnJS(setSelectedTextId)(null);
        currentPath.value = `M${e.x},${e.y}`;
      } else if (mode === 'text') {
        runOnJS(setSelectedTextId)(null);
        textGestureRect.value = { x: e.x, y: e.y, width: 0, height: 0 };
      } else if (mode === 'erase') {
        runOnJS(setSelectedTextId)(null);
        eraseGesturePoints.value = [{ x: e.x, y: e.y }];
      }
    })
    .onUpdate(e => {
      if (mode === 'draw' && currentPath.value) {
        currentPath.value = `${currentPath.value} L${e.x},${e.y}`;
      } else if (mode === 'text' && textGestureRect.value) {
        textGestureRect.value = { ...textGestureRect.value, width: e.x - textGestureRect.value.x, height: e.y - textGestureRect.value.y };
      } else if (mode === 'erase') {
        eraseGesturePoints.value = [...eraseGesturePoints.value, { x: e.x, y: e.y }];
      }
    })
    .onEnd(() => {
        if (mode === 'draw') {
            runOnJS(finishDrawing)(currentPath.value!);
        } else if (mode === 'text') {
            runOnJS(finishTextRect)(textGestureRect.value);
        } else if (mode === 'erase') {
            runOnJS(eraseAtPoints)(eraseGesturePoints.value);
            eraseGesturePoints.value = [];
        }
    })
    .minDistance(1);
    
  const resizeGesture = Gesture.Pan()
    .onBegin(e => {
        const text = texts.find(t => t.id === selectedTextId);
        if (text) {
            resizeDragContext.value = { x: e.x, y: e.y, width: text.width, height: text.height };
        }
    })
    .onUpdate(e => {
        if (resizeDragContext.value && selectedTextId) {
            const newWidth = resizeDragContext.value.width + e.translationX;
            const newHeight = resizeDragContext.value.height + e.translationY;
            runOnJS(updateTextSize)(selectedTextId, newWidth, newHeight);
        }
    })
    .onEnd(() => {
        resizeDragContext.value = null;
    });

  const sidebarDragGesture = Gesture.Pan()
    .onStart(() => {
        dragContext.value = { x: sidebarX.value, y: sidebarY.value };
    })
    .onUpdate(event => {
        sidebarX.value = dragContext.value.x + event.translationX;
        sidebarY.value = dragContext.value.y + event.translationY;
    })
    .onEnd(() => {
        const endX = sidebarX.value;
        const endY = sidebarY.value;
        const verticalThreshold = 60;

        if (endX < verticalThreshold || endX > screenWidth - verticalThreshold - (sidebarVisible ? 70 : 60)) {
            // Snap to sides (vertical)
            runOnJS(setSidebarOrientation)('vertical');
            sidebarX.value = withSpring(endX < screenWidth / 2 ? 10 : screenWidth - 70);
            sidebarY.value = withSpring(Math.max(50, Math.min(screenHeight - 250, endY)));
        } else {
            // Snap to top/bottom (horizontal)
            runOnJS(setSidebarOrientation)('horizontal');
            sidebarY.value = withSpring(endY < screenHeight / 2 ? 50 : screenHeight - 120);
            sidebarX.value = withSpring(Math.max(10, Math.min(screenWidth - 250, endX)));
        }
    });

  const animatedSidebarStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: sidebarX.value }, { translateY: sidebarY.value }],
    };
  });
  
  const animatedNavBarStyle = useAnimatedStyle(() => {
      return {
          transform: [{ translateY: navBarY.value }]
      }
  })

  const animatedPathProps = useAnimatedProps<PathProps>(() => {
    return {
      d: currentPath.value || '',
    };
  });

  const animatedRectProps = useAnimatedProps(() => {
    const rect = textGestureRect.value;
    if (!rect) return { width: 0, height: 0, x: 0, y: 0 };
    return {
        x: rect.width < 0 ? rect.x + rect.width : rect.x,
        y: rect.height < 0 ? rect.y + rect.height : rect.y,
        width: Math.abs(rect.width),
        height: Math.abs(rect.height),
    };
  });

  // --- Text Handling ---
  const handleConfirmText = () => {
    if (!textRect) return;

    if (selectedTextId) {
      setTexts(prev => prev.map(t => t.id === selectedTextId ? { ...t, text: textInput } : t));
    } else {
      const id = Date.now().toString();
      const newText: TextNote = {
        id, text: textInput, ...textRect, color: '#3D3D3D',
        width: Math.max(textRect.width, 50), height: Math.max(textRect.height, 40), page: currentPage, fontSize: DEFAULT_FONT_SIZE,
      };
      setTexts(prev => [...prev, newText]);
      historyRef.current.push({ type: 'text', id });
    }
    setTextInput('');
    setTextRect(null);
    setSelectedTextId(null);
  };

  const handleSelectText = (t: TextNote) => {
    if (selectedTextId === t.id) {
        handleEditText(t);
    } else {
        setSelectedTextId(t.id);
    }
  };

  const handleEditText = (t: TextNote) => {
    setSelectedTextId(t.id);
    setTextInput(t.text);
    setTextRect({ x: t.x, y: t.y, width: t.width, height: t.height });
  };

  const handleDeleteText = (id: string) => {
    setTexts(ts => ts.filter(t => t.id !== id));
    setSelectedTextId(null);
  };

  const handlePageInputChange = (text: string) => {
    const num = parseInt(text, 10);
    if (!isNaN(num) && num > 0 && num <= totalPages) {
      setCurrentPage(num);
    }
    setPageInput(text);
  };

  const isHorizontal = sidebarOrientation === 'horizontal';
  
  // --- Component Render ---
  return (
    <GestureHandlerRootView style={styles.container}>
        <View style={styles.viewer}>
            <Pdf 
                source={{ uri }} 
                style={styles.pdf} 
                page={currentPage}
                onLoadComplete={(numberOfPages) => setTotalPages(numberOfPages)}
                onPageChanged={(page) => {
                    setCurrentPage(page);
                    setPageInput(page.toString());
                }}
            />
            <GestureDetector gesture={pdfDrawGesture}>
                <View style={StyleSheet.absoluteFill} />
            </GestureDetector>
            <Svg style={StyleSheet.absoluteFill} pointerEvents="box-none">
                {paths.filter(p => p.page === currentPage).map(p => (
                <Path key={p.id} d={p.d} stroke={p.color} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                ))}
                <AnimatedPath
                animatedProps={animatedPathProps}
                stroke={activeColor.current}
                strokeWidth={4}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                />
                {texts.filter(t => t.page === currentPage).map((t) => (
                    <React.Fragment key={t.id}>
                        <Rect
                            x={t.x} y={t.y} width={t.width} height={t.height}
                            stroke={selectedTextId === t.id ? '#A0522D' : 'transparent'}
                            strokeWidth={2}
                            strokeDasharray={selectedTextId === t.id ? "6" : "none"}
                            fill="transparent"
                            onPress={() => mode === 'cursor' ? handleSelectText(t) : undefined}
                            pointerEvents={mode === 'cursor' ? 'auto' : 'none'}
                        />
                        <SvgText x={t.x + 8} y={t.y + t.height / 2 + t.fontSize / 3} fill={t.color} fontSize={t.fontSize} fontWeight="500" pointerEvents="none">
                        {t.text}
                        </SvgText>
                        {selectedTextId === t.id && (
                            <>
                                <Rect x={t.x - 8} y={t.y - 8} width={16} height={16} fill="#D11A2A" onPress={() => handleDeleteText(t.id)} pointerEvents="auto" />
                                <GestureDetector gesture={resizeGesture}>
                                    <Rect x={t.x + t.width - 8} y={t.y + t.height - 8} width={16} height={16} fill="#A0522D" pointerEvents="auto"/>
                                </GestureDetector>
                            </>
                        )}
                    </React.Fragment>
                ))}
                <AnimatedRect
                    animatedProps={animatedRectProps}
                    stroke="#D2B48C" strokeDasharray="6" strokeWidth={2} fill="rgba(210,180,140,0.1)"
                />
            </Svg>
        </View>

      {textRect && (
        <View style={styles.textInputContainer}>
          <TextInput value={textInput} onChangeText={setTextInput} placeholder="Add a note..." style={styles.input} autoFocus multiline />
          <TouchableOpacity onPress={handleConfirmText} style={styles.addTextBtn}>
            <Ionicons name="checkmark-circle" size={32} color="#8FBC8F"/>
          </TouchableOpacity>
        </View>
      )}

      {/* --- Page Navigation Bar --- */}
      {totalPages > 1 && !isNavVisible && (
          <TouchableOpacity style={styles.navToggleBtn} onPress={() => setIsNavVisible(true)}>
              <Ionicons name="chevron-up-outline" size={28} color="#5C5C5C"/>
          </TouchableOpacity>
      )}
      { totalPages > 1 && (
        <Animated.View style={[styles.navBar, animatedNavBarStyle]}>
            <TouchableOpacity onPress={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                <Ionicons name="chevron-back-circle-outline" size={36} color={currentPage === 1 ? '#C0C0C0' : '#5C5C5C'} />
            </TouchableOpacity>
            <View style={styles.navCenter}>
                <TextInput 
                    style={styles.pageInput}
                    value={pageInput}
                    onChangeText={setPageInput}
                    onSubmitEditing={() => handlePageInputChange(pageInput)}
                    keyboardType="number-pad"
                    returnKeyType="done"
                />
                <Text style={styles.pageText}>/ {totalPages}</Text>
            </View>
            <Slider 
                style={styles.slider}
                minimumValue={1}
                maximumValue={totalPages}
                step={1}
                value={currentPage}
                onSlidingComplete={(value: number) => setCurrentPage(value)}
                minimumTrackTintColor="#A0522D"
                maximumTrackTintColor="#D3D3D3"
                thumbTintColor="#FFFDF5"
            />
             <TouchableOpacity onPress={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                <Ionicons name="chevron-forward-circle-outline" size={36} color={currentPage === totalPages ? '#C0C0C0' : '#5C5C5C'} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.navCloseBtn} onPress={() => setIsNavVisible(false)}>
                 <Ionicons name="chevron-down-outline" size={28} color="#5C5C5C"/>
            </TouchableOpacity>
        </Animated.View>
      )}


      {/* --- Draggable Sidebar --- */}
      <GestureDetector gesture={sidebarDragGesture}>
          <Animated.View style={[styles.sidebarContainer, animatedSidebarStyle]}>
              { sidebarVisible ? (
                  // --- EXPANDED VIEW ---
                  <View style={[styles.sidebarExpanded, isHorizontal && styles.sidebarExpandedHorizontal]}>
                      <TouchableOpacity onPress={() => setSidebarVisible(false)} style={styles.sidebarHeader}>
                          <Ionicons name={isHorizontal ? "chevron-down" : "chevron-forward"} size={26} color="#555" />
                      </TouchableOpacity>
                      <View style={[styles.toolGrid, isHorizontal && styles.toolGridHorizontal]}>
                          <TouchableOpacity onPress={() => setMode('cursor')} style={styles.toolBtn}>
                              <MaterialCommunityIcons name="cursor-default" size={28} color={mode === 'cursor' ? '#A0522D' : '#333'}/>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setMode('draw')} style={styles.toolBtn}>
                              <Ionicons name="pencil-outline" size={28} color={mode === 'draw' ? '#A0522D' : '#333'}/>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setMode('text')} style={styles.toolBtn}>
                              <Ionicons name="text-outline" size={28} color={mode === 'text' ? '#A0522D' : '#333'}/>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setMode('erase')} style={styles.toolBtn}>
                              <MaterialCommunityIcons name="eraser-variant" size={28} color={mode === 'erase' ? '#A0522D' : '#333'}/>
                          </TouchableOpacity>
                           <TouchableOpacity onPress={undoLast} style={styles.toolBtn}>
                               <Ionicons name="arrow-undo-outline" size={28} color="#333" />
                           </TouchableOpacity>
                      </View>
                      {mode === 'draw' && (
                           <View style={[styles.colorRow, isHorizontal && styles.colorRowHorizontal]}>
                                {['#CD5C5C', '#8FBC8F', '#6495ED', '#3D3D3D'].map(c => (
                                <TouchableOpacity key={c} onPress={() => { setDrawColor(c); activeColor.current = c; }} style={[ styles.colorSwatch, { backgroundColor: c, transform: [{ scale: drawColor === c ? 1 : 0.8 }] }]} />
                                ))}
                                <TouchableOpacity onPress={() => setPickerVisible(true)} style={[styles.colorSwatch, styles.centerContent, { backgroundColor: '#eee'}]}>
                                    <Ionicons name="eyedrop-outline" size={20} color="#333" />
                                </TouchableOpacity>
                           </View>
                      )}
                  </View>
              ) : (
                  // --- COLLAPSED VIEW (FAB) ---
                  <TouchableOpacity onPress={() => setSidebarVisible(true)} style={styles.fab}>
                      <Ionicons name="ellipsis-horizontal" size={32} color="white" />
                  </TouchableOpacity>
              )}
          </Animated.View>
      </GestureDetector>

      <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close-circle" size={38} color="rgba(0,0,0,0.4)" />
      </TouchableOpacity>
      
      <Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={() => setPickerVisible(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setPickerVisible(false)}>
          <View style={styles.colorPickerContainer}>
            <ColorPalette onChange={(color: string) => { setDrawColor(color); activeColor.current = color; }} value={drawColor}
              colors={['#c0392b', '#e74c3c', '#9b59b6', '#8e44ad', '#2980b9', '#3498db', '#1abc9c', '#16a085', '#27ae60', '#2ecc71', '#f1c40f', '#f39c12', '#e67e22', '#d35400', '#7f8c8d', '#000000']}
              title={"Select a color:"}
            />
          </View>
        </TouchableOpacity>
      </Modal>

    </GestureHandlerRootView>
  );
}


const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFDF5' },
    viewer: { flex: 1, position: 'relative' },
    pdf: { flex: 1, backgroundColor: '#EAE7DC' },
    closeBtn: { position: 'absolute', top: (Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 20) + 10, left: 15, zIndex: 30, shadowRadius: 5, shadowOpacity: 0.3, shadowColor: '#000' },
    btnText: { color: '#A0522D', fontWeight: 'bold', fontSize: 16 },
    
    // -- Sidebar Styles --
    sidebarContainer: { position: 'absolute', zIndex: 20, },
    fab: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#A0522D',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
    },
    sidebarExpanded: {
        width: 64,
        backgroundColor: 'rgba(255, 253, 245, 0.95)',
        borderRadius: 32,
        paddingVertical: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#EAE7DC',
    },
    sidebarExpandedHorizontal: {
        width: 'auto',
        height: 64,
        flexDirection: 'row',
        paddingHorizontal: 10,
    },
    sidebarHeader: {
        paddingBottom: 5,
        marginBottom: 5,
    },
    toolGrid: {
        flexDirection: 'column',
        alignItems: 'center',
    },
    toolGridHorizontal: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    toolBtn: {
        paddingVertical: 12,
        paddingHorizontal: 15,
    },
    colorRow: {
      flexDirection: 'column',
      alignItems: 'center',
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: 'rgba(0,0,0,0.1)',
      marginTop: 10,
    },
    colorRowHorizontal: {
        flexDirection: 'row',
        borderTopWidth: 0,
        borderLeftWidth: 1,
        borderLeftColor: 'rgba(0,0,0,0.1)',
        marginTop: 0,
        marginLeft: 10,
        paddingLeft: 5,
    },
    colorSwatch: {
      width: 32,
      height: 32,
      borderRadius: 16,
      marginVertical: 5,
      marginHorizontal: 10,
    },
    centerContent: { justifyContent: 'center', alignItems: 'center' },

    // -- Text Input Styles --
    textInputContainer: {
        position: 'absolute',
        bottom: 40, 
        left: 20, right: 20,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFDF5',
        padding: 10, borderRadius: 15,
        elevation: 10, shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2, shadowRadius: 10,
        borderWidth: 1,
        borderColor: '#EAE7DC',
        zIndex: 10,
    },
    input: {
        flex: 1, 
        marginRight: 10, 
        padding: 10, 
        fontSize: 18,
    },
    addTextBtn: { justifyContent: 'center', paddingHorizontal: 10 },
    
    // -- Color Picker Modal Styles --
    pickerOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    colorPickerContainer: {
        width: '85%',
        backgroundColor: '#FFFDF5',
        borderRadius: 20,
        padding: 20,
    },

    // --- Page Navigation Styles ---
    navToggleBtn: {
        position: 'absolute',
        bottom: 0,
        left: '50%',
        marginLeft: -50, // half of width
        width: 100,
        height: 40,
        backgroundColor: '#FFFDF5',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#EAE7DC',
        borderBottomWidth: 0,
        elevation: 5,
        zIndex: 10,
    },
    navBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 100,
        backgroundColor: '#FFFDF5',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 25, // Safe area for home indicator
        borderTopWidth: 1,
        borderTopColor: '#EAE7DC',
        elevation: 10,
        zIndex: 10,
    },
    navCloseBtn: {
        position: 'absolute',
        bottom: 75,
        left: '50%',
        marginLeft: -22,
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    navCenter: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EAE7DC',
        borderRadius: 12,
        paddingHorizontal: 5,
    },
    pageInput: {
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        width: 50,
        textAlign: 'center',
        fontSize: 16,
        fontWeight: 'bold',
        color: '#3D3D3D',
    },
    pageText: {
        fontSize: 16,
        color: '#555',
        marginRight: 10,
    },
    slider: {
        flex: 1,
        height: 40,
        marginHorizontal: 10,
    },
});