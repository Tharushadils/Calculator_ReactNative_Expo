import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  useWindowDimensions,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import Mexp from 'math-expression-evaluator';

const OPERATORS = ['+', '−', '×', '÷'];

// Pure mathematical expression evaluator with zero crashes
function evaluateMathExpression(rawExpr) {
  if (!rawExpr || typeof rawExpr !== 'string' || !rawExpr.trim()) return '';

  let sanitized = rawExpr
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .trim();

  // Strip trailing operators
  while (['+', '-', '*', '/'].includes(sanitized.slice(-1))) {
    sanitized = sanitized.slice(0, -1).trim();
  }

  if (!sanitized) return '';

  // Check division by zero patterns
  if (/\/0(?!\d*\.?\d*[1-9])(\.0*)?(?!\d)/.test(sanitized)) {
    return 'Cannot divide by zero';
  }

  try {
    let result;
    try {
      const mexpInstance = new Mexp();
      result = mexpInstance.eval(sanitized);
    } catch {
      // Safe fallback evaluator
      if (/^[0-9+\-*/().\s]+$/.test(sanitized)) {
        result = new Function(`'use strict'; return (${sanitized})`)();
      } else {
        return '';
      }
    }

    if (result === Infinity || result === -Infinity || isNaN(result)) {
      return 'Cannot divide by zero';
    }

    // Format precision to remove JavaScript floating-point artifacts (e.g. 0.1 + 0.2 = 0.3)
    const num = Number(result);
    return parseFloat(num.toPrecision(12)).toString();
  } catch {
    return '';
  }
}

