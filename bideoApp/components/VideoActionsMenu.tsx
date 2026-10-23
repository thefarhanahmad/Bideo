import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import Colors from '../constants/Colors';
import { RootState } from '../redux/store';
import ShareModal from './ShareModal';
import PlaylistModal from './PlaylistModal';
import ReportVideoModal from './ReportVideoModal';
import AuthModal from './AuthModal';
import BottomSheet, { SheetItem, SheetCancel } from './BottomSheet';
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

  return (
    <>
      <BottomSheet visible={visible} onClose={onClose} title={video.title}>
        {extraItems.map((item) => (
          <SheetItem
            key={item.key}
            icon={item.icon}
            label={item.label}
            destructive={item.destructive}
            onPress={() => run(item.onPress)}
          />
        ))}

        {isOwner && onEdit && <SheetItem icon="pencil-outline" label="Edit Video" onPress={() => run(onEdit)} />}
        {isOwner && onDelete && (
          <SheetItem icon="trash-outline" label="Delete Video" destructive onPress={() => run(onDelete)} />
        )}

        <SheetItem icon="add-circle-outline" label={playlistLabel} onPress={handlePlaylist} />
        <SheetItem
          icon="share-social-outline"
          label="Share"
          onPress={() =>
            run(() => {
              hapticSelection();
              setShareVisible(true);
            })
          }
        />
        {!isOwner && <SheetItem icon="flag-outline" label="Report" onPress={handleReport} />}

        <SheetCancel onPress={onClose} />
      </BottomSheet>

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
