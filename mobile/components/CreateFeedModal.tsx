import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  Switch,
  ScrollView,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { threadsTokens } from "../theme/appleTokens";
import { haptics } from "../utils/haptics";

interface CreateFeedModalProps {
  visible: boolean;
  onClose: () => void;
  onCreateFeed?: (feedName: string, isPublic: boolean) => void;
}

const SUGGESTED_PROFILES = [
  {
    handle: "zuck",
    name: "Mark Zuckerberg",
    verified: true,
    initial: "Z",
    color: "#0095F6",
  },
  {
    handle: "robertdowneyjr",
    name: "Robert Downey Jr.",
    verified: true,
    initial: "R",
    color: "#E1306C",
  },
  {
    handle: "github",
    name: "GitHub",
    verified: true,
    initial: "G",
    color: "#24292E",
  },
  {
    handle: "claudeai",
    name: "Claude by Anthropic",
    verified: true,
    initial: "C",
    color: "#D97706",
  },
  {
    handle: "microsoftsecurity",
    name: "Microsoft Security",
    verified: true,
    initial: "M",
    color: "#00A4EF",
  },
  {
    handle: "google",
    name: "Google",
    verified: true,
    initial: "G",
    color: "#4285F4",
  },
  {
    handle: "ourworldindata",
    name: "Our World in Data",
    verified: true,
    initial: "O",
    color: "#10B981",
  },
];

export const CreateFeedModal: React.FC<CreateFeedModalProps> = ({
  visible,
  onClose,
  onCreateFeed,
}) => {
  const [feedName, setFeedName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [addedProfiles, setAddedProfiles] = useState<string[]>([]);

  const toggleProfile = (handle: string) => {
    haptics.selection();
    setAddedProfiles((prev) =>
      prev.includes(handle) ? prev.filter((h) => h !== handle) : [...prev, handle]
    );
  };

  const handleFinish = () => {
    haptics.success();
    if (onCreateFeed && feedName.trim()) {
      onCreateFeed(feedName.trim(), isPublic);
    }
    setFeedName("");
    setDescription("");
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.backBtn}
            onPress={() => {
              haptics.light();
              onClose();
            }}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create feed</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Card Container */}
          <View style={styles.cardContainer}>
            <TextInput
              style={styles.nameInput}
              placeholder="Feed name"
              placeholderTextColor="#555555"
              value={feedName}
              onChangeText={setFeedName}
            />
            <TextInput
              style={styles.descInput}
              placeholder="Enter a brief description."
              placeholderTextColor="#555555"
              value={description}
              onChangeText={setDescription}
              multiline
            />

            <View style={styles.cardDivider} />

            {/* Public Switch Row */}
            <View style={styles.switchRow}>
              <View style={styles.switchTextCol}>
                <Text style={styles.switchTitle}>Public feed</Text>
                <Text style={styles.switchSubtext}>
                  When this is on, anyone can see and share this feed. The feed and its
                  profiles may be suggested for others to follow.
                </Text>
              </View>
              <Switch
                value={isPublic}
                onValueChange={(val) => {
                  haptics.selection();
                  setIsPublic(val);
                }}
                trackColor={{ false: "#333333", true: "#FFFFFF" }}
                thumbColor={isPublic ? "#000000" : "#AAAAAA"}
              />
            </View>
          </View>

          {/* In This Feed Section */}
          <Text style={styles.sectionHeader}>In this feed</Text>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.addTopicBtn}
            onPress={() => haptics.light()}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.addTopicBtnText}>Add profiles or topics</Text>
          </TouchableOpacity>

          {/* Suggested Profiles Section */}
          <Text style={[styles.sectionHeader, { marginTop: 24 }]}>Suggested profiles</Text>
          <View style={styles.profilesCard}>
            {SUGGESTED_PROFILES.map((p, idx) => {
              const isAdded = addedProfiles.includes(p.handle);
              return (
                <View
                  key={p.handle}
                  style={[
                    styles.profileRow,
                    idx < SUGGESTED_PROFILES.length - 1 && styles.profileRowBorder,
                  ]}
                >
                  <View style={[styles.profileAvatar, { backgroundColor: p.color }]}>
                    <Text style={styles.avatarInitial}>{p.initial}</Text>
                  </View>

                  <View style={styles.profileMeta}>
                    <View style={styles.profileHandleRow}>
                      <Text style={styles.profileHandle}>{p.handle}</Text>
                      {p.verified && (
                        <Ionicons
                          name="checkmark-circle"
                          size={14}
                          color={threadsTokens.colors.verifiedBlue}
                          style={{ marginLeft: 4 }}
                        />
                      )}
                    </View>
                    <Text style={styles.profileName}>{p.name}</Text>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.75}
                    style={[styles.addProfileBtn, isAdded && styles.addProfileBtnAdded]}
                    onPress={() => toggleProfile(p.handle)}
                  >
                    <Text
                      style={[
                        styles.addProfileBtnText,
                        isAdded && styles.addProfileBtnTextAdded,
                      ]}
                    >
                      {isAdded ? "Added" : "Add"}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </ScrollView>

        {/* Finished Action Bar */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.finishedBtn}
            onPress={handleFinish}
          >
            <Text style={styles.finishedBtnText}>Finished</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#101010",
  },
  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "#1E1E1E",
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
  },
  cardContainer: {
    backgroundColor: "#181818",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#242424",
    padding: 16,
    marginBottom: 20,
  },
  nameInput: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 10,
    paddingVertical: 4,
  },
  descInput: {
    fontSize: 14,
    color: "#FFFFFF",
    minHeight: 40,
    paddingVertical: 4,
  },
  cardDivider: {
    height: 1,
    backgroundColor: "#242424",
    marginVertical: 14,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  switchTextCol: {
    flex: 1,
  },
  switchTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  switchSubtext: {
    fontSize: 12,
    color: threadsTokens.colors.textSecondary,
    lineHeight: 16,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "500",
    color: threadsTokens.colors.textSecondary,
    marginBottom: 10,
  },
  addTopicBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#181818",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#262626",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  addTopicBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  profilesCard: {
    backgroundColor: "#181818",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#242424",
    overflow: "hidden",
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  profileRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#222222",
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  profileMeta: {
    flex: 1,
  },
  profileHandleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileHandle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  profileName: {
    fontSize: 13,
    color: threadsTokens.colors.textSecondary,
    marginTop: 2,
  },
  addProfileBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#3A3A3A",
    backgroundColor: "#202020",
  },
  addProfileBtnAdded: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFFFFF",
  },
  addProfileBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  addProfileBtnTextAdded: {
    color: "#000000",
  },
  bottomBar: {
    position: "absolute",
    bottom: 24,
    left: 20,
    right: 20,
    alignItems: "center",
  },
  finishedBtn: {
    width: "100%",
    height: 48,
    borderRadius: 24,
    backgroundColor: "#2C2C2E",
    borderWidth: 1,
    borderColor: "#3E3E42",
    alignItems: "center",
    justifyContent: "center",
  },
  finishedBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
