import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from "react-native";
import { PikaIcon } from "./PikaIcon";
import { threadsTokens } from "../theme/appleTokens";
import { haptics } from "../utils/haptics";

export type TimeRange = "7d" | "14d" | "30d" | "90d";

interface TimeRangeMenuProps {
  visible: boolean;
  selectedRange: TimeRange;
  onSelect: (range: TimeRange) => void;
  onClose: () => void;
}

const OPTIONS: { key: TimeRange; label: string }[] = [
  { key: "7d", label: "7 days" },
  { key: "14d", label: "14 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
];

/**
 * Authentic Instagram Threads Time Range Popover
 * Calibrated directly from Screenshot 15-59-34.png:
 * Floating rounded dark menu with checkmark for active item
 */
export const TimeRangeMenu: React.FC<TimeRangeMenuProps> = ({
  visible,
  selectedRange,
  onSelect,
  onClose,
}) => {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.menuCard}>
              {OPTIONS.map((opt, idx) => {
                const isSelected = selectedRange === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    activeOpacity={0.7}
                    style={[
                      styles.menuItem,
                      idx < OPTIONS.length - 1 && styles.menuItemBorder,
                    ]}
                    onPress={() => {
                      haptics.selection();
                      onSelect(opt.key);
                      onClose();
                    }}
                  >
                    <Text
                      style={[
                        styles.menuLabel,
                        isSelected && styles.menuLabelSelected,
                      ]}
                    >
                      {opt.label}
                    </Text>
                    {isSelected && (
                      <PikaIcon
                        name="checkmark"
                        size={18}
                        color="#FFFFFF"
                        style={styles.checkIcon}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  menuCard: {
    width: 220,
    backgroundColor: "#1C1C1E",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2C2C2E",
    paddingVertical: 4,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  menuItemBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: "#2A2A2C",
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  menuLabelSelected: {
    fontWeight: "700",
  },
  checkIcon: {
    marginLeft: 8,
  },
});
