import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, Platform, Dimensions } from 'react-native';

interface ToastProps {
    message: string;
    visible: boolean;
    onHide: () => void;
    type?: 'success' | 'error' | 'info';
}

const { width } = Dimensions.get('window');

const COLORS = {
    success: '#10B981',
    error: '#EF4444',
    info: '#3B82F6',
    text: '#FFFFFF',
};

export const Toast: React.FC<ToastProps> = ({ message, visible, onHide, type = 'success' }) => {
    const translateY = useRef(new Animated.Value(-100)).current;

    useEffect(() => {
        if (visible) {
            Animated.sequence([
                Animated.timing(translateY, {
                    toValue: Platform.OS === 'ios' ? 50 : 20,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.delay(2000),
                Animated.timing(translateY, {
                    toValue: -100,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                onHide();
            });
        }
    }, [visible, translateY, onHide]);

    if (!visible) return null;

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    backgroundColor: COLORS[type],
                    transform: [{ translateY }],
                },
            ]}
        >
            <Text style={styles.text}>{message}</Text>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        alignSelf: 'center',
        width: width * 0.9,
        padding: 16,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    text: {
        color: COLORS.text,
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
    },
});
