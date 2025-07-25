<<<<<<< HEAD
=======
import React, { useEffect, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  Modal,
  PanResponder,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path, Text as SvgText, Rect } from 'react-native-svg';
>>>>>>> b8a0d4dabd2cfde62a5b9e6a8613cfdd3b0801ff
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import { GestureResponderEvent, PanResponder, Platform, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Pdf from 'react-native-pdf';
<<<<<<< HEAD
import Svg, { Path, Rect, Text as SvgText } from 'react-native-svg';
=======
import { ColorPicker as RNColorPicker } from 'react-native-color-picker';
const ColorPickerComponent: any = RNColorPicker;
import * as FileSystem from 'expo-file-system';
>>>>>>> b8a0d4dabd2cfde62a5b9e6a8613cfdd3b0801ff

// Helper function to check if a touch point is within the bounding box of a path.
function pathContainsPoint(d: string, x: number, y: number, threshold = 15) {
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
  rect: { x: number; y: number; width: number; height: number },
  x: number,
  y: number,
  threshold = 10
) {
  const left = Math.min(rect.x, rect.x + rect.width) - threshold;
  const right = Math.max(rect.x, rect.x + rect.width) + threshold;
  const top = Math.min(rect.y, rect.y + rect.height) - threshold;
  const bottom = Math.max(rect.y, rect.y + rect.height) + threshold;
  return x >= left && x <= right && y >= top && y <= bottom;
}

interface Props {
  uri: string;
  pdfId: string;
  onClose: () => void;
}

type DrawPath = { d: string; color: string };
type TextNote = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
};

