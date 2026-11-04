import React, { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Animated,
  TouchableOpacity,
  StatusBar as RNStatusBar,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Video, ResizeMode } from "expo-av";
import * as SplashScreen from "expo-splash-screen";

interface StartupVideoSplashProps {
  onFinish: () => void;
}

export const StartupVideoSplash: React.FC<StartupVideoSplashProps> = ({
  onFinish,
}) => {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const isFinishedRef = useRef(false);
  const [videoLoaded, setVideoLoaded] = useState(false);

  const handleFinish = () => {
    if (isFinishedRef.current) return;
    isFinishedRef.current = true;

    RNStatusBar.setBarStyle("light-content", true);

    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onFinish();
    });
  };

  useEffect(() => {
    // Keep status bar visible with white elements (time, battery, wifi)
    RNStatusBar.setHidden(false, "none");
    RNStatusBar.setBarStyle("light-content", true);
    RNStatusBar.setBackgroundColor("#101010", true);
    RNStatusBar.setTranslucent(true);

    // Hide native static splash screen as soon as video splash mounts
    SplashScreen.hideAsync().catch(() => {});

    // Safety timeout in case playback event does not fire (video is ~2.6s)
    const timeout = setTimeout(() => {
      handleFinish();
    }, 3500);

    return () => {
      clearTimeout(timeout);
    };
  }, []);

  return (
    <Animated.View
      style={[
        styles.overlay,
        {
          opacity: fadeAnim,
        },
      ]}
    >
      {/* Status Bar with white elements on Threads dark canvas */}
      <StatusBar
        style="light"
        backgroundColor="#101010"
        translucent={true}
        hidden={false}
      />

      <TouchableOpacity
        activeOpacity={1}
        style={styles.container}
        onPress={handleFinish}
      >
        {/* Centered Video Player - Audio completely OFF & No Skip Button */}
        <View style={styles.videoCenterWrap}>
          <Video
            source={require("../assets/clideo_editor_8a9de444bf414c14be67290583ae58ef.mp4")}
            style={styles.video}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={true}
            isLooping={false}
            isMuted={true}
            volume={0}
            useNativeControls={false}
            onLoad={() => setVideoLoaded(true)}
            onPlaybackStatusUpdate={(status) => {
              if (status.isLoaded && status.didJustFinish) {
                handleFinish();
              }
            }}
          />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#101010",
    zIndex: 999999,
  },
  container: {
    flex: 1,
    backgroundColor: "#101010",
    justifyContent: "center",
    alignItems: "center",
  },
  videoCenterWrap: {
    width: "30%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#101010",
  },
  video: {
    width: "100%",
    height: "100%",
  },
});

