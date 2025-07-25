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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Pdf from 'react-native-pdf';
import { ColorPicker as RNColorPicker } from 'react-native-color-picker';
const ColorPickerComponent: any = RNColorPicker;
import * as FileSystem from 'expo-file-system';

function pathContainsPoint(d: string, x: number, y: number, threshold = 10) {
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
  const [currentPath, setCurrentPath] = useState('');
  const [mode, setMode] = useState<'draw' | 'text' | 'erase'>('draw');
  const [drawColor, setDrawColor] = useState('#ff0000');
  // keep track of the color that was active when a stroke started so that
  // switching colours mid-stroke doesn't modify the stroke colour
  const activeColor = useRef(drawColor);
  const [text, setText] = useState('');
  const [textRect, setTextRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [drawingRect, setDrawingRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
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

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        const { locationX, locationY } = e.nativeEvent;
        if (mode === 'draw') {
          activeColor.current = drawColor;
          setCurrentPath(`M${locationX},${locationY}`);
        } else if (mode === 'text') {
          setDrawingRect({ x: locationX, y: locationY, width: 0, height: 0 });
        } else if (mode === 'erase') {
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
        }
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        const { locationX, locationY } = e.nativeEvent;
        if (mode === 'draw') {
          setCurrentPath((p: string) => `${p} L${locationX},${locationY}`);
        } else if (mode === 'text' && drawingRect) {
          setDrawingRect({
            ...drawingRect,
            width: locationX - drawingRect.x,
            height: locationY - drawingRect.y,
          });
        } else if (mode === 'erase') {
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
        }
      },
      onPanResponderRelease: () => {
        if (mode === 'draw') {
          if (currentPath) {
            setPaths((ps: DrawPath[]) => [...ps, { d: currentPath, color: activeColor.current }]);
            setCurrentPath('');
          }
        } else if (mode === 'text' && drawingRect) {
          setTextRect(drawingRect);
        }
        setDrawingRect(null);
      },
    })
  ).current;

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
    }
    setText('');
    setTextRect(null);
    setMode('draw');
    setSelectedText(null);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: safeTop }]}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.btnText}>Close</Text>
        </TouchableOpacity>
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
      </View>

      <View style={styles.viewer} {...panResponder.panHandlers}>
        <Pdf source={{ uri }} style={styles.pdf} />
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
            </React.Fragment>
          ))}
          {drawingRect && (
            <Rect x={drawingRect.x} y={drawingRect.y} width={drawingRect.width} height={drawingRect.height} stroke="grey" strokeDasharray="4" fill="transparent" />
          )}
        </Svg>
      </View>
      {textRect && mode === 'text' && (
        <View style={styles.textInputContainer}>
          <TextInput value={text} onChangeText={setText} placeholder="Enter text" style={styles.input} autoFocus />
          <TouchableOpacity onPress={confirmText} style={styles.addTextBtn}>
            <Text style={styles.btnText}>Done</Text>
          </TouchableOpacity>
          {selectedText !== null && (
            <TouchableOpacity onPress={() => { setTexts((ts: TextNote[]) => ts.filter((_, idx) => idx !== selectedText)); setSelectedText(null); setMode('draw'); }} style={styles.addTextBtn}>
              <Text style={[styles.btnText, {color: '#D11A2A'}]}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8, backgroundColor: '#f5f5f5', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ccc' },
  closeBtn: { padding: 8 },
  headerBtn: { padding: 8 },
  btnText: { color: '#007AFF', fontWeight: 'bold' },
  colorRow: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 6, backgroundColor: '#fff' },
  colorSwatch: { width: 24, height: 24, borderRadius: 12, marginHorizontal: 4, borderWidth: 2 },
  viewer: { flex: 1 },
  pdf: { flex: 1 },
  textInputContainer: { position: 'absolute', bottom: 40, left: 20, right: 20, flexDirection: 'row', backgroundColor: 'white', padding: 10, borderRadius: 8, elevation: 2 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', marginRight: 10, padding: 8, borderRadius: 4 },
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