import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import Colors from '../constants/Colors';
import { RootState } from '../redux/store';
import ShareModal from './ShareModal';
import PlaylistModal from './PlaylistModal';
import ReportVideoModal from './ReportVideoModal';
import AuthModal from './AuthModal';
import { hapticSelection } from '../utils/haptics';

export interface VideoMenuItem {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
}

interface VideoActionsMenuProps {
  visible: boolean;
  onClose: () => void;
  video: {
    _id: string;
    title?: string;
    thumbnail?: string;
    isShort?: boolean;
    owner?: any;
    duration?: number;
  };
  isOwner: boolean;
  /** Screen-specific actions shown first (e.g. "Remove from playlist") */
  extraItems?: VideoMenuItem[];
  playlistLabel?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  /** Screens with their own flow can take over these two; otherwise the menu handles them */
  onPlaylistPress?: (videoId: string) => void;
  onReportPress?: (video: any) => void;
}

/**
 * The ⋮ menu for a video: owner actions, screen extras, Add to playlist, Share and Report.
 * Add to playlist / Report / Share work on every screen by themselves (with a login prompt
 * when needed), so a screen never has a menu item that does nothing.
 */
export default function VideoActionsMenu({
  visible,
  onClose,
  video,
  isOwner,
  extraItems = [],
  playlistLabel = 'Add to Playlist',
  onEdit,
  onDelete,
  onPlaylistPress,
  onReportPress,
}: VideoActionsMenuProps) {
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [shareVisible, setShareVisible] = useState(false);
  const [playlistVisible, setPlaylistVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [authVisible, setAuthVisible] = useState(false);

  const run = (action: () => void) => {
    onClose();
    action();
  };

  const handlePlaylist = () =>
    run(() => {
      if (onPlaylistPress) return onPlaylistPress(video._id);
      if (!isAuthenticated) return setAuthVisible(true);
      setPlaylistVisible(true);
    });

  const handleReport = () =>
    run(() => {
      if (onReportPress) return onReportPress(video);
      if (!isAuthenticated) return setAuthVisible(true);
      setReportVisible(true);
    });

  const renderItem = (key: string, label: string, icon: VideoMenuItem['icon'], onPress: () => void, destructive = false) => (
    <TouchableOpacity key={key} style={styles.menuItem} onPress={onPress}>
      <Ionicons name={icon} size={24} color={destructive ? Colors.primary : Colors.text} />
      <Text style={[styles.menuText, destructive && { color: Colors.primary }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={styles.modalOverlay} onPress={onClose}>
          <Pressable
            style={[styles.menuContent, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.grabber} />
            {Boolean(video.title) && (
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {video.title}
              </Text>
            )}

            {extraItems.map((item) =>
              renderItem(item.key, item.label, item.icon, () => run(item.onPress), item.destructive)
            )}

            {isOwner && onEdit && renderItem('edit', 'Edit Video', 'pencil-outline', () => run(onEdit))}
            {isOwner && onDelete && renderItem('delete', 'Delete Video', 'trash-outline', () => run(onDelete), true)}

            {renderItem('playlist', playlistLabel, 'add-circle-outline', handlePlaylist)}
            {renderItem('share', 'Share', 'share-social-outline', () => run(() => { hapticSelection(); setShareVisible(true); }))}
            {!isOwner && renderItem('report', 'Report', 'flag-outline', handleReport)}

            <TouchableOpacity style={styles.cancelItem} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Follow-up popups are created only when opened */}
      {shareVisible && (
        <ShareModal
          visible
          onClose={() => setShareVisible(false)}
          item={{
            type: 'video',
            _id: video._id,
            title: video.title,
            thumbnail: video.thumbnail,
            isShort: Boolean(video.isShort),
            owner: video.owner,
            duration: video.duration,
          }}
        />
      )}
      {playlistVisible && <PlaylistModal visible videoId={video._id} onClose={() => setPlaylistVisible(false)} />}
      {reportVisible && <ReportVideoModal visible videoId={video._id} onClose={() => setReportVisible(false)} />}
      {authVisible && <AuthModal visible onClose={() => setAuthVisible(false)} />}
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  menuContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.border,
    marginBottom: 10,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuText: {
    fontSize: 16,
    marginLeft: 15,
    color: Colors.text,
  },
  cancelItem: {
    marginTop: 12,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 14,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textGray,
  },
});