export default function App() {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  // State variables
  const [expression, setExpression] = useState('');
  const [currentInput, setCurrentInput] = useState('0');
  const [livePreview, setLivePreview] = useState('');
  const [isResultCalculated, setIsResultCalculated] = useState(false);
  const [activeOperator, setActiveOperator] = useState(null);

  const expressionScrollRef = useRef(null);
  const inputScrollRef = useRef(null);

  // Responsive calculations
  const isLandscape = windowWidth > windowHeight;
  const maxContainerWidth = isLandscape ? Math.min(windowWidth * 0.7, 560) : 420;
  const contentWidth = Math.min(windowWidth - 24, maxContainerWidth);

  // Adaptive spacing and sizing based on screen dimensions
  const isSmallScreen = windowHeight < 680 || windowWidth < 360;
  const isTablet = windowWidth >= 768;

  const buttonGap = isSmallScreen ? 8 : isTablet ? 14 : 12;
  const horizontalPadding = isSmallScreen ? 12 : 16;
  const availableWidthForGrid = contentWidth - horizontalPadding * 2;

  // Compute button dimensions
  const maxButtonWidth = Math.floor((availableWidthForGrid - buttonGap * 3) / 4);
  const maxAvailableKeypadHeight = windowHeight * (isLandscape ? 0.6 : 0.52);
  const maxButtonHeight = Math.floor((maxAvailableKeypadHeight - buttonGap * 4) / 5);
  const buttonSize = Math.max(48, Math.min(maxButtonWidth, maxButtonHeight > 0 ? maxButtonHeight : maxButtonWidth, 80));

  // Dynamic font sizing
  const buttonFontSize = Math.round(buttonSize * 0.38);
  const getInputFontSize = () => {
    const len = currentInput.length;
    if (len > 14) return Math.max(24, Math.round(buttonSize * 0.45));
    if (len > 10) return Math.max(30, Math.round(buttonSize * 0.58));
    if (len > 7) return Math.max(36, Math.round(buttonSize * 0.72));
    return isSmallScreen ? 44 : isTablet ? 64 : 54;
  };

  // Trigger haptic feedback
  const triggerHaptic = useCallback((type = 'light') => {
    try {
      if (Platform.OS !== 'web') {
        if (type === 'medium') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else if (type === 'heavy') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
    } catch {
      // Fallback
    }
  }, []);

  // Update live calculation preview
  const updateLivePreview = useCallback((newExpr, newCurrent) => {
    if (!newExpr) {
      setLivePreview('');
      return;
    }
    const fullExpr = newCurrent && newCurrent !== '0' ? `${newExpr} ${newCurrent}` : newExpr;
    const computed = evaluateMathExpression(fullExpr);
    if (computed && computed !== 'Cannot divide by zero' && computed !== newCurrent) {
      setLivePreview(computed);
    } else {
      setLivePreview('');
    }
  }, []);

  // Digit handler ('0'-'9')
  const handleDigit = useCallback((digit) => {
    triggerHaptic('light');
    setActiveOperator(null);

    if (isResultCalculated) {
      setCurrentInput(digit);
      setExpression('');
      setLivePreview('');
      setIsResultCalculated(false);
      return;
    }

    let nextInput;
    if (currentInput === '0' || currentInput === 'Cannot divide by zero' || currentInput === 'Error') {
      nextInput = digit;
    } else {
      nextInput = currentInput + digit;
    }

    setCurrentInput(nextInput);
    updateLivePreview(expression, nextInput);
  }, [currentInput, expression, isResultCalculated, triggerHaptic, updateLivePreview]);

  // Decimal Point handler ('.')
  const handleDecimal = useCallback(() => {
    triggerHaptic('light');
    setActiveOperator(null);

    if (isResultCalculated) {
      setCurrentInput('0.');
      setExpression('');
      setLivePreview('');
      setIsResultCalculated(false);
      return;
    }

    if (!currentInput.includes('.')) {
      const nextInput = currentInput + '.';
      setCurrentInput(nextInput);
      updateLivePreview(expression, nextInput);
    }
  }, [currentInput, expression, isResultCalculated, triggerHaptic, updateLivePreview]);

  // Operator handler ('+', '−', '×', '÷')
  const handleOperator = useCallback((op) => {
    triggerHaptic('medium');
    setActiveOperator(op);

    if (currentInput === 'Cannot divide by zero' || currentInput === 'Error') {
      return;
    }

    // If chaining after a calculation result
    if (isResultCalculated) {
      setExpression(`${currentInput} ${op}`);
      setCurrentInput('0');
      setIsResultCalculated(false);
      setLivePreview('');
      return;
    }

    if (expression === '') {
      setExpression(`${currentInput} ${op}`);
      setCurrentInput('0');
    } else if (currentInput === '0' && OPERATORS.includes(expression.slice(-1))) {
      // User changed operator without typing a new number
      setExpression(`${expression.slice(0, -1)}${op}`);
    } else {
      const updatedExpr = `${expression} ${currentInput} ${op}`;
      setExpression(updatedExpr);
      setCurrentInput('0');
    }
  }, [currentInput, expression, isResultCalculated, triggerHaptic]);

  // Equals handler ('=')
  const handleEquals = useCallback(() => {
    triggerHaptic('heavy');
    setActiveOperator(null);

    if (currentInput === 'Cannot divide by zero' || currentInput === 'Error') return;

    let fullExpr;
    if (expression) {
      if (currentInput === '0' && OPERATORS.includes(expression.slice(-1))) {
        fullExpr = expression.slice(0, -1).trim();
      } else {
        fullExpr = `${expression} ${currentInput}`;
      }
    } else {
      fullExpr = currentInput;
    }

    const finalResult = evaluateMathExpression(fullExpr);

    if (finalResult === 'Cannot divide by zero') {
      setCurrentInput('Cannot divide by zero');
      setExpression('');
      setLivePreview('');
      setIsResultCalculated(true);
      return;
    }

    if (finalResult !== '') {
      setExpression(`${fullExpr} =`);
      setCurrentInput(finalResult);
      setLivePreview('');
      setIsResultCalculated(true);
    }
  }, [currentInput, expression, triggerHaptic]);

  // Clear All ('AC')
  const handleClear = useCallback(() => {
    triggerHaptic('light');
    setActiveOperator(null);
    setExpression('');
    setCurrentInput('0');
    setLivePreview('');
    setIsResultCalculated(false);
  }, [triggerHaptic]);

  // Backspace / Delete ('⌫')
  const handleDelete = useCallback(() => {
    triggerHaptic('light');

    if (isResultCalculated || currentInput === 'Cannot divide by zero' || currentInput === 'Error') {
      handleClear();
      return;
    }

    let nextInput;
    if (currentInput.length > 1) {
      nextInput = currentInput.slice(0, -1);
      if (nextInput === '-' || nextInput === '-0') nextInput = '0';
    } else {
      nextInput = '0';
    }

    setCurrentInput(nextInput);
    updateLivePreview(expression, nextInput);
  }, [currentInput, expression, handleClear, isResultCalculated, triggerHaptic, updateLivePreview]);

  // Toggle Positive / Negative ('±')
  const handleToggleSign = useCallback(() => {
    triggerHaptic('light');

    if (currentInput === '0' || currentInput === 'Cannot divide by zero' || currentInput === 'Error') return;

    let nextInput;
    if (currentInput.startsWith('-')) {
      nextInput = currentInput.slice(1);
    } else {
      nextInput = '-' + currentInput;
    }

    setCurrentInput(nextInput);
    updateLivePreview(expression, nextInput);
  }, [currentInput, expression, triggerHaptic, updateLivePreview]);

  // Percentage ('%')
  const handlePercentage = useCallback(() => {
    triggerHaptic('light');

    if (currentInput === 'Cannot divide by zero' || currentInput === 'Error') return;

    try {
      const numericVal = parseFloat(currentInput);
      if (!isNaN(numericVal)) {
        const percentVal = (numericVal / 100).toString();
        setCurrentInput(percentVal);
        updateLivePreview(expression, percentVal);
      }
    } catch {
      // Ignored
    }
  }, [currentInput, expression, triggerHaptic, updateLivePreview]);

  // Physical Keyboard Support for Web & Desktops
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleKeyDown = (e) => {
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === '.') {
        e.preventDefault();
        handleDecimal();
      } else if (e.key === '+') {
        e.preventDefault();
        handleOperator('+');
      } else if (e.key === '-') {
        e.preventDefault();
        handleOperator('−');
      } else if (e.key === '*') {
        e.preventDefault();
        handleOperator('×');
      } else if (e.key === '/') {
        e.preventDefault();
        handleOperator('÷');
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        handleEquals();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClear();
      } else if (e.key === '%') {
        e.preventDefault();
        handlePercentage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDigit, handleDecimal, handleOperator, handleEquals, handleDelete, handleClear, handlePercentage]);

  // Button layout configuration
  const BUTTON_ROWS = [
    [
      { label: 'AC', type: 'func', onPress: handleClear },
      { label: '±', type: 'func', onPress: handleToggleSign },
      { label: '%', type: 'func', onPress: handlePercentage },
      { label: '÷', type: 'operator', onPress: () => handleOperator('÷'), isActive: activeOperator === '÷' },
    ],
    [
      { label: '7', type: 'digit', onPress: () => handleDigit('7') },
      { label: '8', type: 'digit', onPress: () => handleDigit('8') },
      { label: '9', type: 'digit', onPress: () => handleDigit('9') },
      { label: '×', type: 'operator', onPress: () => handleOperator('×'), isActive: activeOperator === '×' },
    ],
    [
      { label: '4', type: 'digit', onPress: () => handleDigit('4') },
      { label: '5', type: 'digit', onPress: () => handleDigit('5') },
      { label: '6', type: 'digit', onPress: () => handleDigit('6') },
      { label: '−', type: 'operator', onPress: () => handleOperator('−'), isActive: activeOperator === '−' },
    ],
    [
      { label: '1', type: 'digit', onPress: () => handleDigit('1') },
      { label: '2', type: 'digit', onPress: () => handleDigit('2') },
      { label: '3', type: 'digit', onPress: () => handleDigit('3') },
      { label: '+', type: 'operator', onPress: () => handleOperator('+'), isActive: activeOperator === '+' },
    ],
    [
      { label: '⌫', type: 'func', onPress: handleDelete },
      { label: '0', type: 'digit', onPress: () => handleDigit('0') },
      { label: '.', type: 'digit', onPress: handleDecimal },
      { label: '=', type: 'equals', onPress: handleEquals },
    ],
  ];

  const getButtonStyle = (btn) => {
    switch (btn.type) {
      case 'equals':
        return styles.equalsBtn;
      case 'operator':
        return btn.isActive ? styles.operatorBtnActive : styles.operatorBtn;
      case 'func':
        return styles.functionBtn;
      case 'digit':
      default:
        return styles.digitBtn;
    }
  };

  const getButtonTextStyle = (btn) => {
    switch (btn.type) {
      case 'equals':
        return styles.equalsBtnText;
      case 'operator':
        return btn.isActive ? styles.operatorBtnActiveText : styles.operatorBtnText;
      case 'func':
        return styles.functionBtnText;
      default:
        return styles.digitBtnText;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      {/* Main Centered Adaptive Container */}
      <View style={[styles.mainWrapper, { maxWidth: maxContainerWidth }]}>
        
        {/* Top Header */}
        <View style={styles.header}>
          <View style={styles.pillIndicator} />
        </View>

        {/* Display Screen */}
        <View style={[styles.displayContainer, { paddingHorizontal: horizontalPadding }]}>
          {/* Historical/Live Expression */}
          <ScrollView
            ref={expressionScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollRightAlign}
            onContentSizeChange={() => expressionScrollRef.current?.scrollToEnd({ animated: true })}
          >
            <Text style={styles.expressionText}>{expression || ' '}</Text>
          </ScrollView>

          {/* Live Preview Sub-Display */}
          <View style={styles.previewContainer}>
            {livePreview !== '' && !isResultCalculated && (
              <View style={styles.previewBadge}>
                <Text style={styles.livePreviewText}>= {livePreview}</Text>
              </View>
            )}
          </View>

          {/* Active Input / Result */}
          <ScrollView
            ref={inputScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollRightAlign}
            onContentSizeChange={() => inputScrollRef.current?.scrollToEnd({ animated: true })}
          >
            <Text
              style={[
                styles.currentInputText,
                { fontSize: getInputFontSize() },
                currentInput === 'Cannot divide by zero' && styles.errorText,
              ]}
              numberOfLines={1}
            >
              {currentInput}
            </Text>
          </ScrollView>
        </View>

        {/* Divider / Accent Line */}
        <View style={styles.divider} />

        {/* Keypad Grid */}
        <View
          style={[
            styles.keypadContainer,
            {
              paddingHorizontal: horizontalPadding,
              gap: buttonGap,
              paddingBottom: Platform.OS === 'ios' ? 24 : 16,
            },
          ]}
        >
          {BUTTON_ROWS.map((row, rowIndex) => (
            <View key={`row-${rowIndex}`} style={[styles.row, { gap: buttonGap }]}>
              {row.map((btn) => (
                <TouchableOpacity
                  key={`btn-${btn.label}`}
                  style={[
                    styles.baseButton,
                    {
                      width: buttonSize,
                      height: buttonSize,
                      borderRadius: buttonSize / 2,
                    },
                    getButtonStyle(btn),
                  ]}
                  onPress={btn.onPress}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.baseButtonText,
                      { fontSize: buttonFontSize },
                      getButtonTextStyle(btn),
                    ]}
                  >
                    {btn.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F1016',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  mainWrapper: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
  },
  header: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  pillIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2A2D3D',
  },
  displayContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 12,
  },
  scrollRightAlign: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  expressionText: {
    color: '#7E849E',
    fontSize: 22,
    fontWeight: '400',
    textAlign: 'right',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  previewContainer: {
    minHeight: 28,
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  previewBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  livePreviewText: {
    color: '#F59E0B',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'right',
  },
  currentInputText: {
    color: '#FFFFFF',
    fontWeight: '300',
    textAlign: 'right',
    letterSpacing: -0.5,
  },
  errorText: {
    fontSize: 22,
    color: '#EF4444',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#1E202C',
    marginHorizontal: 16,
    marginBottom: 12,
    opacity: 0.6,
  },
  keypadContainer: {
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  baseButton: {
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.35)',
        cursor: 'pointer',
        userSelect: 'none',
      },
    }),
  },
  digitBtn: {
    backgroundColor: '#1A1C28',
    borderWidth: 1,
    borderColor: '#242738',
  },
  functionBtn: {
    backgroundColor: '#26293A',
    borderWidth: 1,
    borderColor: '#363A50',
  },
  operatorBtn: {
    backgroundColor: '#3B4168',
    borderWidth: 1,
    borderColor: '#4E568A',
  },
  operatorBtnActive: {
    backgroundColor: '#6366F1',
    borderWidth: 1,
    borderColor: '#818CF8',
  },
  equalsBtn: {
    backgroundColor: '#F59E0B',
    borderWidth: 1,
    borderColor: '#FBBF24',
  },
  baseButtonText: {
    fontWeight: '500',
  },
  digitBtnText: {
    color: '#FFFFFF',
  },
  functionBtnText: {
    color: '#A5B4FC',
    fontWeight: '600',
  },
  operatorBtnText: {
    color: '#E0E7FF',
    fontWeight: '600',
  },
  operatorBtnActiveText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  equalsBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