export default function PdfAnnotator({ uri, pdfId, onClose }: Props) {
  const safeTop = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 20;
  const [paths, setPaths] = useState<DrawPath[]>([]);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [mode, setMode] = useState<'draw' | 'text' | 'erase'>('draw');
  const [drawColor, setDrawColor] = useState('#ff0000');
  const activeColor = useRef(drawColor);

  const [texts, setTexts] = useState<TextNote[]>([]);
  const [selectedTextIndex, setSelectedTextIndex] = useState<number | null>(null);
  const [textInput, setTextInput] = useState('');
  const [textRect, setTextRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [drawingRect, setDrawingRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
<<<<<<< HEAD

  const erasePath = (x: number, y: number) => {
    setPaths(prevPaths =>
      prevPaths.filter(p => !pathContainsPoint(p.d, x, y))
    );
  };
=======
  const [texts, setTexts] = useState<TextNote[]>([]);
  const [selectedText, setSelectedText] = useState<number | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  const annotationPath = `${FileSystem.documentDirectory}annotations/${encodeURIComponent(pdfId)}.json`;

  useEffect(() => {
    (async () => {
      try {
        await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}annotations`, { intermediates: true });
        const data = await FileSystem.readAsStringAsync(annotationPath);
        const parsed = JSON.parse(data);
        setPaths(parsed.paths || []);
        setTexts(parsed.texts || []);
      } catch (e) {
        // no saved annotations yet
      }
    })();
  }, [annotationPath]);

  useEffect(() => {
    (async () => {
      const data = JSON.stringify({ paths, texts });
      try {
        await FileSystem.writeAsStringAsync(annotationPath, data, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      } catch (e) {
        // ignore write errors
      }
    })();
  }, [paths, texts, annotationPath]);
>>>>>>> b8a0d4dabd2cfde62a5b9e6a8613cfdd3b0801ff

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        const { locationX, locationY } = e.nativeEvent;
        // Reset text selection when user interacts with the canvas
        if (selectedTextIndex !== null) {
            setSelectedTextIndex(null);
        }

        if (mode === 'draw') {
          activeColor.current = drawColor;
          setCurrentPath(`M${locationX},${locationY}`);
        } else if (mode === 'text') {
          setDrawingRect({ x: locationX, y: locationY, width: 0, height: 0 });
        } else if (mode === 'erase') {
<<<<<<< HEAD
          erasePath(locationX, locationY);
=======
          setPaths((ps: DrawPath[]) => {
            const idx = ps.findIndex(p => pathContainsPoint(p.d, locationX, locationY));
            if (idx !== -1) {
              const copy = [...ps];
              copy.splice(idx, 1);
              return copy;
            }
            return ps;
          });
          setTexts((ts: TextNote[]) => {
            const idx = ts.findIndex(t => rectContainsPoint(t, locationX, locationY));
            if (idx !== -1) {
              const copy = [...ts];
              copy.splice(idx, 1);
              return copy;
            }
            return ts;
          });
>>>>>>> b8a0d4dabd2cfde62a5b9e6a8613cfdd3b0801ff
        }
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        const { locationX, locationY } = e.nativeEvent;
        if (mode === 'draw' && currentPath) {
          setCurrentPath(prevPath => `${prevPath} L${locationX},${locationY}`);
        } else if (mode === 'text' && drawingRect) {
          setDrawingRect({
            ...drawingRect,
            width: locationX - drawingRect.x,
            height: locationY - drawingRect.y,
          });
        } else if (mode === 'erase') {
<<<<<<< HEAD
          erasePath(locationX, locationY);
=======
          setPaths((ps: DrawPath[]) => {
            const idx = ps.findIndex(p => pathContainsPoint(p.d, locationX, locationY));
            if (idx !== -1) {
              const copy = [...ps];
              copy.splice(idx, 1);
              return copy;
            }
            return ps;
          });
          setTexts((ts: TextNote[]) => {
            const idx = ts.findIndex(t => rectContainsPoint(t, locationX, locationY));
            if (idx !== -1) {
              const copy = [...ts];
              copy.splice(idx, 1);
              return copy;
            }
            return ts;
          });
>>>>>>> b8a0d4dabd2cfde62a5b9e6a8613cfdd3b0801ff
        }
      },
      onPanResponderRelease: () => {
        if (mode === 'draw' && currentPath) {
          setPaths(prevPaths => [...prevPaths, { d: currentPath, color: activeColor.current }]);
          setCurrentPath(null);
        } else if (mode === 'text' && drawingRect) {
          const finalRect = {
              x: drawingRect.width < 0 ? drawingRect.x + drawingRect.width : drawingRect.x,
              y: drawingRect.height < 0 ? drawingRect.y + drawingRect.height : drawingRect.y,
              width: Math.abs(drawingRect.width),
              height: Math.abs(drawingRect.height),
          };
          // Only show input if the box is a meaningful size
          if (finalRect.width > 5 && finalRect.height > 5) {
            setTextRect(finalRect);
          }
          setDrawingRect(null);
        }
      },
    })
  ).current;

<<<<<<< HEAD
  const handleConfirmText = () => {
    if (textRect && textInput.trim()) {
      const newText: TextNote = { 
        text: textInput, 
        ...textRect,
        width: Math.max(textRect.width, 50), 
        height: Math.max(textRect.height, 20) 
      };

      if (selectedTextIndex !== null) {
        setTexts(prevTexts => prevTexts.map((t, index) => index === selectedTextIndex ? newText : t));
      } else {
        setTexts(prevTexts => [...prevTexts, newText]);
      }
=======
  const undoLast = () => {
    if (paths.length > 0) {
      setPaths(p => p.slice(0, -1));
      return;
    }
    if (texts.length > 0) {
      setTexts(t => t.slice(0, -1));
    }
  };


  const confirmText = () => {
    if (textRect && text.trim()) {
      const w = Math.abs(textRect.width) || 50;
      const h = Math.abs(textRect.height) || 20;
      setTexts((ts: TextNote[]) => {
        if (selectedText !== null) {
          const copy = [...ts];
          copy[selectedText] = {
            ...copy[selectedText],
            text,
            x: textRect.x,
            y: textRect.y,
            width: w,
            height: h,
          };
          return copy;
        }
        return [
          ...ts,
          { text, x: textRect.x, y: textRect.y, width: w, height: h, color: drawColor },
        ];
      });
>>>>>>> b8a0d4dabd2cfde62a5b9e6a8613cfdd3b0801ff
    }
    setTextInput('');
    setTextRect(null);
    setSelectedTextIndex(null);
    setMode('draw');
  };
  
  const handleSelectText = (t: TextNote, index: number) => {
    setSelectedTextIndex(index);
    setTextInput(t.text);
    setTextRect(t);
    setMode('text');
  };

  const handleDeleteText = () => {
    if (selectedTextIndex !== null) {
      setTexts(ts => ts.filter((_, idx) => idx !== selectedTextIndex));
      setSelectedTextIndex(null);
      setTextInput('');
      setTextRect(null);
      setMode('draw');
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: safeTop }]}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.btnText}>Close</Text>
        </TouchableOpacity>
<<<<<<< HEAD
        <View style={styles.toolSet}>
            <TouchableOpacity onPress={() => setMode('draw')} style={styles.headerBtn}>
                <Ionicons name="pencil" size={24} color={mode === 'draw' ? '#007AFF' : '#444'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMode('text')} style={styles.headerBtn}>
                <Ionicons name="text" size={24} color={mode === 'text' ? '#007AFF' : '#444'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMode('erase')} style={styles.headerBtn}>
                <MaterialCommunityIcons name="eraser" size={24} color={mode === 'erase' ? '#007AFF' : '#444'} />
            </TouchableOpacity>
        </View>
=======
        <TouchableOpacity onPress={() => setMode('draw')} style={styles.headerBtn}>
          <Ionicons name="pencil" size={20} color={mode === 'draw' ? '#007AFF' : '#444'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setMode('text')} style={styles.headerBtn}>
          <Ionicons name="text" size={20} color={mode === 'text' ? '#007AFF' : '#444'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={undoLast} style={styles.headerBtn}>
          <MaterialCommunityIcons name="undo" size={20} color="#444" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setMode(mode === 'erase' ? 'draw' : 'erase')} style={styles.headerBtn}>
          <MaterialCommunityIcons name="eraser" size={20} color={mode === 'erase' ? '#007AFF' : '#444'} />
        </TouchableOpacity>
      </View>
      <Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.pickerOverlay}>
          <ColorPickerComponent
            onColorSelected={(c: string) => {
              setPickerVisible(false);
              setDrawColor(c);
            }}
            style={styles.colorPicker}
          />
        </View>
      </Modal>
      <View style={styles.colorRow}>
        {['#ff0000', '#00aa00', '#0000ff'].map((c) => (
          <TouchableOpacity key={c} onPress={() => setDrawColor(c)} style={[styles.colorSwatch, { backgroundColor: c, borderColor: drawColor === c ? '#000' : '#fff' }]} />
        ))}
        <TouchableOpacity onPress={() => setPickerVisible(true)} style={styles.headerBtn}>
          <MaterialCommunityIcons name="palette" size={20} color="#444" />
        </TouchableOpacity>
>>>>>>> b8a0d4dabd2cfde62a5b9e6a8613cfdd3b0801ff
      </View>

      {mode === 'draw' && (
        <View style={styles.colorRow}>
          {['#ff0000', '#00aa00', '#0000ff', '#000000'].map((c) => (
            <TouchableOpacity key={c} onPress={() => setDrawColor(c)} style={[styles.colorSwatch, { backgroundColor: c, borderColor: drawColor === c ? '#007AFF' : '#fff' }]} />
          ))}
        </View>
      )}

      <View style={styles.viewer}>
        <Pdf source={{ uri }} style={styles.pdf} />
<<<<<<< HEAD
        <Svg style={StyleSheet.absoluteFill} {...panResponder.panHandlers}>
          {paths.map((p, i) => <Path key={`path-${i}`} d={p.d} stroke={p.color} strokeWidth={3} fill="none" />)}
          
          {currentPath && <Path d={currentPath} stroke={activeColor.current} strokeWidth={3} fill="none" />}
          
          {texts.map((t, i) => (
            <React.Fragment key={`text-${i}`}>
              <Rect 
                x={t.x} y={t.y} width={t.width} height={t.height} 
                stroke={selectedTextIndex === i ? '#FF9900' : 'transparent'} 
                strokeWidth={2} fill="transparent" 
                onPress={() => handleSelectText(t, i)} 
              />
              <SvgText x={t.x + 5} y={t.y + 16} fill="blue" fontSize={16} fontWeight="bold">{t.text}</SvgText>
=======
        <Svg style={StyleSheet.absoluteFill}>
          {paths.map((p: DrawPath, i: number) => <Path key={i} d={p.d} stroke={p.color} strokeWidth={2} fill="none" />)}
          {currentPath ? <Path d={currentPath} stroke={activeColor.current} strokeWidth={2} fill="none" /> : null}
          {texts.map((t: TextNote, i: number) => (
            <React.Fragment key={i}>
              <Rect
                x={t.x}
                y={t.y}
                width={t.width}
                height={t.height}
                stroke={selectedText === i ? '#ff9900' : t.color}
                strokeWidth={1}
                fill="transparent"
                onPress={() => {
                  setSelectedText(i);
                  setText(t.text);
                  setTextRect(t);
                  setMode('text');
                }}
              />
              <SvgText x={t.x + 4} y={t.y + t.height - 4} fill={t.color} fontSize="16">
                {t.text}
              </SvgText>
>>>>>>> b8a0d4dabd2cfde62a5b9e6a8613cfdd3b0801ff
            </React.Fragment>
          ))}
          
          {drawingRect && (
            <Rect x={drawingRect.x} y={drawingRect.y} width={drawingRect.width} height={drawingRect.height} stroke="grey" strokeDasharray="4" strokeWidth={1} fill="rgba(0,0,0,0.1)" />
          )}
        </Svg>
      </View>

      {textRect && mode === 'text' && (
        <View style={styles.textInputContainer}>
          <TextInput value={textInput} onChangeText={setTextInput} placeholder="Enter text" style={styles.input} autoFocus />
          <TouchableOpacity onPress={handleConfirmText} style={styles.addTextBtn}>
            <Text style={styles.btnText}>Done</Text>
          </TouchableOpacity>
          {selectedTextIndex !== null && (
            <TouchableOpacity onPress={handleDeleteText} style={styles.addTextBtn}>
              <Text style={[styles.btnText, {color: '#D11A2A'}]}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e5e5e5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#f5f5f5', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ccc' },
  closeBtn: { padding: 8 },
  toolSet: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  headerBtn: { padding: 8, marginHorizontal: 5 },
  btnText: { color: '#007AFF', fontWeight: 'bold', fontSize: 16 },
  colorRow: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 8, backgroundColor: '#fff' },
  colorSwatch: { width: 30, height: 30, borderRadius: 15, marginHorizontal: 10, borderWidth: 3 },
  viewer: { flex: 1, position: 'relative' },
  pdf: { flex: 1, backgroundColor: '#f0f0f0' },
  textInputContainer: { position: 'absolute', bottom: 40, left: 20, right: 20, flexDirection: 'row', backgroundColor: 'white', padding: 10, borderRadius: 8, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', marginRight: 10, padding: 8, borderRadius: 4, fontSize: 16 },
  addTextBtn: { justifyContent: 'center', paddingHorizontal: 10 },
  pickerOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  colorPicker: {
    width: 250,
    height: 250,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
});