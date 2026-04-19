import React, { useContext, useState, useEffect, useRef } from 'react';
import './Status.css';
import assets from '../../assets/assets';
import { AppContext } from '../../context/AppContextProvider';
import { toast } from 'react-toastify';

// ─── Status Tab Component ────────────────────────────────────────────────────

const StatusTab = () => {
  const { userData, statuses, postStatus, markStatusViewed } = useContext(AppContext);

  const [showPostModal, setShowPostModal] = useState(false);
  const [viewerData, setViewerData] = useState(null); // { statuses: [], userIndex: 0, statusIndex: 0 }
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [textInput, setTextInput] = useState('');
  const [postType, setPostType] = useState('media'); // 'media' | 'text'
  const [textBg, setTextBg] = useState(0);
  const fileInputRef = useRef(null);

  const TEXT_BG_GRADIENTS = [
    'linear-gradient(135deg, #6366f1, #8b5cf6)',
    'linear-gradient(135deg, #0ea5e9, #06b6d4)',
    'linear-gradient(135deg, #10b981, #065f46)',
    'linear-gradient(135deg, #f43f5e, #ec4899)',
    'linear-gradient(135deg, #f59e0b, #ef4444)',
    'linear-gradient(135deg, #1e293b, #334155)',
  ];

  // ─── Group statuses by user ──────────────────────────────────────────────
  // My statuses first, then others sorted by most recent
  const myStatuses = statuses.filter((s) => s.userId === userData?.uid);
  const othersMap = {};
  statuses
    .filter((s) => s.userId !== userData?.uid)
    .forEach((s) => {
      if (!othersMap[s.userId]) othersMap[s.userId] = [];
      othersMap[s.userId].push(s);
    });

  const othersGroups = Object.values(othersMap).sort(
    (a, b) => b[0].createdAt - a[0].createdAt
  );

  // ─── Post a new status ───────────────────────────────────────────────────
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isImage && !isVideo) {
      toast.error('Please select an image or video file');
      return;
    }
    try {
      setUploading(true);
      setUploadProgress(0);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', 'Chat_Images');
      const resourceType = isVideo ? 'video' : 'image';
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `https://api.cloudinary.com/v1_1/du3hiflqj/${resourceType}/upload`);
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
        }
      };
      xhr.onload = async () => {
        const data = JSON.parse(xhr.responseText);
        if (data.secure_url) {
          await postStatus({ type: isVideo ? 'video' : 'image', mediaUrl: data.secure_url });
          toast.success('Status posted! 🎉');
          setShowPostModal(false);
        } else {
          toast.error('Upload failed');
        }
        setUploading(false);
        setUploadProgress(0);
      };
      xhr.onerror = () => { toast.error('Upload error'); setUploading(false); };
      xhr.send(formData);
    } catch (err) {
      console.error(err);
      toast.error('Failed to post status');
      setUploading(false);
    }
    e.target.value = '';
  };

  const handlePostText = async () => {
    if (!textInput.trim()) return;
    await postStatus({ type: 'text', text: textInput.trim(), textBg });
    toast.success('Status posted! 🎉');
    setTextInput('');
    setShowPostModal(false);
  };

  // ─── Open viewer ─────────────────────────────────────────────────────────
  const openViewer = (groups, groupIndex, statusIndex = 0) => {
    setViewerData({ groups, groupIndex, statusIndex });
  };

  const openMyViewer = () => {
    if (myStatuses.length === 0) { setShowPostModal(true); return; }
    openViewer([myStatuses], 0, 0);
  };

  // ─── All unviewed check for a group ──────────────────────────────────────
  const hasUnviewed = (group) =>
    group.some((s) => !s.viewers?.includes(userData?.uid));

  return (
    <div className="status-tab">

      {/* ─── My Status Card ─── */}
      <div className="my-status-card" onClick={openMyViewer}>
        <div className={`status-avatar-ring ${myStatuses.length > 0 ? 'has-status' : 'no-status'}`}>
          <img src={userData?.avatar || assets.profile_img} alt="me" />
          <button
            className="add-status-plus"
            onClick={(e) => { e.stopPropagation(); setShowPostModal(true); }}
            title="Add status"
          >＋</button>
        </div>
        <div className="status-info">
          <p className="status-name">My Status</p>
          <span className="status-sub">
            {myStatuses.length > 0
              ? `${myStatuses.length} update${myStatuses.length > 1 ? 's' : ''}`
              : 'Tap to add a status update'}
          </span>
        </div>
      </div>

      {/* ─── Others' Statuses ─── */}
      {othersGroups.length > 0 && (
        <>
          <div className="status-section-label">Recent updates</div>
          {othersGroups.map((group, gi) => {
            const first = group[0];
            const unviewed = hasUnviewed(group);
            return (
              <div
                key={first.userId}
                className="status-card"
                onClick={() => {
                  openViewer(othersGroups, gi, 0);
                  markStatusViewed(first.id);
                }}
              >
                <div className={`status-avatar-ring ${unviewed ? 'unviewed' : 'viewed'}`}>
                  <img src={first.userAvatar || assets.profile_img} alt={first.userName} />
                </div>
                <div className="status-info">
                  <p className="status-name">{first.userName || 'User'}</p>
                  <span className="status-sub">
                    {formatRelativeTime(first.createdAt)}
                  </span>
                </div>
              </div>
            );
          })}
        </>
      )}

      {othersGroups.length === 0 && myStatuses.length === 0 && (
        <div className="status-empty">
          <span>📸</span>
          <p>No status updates yet</p>
          <small>Be the first to share a moment!</small>
        </div>
      )}

      {/* ─── Post Modal ─── */}
      {showPostModal && (
        <div className="status-modal-overlay" onClick={() => !uploading && setShowPostModal(false)}>
          <div className="status-modal" onClick={(e) => e.stopPropagation()}>
            <div className="status-modal-header">
              <h3>Add Status</h3>
              <button onClick={() => setShowPostModal(false)}>✕</button>
            </div>

            <div className="status-post-tabs">
              <button
                className={postType === 'media' ? 'active' : ''}
                onClick={() => setPostType('media')}
              >📷 Media</button>
              <button
                className={postType === 'text' ? 'active' : ''}
                onClick={() => setPostType('text')}
              >✏️ Text</button>
            </div>

            {postType === 'media' ? (
              <div className="status-upload-area">
                {uploading ? (
                  <div className="upload-progress-wrap">
                    <div className="upload-progress-bar">
                      <div className="upload-progress-fill" style={{ width: `${uploadProgress}%` }} />
                    </div>
                    <span>{uploadProgress}%</span>
                  </div>
                ) : (
                  <>
                    <div className="upload-drop-zone" onClick={() => fileInputRef.current?.click()}>
                      <span className="upload-icon">📤</span>
                      <p>Click to select a photo or video</p>
                      <small>Disappears after 24 hours</small>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,video/*"
                      hidden
                      onChange={handleFileChange}
                    />
                  </>
                )}
              </div>
            ) : (
              <div className="status-text-area">
                <div
                  className="text-status-preview"
                  style={{ background: TEXT_BG_GRADIENTS[textBg] }}
                >
                  <textarea
                    placeholder="What's on your mind?"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    maxLength={200}
                  />
                </div>
                <div className="text-bg-picker">
                  {TEXT_BG_GRADIENTS.map((g, i) => (
                    <button
                      key={i}
                      className={`text-bg-swatch ${textBg === i ? 'active' : ''}`}
                      style={{ background: g }}
                      onClick={() => setTextBg(i)}
                    />
                  ))}
                </div>
                <button
                  className="post-text-btn"
                  onClick={handlePostText}
                  disabled={!textInput.trim()}
                >Post Status</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Status Viewer ─── */}
      {viewerData && (
        <StatusViewer
          groups={viewerData.groups}
          groupIndex={viewerData.groupIndex}
          statusIndex={viewerData.statusIndex}
          currentUserId={userData?.uid}
          onClose={() => setViewerData(null)}
          onNext={(gi, si) => setViewerData((prev) => ({ ...prev, groupIndex: gi, statusIndex: si }))}
          markViewed={markStatusViewed}
          textBgGradients={TEXT_BG_GRADIENTS}
        />
      )}
    </div>
  );
};

// ─── Status Viewer (Full-Screen) ─────────────────────────────────────────────

const StatusViewer = ({
  groups,
  groupIndex,
  statusIndex,
  currentUserId,
  onClose,
  onNext,
  markViewed,
  textBgGradients,
}) => {
  const [curGroup, setCurGroup] = useState(groupIndex);
  const [curStatus, setCurStatus] = useState(statusIndex);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef(null);
  const DURATION = 5000; // ms per status

  const group = groups[curGroup] || [];
  const status = group[curStatus];
  const isOwn = status?.userId === currentUserId;

  const goNext = () => {
    if (curStatus < group.length - 1) {
      const ns = curStatus + 1;
      setCurStatus(ns);
      setProgress(0);
      markViewed(group[ns]?.id);
      onNext(curGroup, ns);
    } else if (curGroup < groups.length - 1) {
      const ng = curGroup + 1;
      setCurGroup(ng);
      setCurStatus(0);
      setProgress(0);
      markViewed(groups[ng][0]?.id);
      onNext(ng, 0);
    } else {
      onClose();
    }
  };

  const goPrev = () => {
    if (curStatus > 0) {
      const ns = curStatus - 1;
      setCurStatus(ns);
      setProgress(0);
    } else if (curGroup > 0) {
      const ng = curGroup - 1;
      const prevGroup = groups[ng];
      setCurGroup(ng);
      setCurStatus(prevGroup.length - 1);
      setProgress(0);
    }
  };

  // Auto-advance timer
  useEffect(() => {
    setProgress(0);
    if (timerRef.current) clearInterval(timerRef.current);
    const step = 100 / (DURATION / 100);
    let p = 0;
    timerRef.current = setInterval(() => {
      p += step;
      setProgress(Math.min(p, 100));
      if (p >= 100) {
        clearInterval(timerRef.current);
        goNext();
      }
    }, 100);
    return () => clearInterval(timerRef.current);
  }, [curGroup, curStatus]);

  // Mark current as viewed
  useEffect(() => {
    if (status?.id) markViewed(status.id);
  }, [status?.id]);

  if (!status) { onClose(); return null; }

  const viewerCount = status.viewers?.length || 0;
  const statusUser = status.userName || 'User';
  const statusAvatar = status.userAvatar || '';

  return (
    <div className="status-viewer-overlay" onClick={onClose}>
      <div className="status-viewer" onClick={(e) => e.stopPropagation()}>

        {/* Progress bars */}
        <div className="viewer-progress-bars">
          {group.map((_, i) => (
            <div key={i} className="viewer-progress-track">
              <div
                className="viewer-progress-fill"
                style={{
                  width: i < curStatus ? '100%' : i === curStatus ? `${progress}%` : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="viewer-header">
          <img src={statusAvatar || assets.profile_img} alt={statusUser} className="viewer-avatar" />
          <div className="viewer-user-info">
            <span className="viewer-name">{statusUser}</span>
            <span className="viewer-time">{formatRelativeTime(status.createdAt)}</span>
          </div>
          <button className="viewer-close" onClick={onClose}>✕</button>
        </div>

        {/* Content */}
        <div className="viewer-content">
          {status.type === 'image' && (
            <img src={status.mediaUrl} alt="status" className="viewer-image" />
          )}
          {status.type === 'video' && (
            <video
              src={status.mediaUrl}
              autoPlay
              muted
              className="viewer-video"
              onEnded={goNext}
            />
          )}
          {status.type === 'text' && (
            <div
              className="viewer-text-card"
              style={{ background: textBgGradients[status.textBg ?? 0] }}
            >
              <p>{status.text}</p>
            </div>
          )}
        </div>

        {/* Tap zones */}
        <div className="viewer-tap-prev" onClick={goPrev} />
        <div className="viewer-tap-next" onClick={goNext} />

        {/* Footer */}
        <div className="viewer-footer">
          {isOwn ? (
            <div className="viewer-seen">
              👁 {viewerCount} view{viewerCount !== 1 ? 's' : ''}
            </div>
          ) : (
            <div className="viewer-reply-hint">
              <span>📸 Status</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatRelativeTime = (ts) => {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return 'Yesterday';
};

export default StatusTab;
