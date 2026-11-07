import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { PikaIcon } from "./PikaIcon";
import { haptics } from "../utils/haptics";
import { askElioChat } from "../services/aiService";
import { openVideoDirectly } from "../services/deepLink";
import type { AskElioMessage, AskElioCitation } from "../types/ai";

export interface AskElioViewProps {
  onBack?: () => void;
  isTab?: boolean;
}

export interface AskElioModalProps {
  visible: boolean;
  onClose: () => void;
}

export const AskElioView: React.FC<AskElioViewProps> = ({
  onBack,
  isTab = true,
}) => {
  const [messages, setMessages] = useState<AskElioMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hey! I'm **Ask Elio**, your personal AI Second Brain. Ask me anything about the tutorials, recipes, or reels you've saved!",
      created_at: new Date().toISOString(),
    },
  ]);
  const [inputQuery, setInputQuery] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const suggestedPrompts = [
    "Summarize my React videos",
    "What workouts did I save?",
    "Tools mentioned in dev clips",
    "Quick recipes I bookmarked",
  ];

  const handleSend = async (queryToSend?: string) => {
    const text = (queryToSend || inputQuery).trim();
    if (!text || isThinking) return;

    haptics.selection();
    const userMsg: AskElioMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery("");
    setIsThinking(true);

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    const result = await askElioChat(text, [...messages, userMsg]);
    setIsThinking(false);

    const assistantMsg: AskElioMessage = {
      id: `ai_${Date.now()}`,
      role: "assistant",
      content: result.answer,
      citations: result.citations,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, assistantMsg]);
    haptics.success();

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 150);
  };

  const handleCitationPress = (cit: AskElioCitation) => {
    haptics.light();
    if (cit.clean_url) {
      openVideoDirectly(cit.clean_url, cit.platform || "other", undefined, cit.start_seconds);
    }
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <SafeAreaView style={[styles.container, isTab && styles.tabContainer]}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? (isTab ? 20 : 10) : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View style={styles.sparkleRing}>
              <PikaIcon name="sparkles" size={17} color="#A78BFA" />
            </View>
            <View>
              <Text style={styles.titleText}>Ask Elio</Text>
              <Text style={styles.subtitleText}>Your Saved Library AI Assistant</Text>
            </View>
          </View>

          {onBack && (
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.closeBtn}
              onPress={() => {
                haptics.light();
                onBack();
              }}
            >
              <PikaIcon name={isTab ? "arrow-back" : "close"} size={20} color="#71767B" />
            </TouchableOpacity>
          )}
        </View>

          {/* Quick Prompt Suggestions */}
          <View style={styles.suggestionsWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              nestedScrollEnabled={true}
              contentContainerStyle={styles.suggestionsScroll}
            >
              {suggestedPrompts.map((prompt, idx) => (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.75}
                  style={styles.promptPill}
                  onPress={() => handleSend(prompt)}
                >
                  <Text style={styles.promptText}>{prompt}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Chat Messages */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.chatScroll}
            contentContainerStyle={styles.chatContent}
            showsVerticalScrollIndicator={false}
          >
            {messages.map((msg) => {
              const isAi = msg.role === "assistant";
              return (
                <View
                  key={msg.id}
                  style={[styles.messageRow, isAi ? styles.messageRowAi : styles.messageRowUser]}
                >
                  {isAi && (
                    <View style={styles.avatarMini}>
                      <PikaIcon name="sparkles" size={13} color="#C4B5FD" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <View
                      style={[
                        styles.messageBubble,
                        isAi ? styles.messageBubbleAi : styles.messageBubbleUser,
                      ]}
                    >
                      <Text
                        style={[
                          styles.messageText,
                          isAi ? styles.messageTextAi : styles.messageTextUser,
                        ]}
                      >
                        {msg.content}
                      </Text>
                    </View>

                    {/* Grounded Video Citations */}
                    {isAi && msg.citations && msg.citations.length > 0 && (
                      <View style={styles.citationsContainer}>
                        <Text style={styles.citationsHeader}>REFERENCED SAVED VIDEOS:</Text>
                        <View style={styles.citationsList}>
                          {msg.citations.map((cit, cIdx) => (
                            <TouchableOpacity
                              key={cIdx}
                              activeOpacity={0.75}
                              style={styles.citationCard}
                              onPress={() => handleCitationPress(cit)}
                            >
                              <PikaIcon name="play-circle" size={16} color="#A78BFA" />
                              <View style={styles.citationMeta}>
                                <Text style={styles.citationTitle} numberOfLines={1}>
                                  {cit.title}
                                </Text>
                                <Text style={styles.citationTime}>
                                  Jump to {formatSeconds(cit.start_seconds)}
                                </Text>
                              </View>
                              <PikaIcon name="chevron-forward" size={13} color="#71767B" />
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}

            {isThinking && (
              <View style={[styles.messageRow, styles.messageRowAi]}>
                <View style={styles.avatarMini}>
                  <PikaIcon name="sparkles" size={13} color="#C4B5FD" />
                </View>
                <View style={styles.thinkingBubble}>
                  <ActivityIndicator size="small" color="#A78BFA" />
                  <Text style={styles.thinkingText}>Analyzing your saved clips...</Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Bottom Prompt Bar */}
          <View style={[styles.inputBar, isTab && styles.tabInputBar]}>
            <TextInput
              value={inputQuery}
              onChangeText={setInputQuery}
              placeholder="Ask anything about your saved clips..."
              placeholderTextColor="#71767B"
              style={styles.textInput}
              multiline={false}
              returnKeyType="send"
              onSubmitEditing={() => handleSend()}
            />
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.sendBtn,
                inputQuery.trim().length > 0 ? styles.sendBtnActive : styles.sendBtnDisabled,
              ]}
              disabled={inputQuery.trim().length === 0 || isThinking}
              onPress={() => handleSend()}
            >
              <PikaIcon
                name="arrow-up"
                size={18}
                color={inputQuery.trim().length > 0 ? "#FFFFFF" : "#71767B"}
              />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
  );
};

export const AskElioModal: React.FC<AskElioModalProps> = ({
  visible,
  onClose,
}) => {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <AskElioView onBack={onClose} isTab={false} />
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0C0D12",
  },
  tabContainer: {
    backgroundColor: "transparent",
  },
  keyboardContainer: {
    flex: 1,
  },
  tabInputBar: {
    marginBottom: 64,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  sparkleRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(167, 139, 250, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.3)",
  },
  titleText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  subtitleText: {
    color: "#71767B",
    fontSize: 11,
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionsWrapper: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  suggestionsScroll: {
    paddingHorizontal: 14,
    gap: 8,
  },
  promptPill: {
    backgroundColor: "rgba(167, 139, 250, 0.09)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.22)",
  },
  promptText: {
    color: "#C4B5FD",
    fontSize: 12,
    fontWeight: "500",
  },
  chatScroll: {
    flex: 1,
  },
  chatContent: {
    paddingHorizontal: 14,
    paddingVertical: 16,
    gap: 14,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  messageRowAi: {
    justifyContent: "flex-start",
  },
  messageRowUser: {
    justifyContent: "flex-end",
  },
  avatarMini: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(167, 139, 250, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    marginTop: 2,
  },
  messageBubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: "88%",
  },
  messageBubbleAi: {
    backgroundColor: "#161720",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  messageBubbleUser: {
    backgroundColor: "#7C3AED",
    alignSelf: "flex-end",
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageTextAi: {
    color: "#F1F5F9",
  },
  messageTextUser: {
    color: "#FFFFFF",
  },
  thinkingBubble: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#161720",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.2)",
    gap: 8,
  },
  thinkingText: {
    color: "#A78BFA",
    fontSize: 12.5,
    fontWeight: "500",
  },
  citationsContainer: {
    marginTop: 8,
    paddingLeft: 4,
  },
  citationsHeader: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  citationsList: {
    gap: 6,
  },
  citationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#12131A",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.2)",
  },
  citationMeta: {
    flex: 1,
    marginLeft: 8,
    marginRight: 6,
  },
  citationTitle: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  citationTime: {
    color: "#A78BFA",
    fontSize: 10.5,
    fontWeight: "600",
    marginTop: 1,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#161720",
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  textInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
    paddingVertical: 6,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  sendBtnActive: {
    backgroundColor: "#7C3AED",
  },
  sendBtnDisabled: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
});
