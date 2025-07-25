import React, { useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, TextInput, TouchableOpacity, View, Platform, StatusBar } from 'react-native';
import Svg, { Path, Text as SvgText, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import Pdf from 'react-native-pdf';

interface Props {
  uri: string;
  onClose: () => void;
}

type DrawPath = { d: string; color: string };
type TextNote = { text: string; x: number; y: number; width: number; height: number };

export default function PdfAnnotator({ uri, onClose }: Props) {
  const safeTop = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 20;
  const [paths, setPaths] = useState<DrawPath[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [mode, setMode] = useState<'draw' | 'text' | 'erase'>('draw');
  const [drawColor, setDrawColor] = useState('#ff0000');
  const [text, setText] = useState('');
  const [textRect, setTextRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [drawingRect, setDrawingRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [texts, setTexts] = useState<TextNote[]>([]);
  const [selectedText, setSelectedText] = useState<number | null>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        if (mode === 'draw') {
          setCurrentPath(`M${locationX},${locationY}`);
        } else if (mode === 'text') {
          setDrawingRect({ x: locationX, y: locationY, width: 0, height: 0 });
        } else if (mode === 'erase') {
          setPaths((ps) => ps.slice(0, -1));
        }
      },
      onPanResponderMove: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        if (mode === 'draw') {
          setCurrentPath((p) => `${p} L${locationX},${locationY}`);
        } else if (mode === 'text' && drawingRect) {
          setDrawingRect({
            ...drawingRect,
            width: locationX - drawingRect.x,
            height: locationY - drawingRect.y,
          });
        }
      },
      onPanResponderRelease: () => {
        if (mode === 'draw') {
          if (currentPath) {
            setPaths((ps) => [...ps, { d: currentPath, color: drawColor }]);
            setCurrentPath('');
          }
        } else if (mode === 'text' && drawingRect) {
          setTextRect(drawingRect);
        }
        setDrawingRect(null);
      },
    })
  ).current;


  const confirmText = () => {
    if (textRect && text.trim()) {
      const w = Math.abs(textRect.width) || 50;
      const h = Math.abs(textRect.height) || 20;
      setTexts((ts) => {
        if (selectedText !== null) {
          const copy = [...ts];
          copy[selectedText] = { text, x: textRect.x, y: textRect.y, width: w, height: h };
          return copy;
        }
        return [...ts, { text, x: textRect.x, y: textRect.y, width: w, height: h }];
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
        <TouchableOpacity onPress={() => setMode('draw')} style={styles.headerBtn} {...panResponder.panHandlers}>
          <Ionicons name="pencil" size={20} color={mode === 'draw' ? '#007AFF' : '#444'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setMode('text')} style={styles.headerBtn}>
          <Ionicons name="text" size={20} color={mode === 'text' ? '#007AFF' : '#444'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setMode('erase')} style={styles.headerBtn}>
          <Ionicons name="eraser" size={20} color={mode === 'erase' ? '#007AFF' : '#444'} />
        </TouchableOpacity>
      </View>
      <View style={styles.colorRow}>
        {['#ff0000', '#00aa00', '#0000ff'].map((c) => (
          <TouchableOpacity key={c} onPress={() => setDrawColor(c)} style={[styles.colorSwatch, { backgroundColor: c, borderColor: drawColor === c ? '#000' : '#fff' }]} />
        ))}
      </View>

      <View style={styles.viewer} {...panResponder.panHandlers}>
        <Pdf source={{ uri }} style={styles.pdf} />
        <Svg style={StyleSheet.absoluteFill}>
          {paths.map((p, i) => <Path key={i} d={p.d} stroke={p.color} strokeWidth={2} fill="none" />)}
          {currentPath ? <Path d={currentPath} stroke={drawColor} strokeWidth={2} fill="none" /> : null}
          {texts.map((t, i) => (
            <React.Fragment key={i}>
              <Rect x={t.x} y={t.y} width={t.width} height={t.height} stroke={selectedText === i ? '#ff9900' : 'blue'} strokeWidth={1} fill="transparent" onPress={() => { setSelectedText(i); setText(t.text); setTextRect(t); setMode('text'); }} />
              <SvgText x={t.x + 4} y={t.y + t.height - 4} fill="blue" fontSize="16">{t.text}</SvgText>
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
            <TouchableOpacity onPress={() => { setTexts(ts => ts.filter((_, idx) => idx !== selectedText)); setSelectedText(null); setMode('draw'); }} style={styles.addTextBtn}>
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
});