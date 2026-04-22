import React, { useContext, useState, useEffect, useRef } from 'react';
import assets from '../../assets/assets';
import { AppContext } from '../../context/AppContextProvider';
import { toast } from 'react-toastify';

const StatusTab = () => {
  const { userData, statuses, postStatus, markStatusViewed } = useContext(AppContext);

  const [showPostModal, setShowPostModal] = useState(false);
  const [viewerData, setViewerData] = useState(null); 
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [textInput, setTextInput] = useState('');
  const [postType, setPostType] = useState('media'); 
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

  const openViewer = (groups, groupIndex, statusIndex = 0) => {
    setViewerData({ groups, groupIndex, statusIndex });
  };

  const openMyViewer = () => {
    if (myStatuses.length === 0) { setShowPostModal(true); return; }
    openViewer([myStatuses], 0, 0);
  };

  const hasUnviewed = (group) => group.some((s) => !s.viewers?.includes(userData?.uid));

  return (
    <div className="flex flex-col space-y-4 p-2">

      <div 
        className="flex items-center gap-4 p-3 bg-slate-800 rounded-2xl cursor-pointer hover:bg-slate-700 transition-colors border border-slate-700/50 shadow-sm" 
        onClick={openMyViewer}
      >
        <div className={`relative rounded-full p-0.5 ${myStatuses.length > 0 ? 'bg-gradient-to-tr from-indigo-500 to-purple-500' : 'bg-slate-600'}`}>
          <img src={userData?.avatar || assets.profile_img} alt="me" className="w-14 h-14 rounded-full border-2 border-slate-800 object-cover" />
          <button
            className="absolute bottom-0 right-0 w-5 h-5 bg-indigo-500 border-2 border-slate-800 rounded-full flex items-center justify-center text-white text-xs font-bold hover:bg-indigo-400 transition-colors"
            onClick={(e) => { e.stopPropagation(); setShowPostModal(true); }}
            title="Add status"
          >+</button>
        </div>
        <div>
          <p className="font-semibold text-white">My Status</p>
          <span className="text-sm text-slate-400">
            {myStatuses.length > 0
              ? `${myStatuses.length} update${myStatuses.length > 1 ? 's' : ''}`
              : 'Tap to add a status update'}
          </span>
        </div>
      </div>

      {othersGroups.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider px-2 mt-2">Recent updates</p>
          {othersGroups.map((group, gi) => {
            const first = group[0];
            const unviewed = hasUnviewed(group);
            return (
              <div
                key={first.userId}
                className="flex items-center gap-4 p-3 hover:bg-slate-800 rounded-2xl cursor-pointer transition-colors"
                onClick={() => {
                  openViewer(othersGroups, gi, 0);
                  markStatusViewed(first.id);
                }}
              >
                <div className={`rounded-full p-0.5 ${unviewed ? 'bg-gradient-to-tr from-indigo-500 to-purple-500' : 'bg-slate-600'}`}>
                  <img src={first.userAvatar || assets.profile_img} alt={first.userName} className="w-14 h-14 rounded-full border-2 border-slate-900 object-cover" />
                </div>
                <div>
                  <p className="font-semibold text-white">{first.userName || 'User'}</p>
                  <span className="text-sm text-slate-400">{formatRelativeTime(first.createdAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {othersGroups.length === 0 && myStatuses.length === 0 && (
        <div className="flex flex-col items-center justify-center text-center mt-10 p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50 border-dashed">
          <span className="text-4xl mb-3 opacity-50">📸</span>
          <p className="font-semibold text-slate-300">No status updates yet</p>
          <small className="text-slate-500 mt-1">Be the first to share a moment!</small>
        </div>
      )}

      {/* Post Modal */}
      {showPostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => !uploading && setShowPostModal(false)}>
          <div className="bg-slate-800 border border-slate-700 w-full max-w-sm rounded-2xl shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="font-semibold text-white">Add Status</h3>
              <button className="text-slate-400 hover:text-white" onClick={() => setShowPostModal(false)}>✕</button>
            </div>

            <div className="flex border-b border-slate-700">
              <button
                className={`flex-1 py-3 text-sm font-medium transition-colors ${postType === 'media' ? 'bg-indigo-600/20 text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-400 hover:bg-slate-700'}`}
                onClick={() => setPostType('media')}
              >📷 Media</button>
              <button
                className={`flex-1 py-3 text-sm font-medium transition-colors ${postType === 'text' ? 'bg-indigo-600/20 text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-400 hover:bg-slate-700'}`}
                onClick={() => setPostType('text')}
              >✏️ Text</button>
            </div>

            {postType === 'media' ? (
              <div className="p-6 flex flex-col items-center justify-center min-h-[200px]">
                {uploading ? (
                  <div className="w-full">
                    <div className="w-full bg-slate-700 h-3 rounded-full overflow-hidden mb-2">
                      <div className="bg-indigo-500 h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                    </div>
                    <p className="text-center text-sm text-slate-400">{uploadProgress}% uploaded</p>
                  </div>
                ) : (
                  <>
                    <div 
                      className="w-full p-8 border-2 border-slate-600 border-dashed rounded-xl flex flex-col items-center text-center cursor-pointer hover:bg-slate-700/50 hover:border-indigo-500 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <span className="text-4xl mb-3">📤</span>
                      <p className="font-medium text-slate-200 text-sm">Click to select photo or video</p>
                      <small className="text-slate-500 mt-2 text-xs">Disappears after 24 hours</small>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*,video/*" hidden onChange={handleFileChange} />
                  </>
                )}
              </div>
            ) : (
              <div className="p-4 flex flex-col gap-4">
                <div 
                  className="aspect-square w-full rounded-xl flex items-center justify-center p-6 shadow-inner transition-colors duration-300"
                  style={{ background: TEXT_BG_GRADIENTS[textBg] }}
                >
                  <textarea
                    placeholder="What's on your mind?"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    maxLength={200}
                    className="w-full h-full bg-transparent text-white text-center text-xl font-medium resize-none focus:outline-none placeholder-white/50"
                  />
                </div>
                <div className="flex gap-2 justify-center flex-wrap">
                  {TEXT_BG_GRADIENTS.map((g, i) => (
                    <button
                      key={i}
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${textBg === i ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-110'}`}
                      style={{ background: g }}
                      onClick={() => setTextBg(i)}
                    />
                  ))}
                </div>
                <button
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-colors disabled:opacity-50 mt-2"
                  onClick={handlePostText}
                  disabled={!textInput.trim()}
                >Post Status</button>
              </div>
            )}
          </div>
        </div>
      )}

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
  const DURATION = 5000;

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

  useEffect(() => {
    if (status?.id) markViewed(status.id);
  }, [status?.id]);

  if (!status) { onClose(); return null; }

  const viewerCount = status.viewers?.length || 0;
  const statusUser = status.userName || 'User';
  const statusAvatar = status.userAvatar || '';

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center" onClick={onClose}>
      <div className="relative w-full max-w-[450px] h-full sm:h-[90vh] sm:rounded-3xl overflow-hidden bg-slate-900 shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>

        {/* Progress bars */}
        <div className="absolute top-0 left-0 right-0 p-3 z-10 flex gap-1 pt-4 bg-gradient-to-b from-black/50 to-transparent">
          {group.map((_, i) => (
            <div key={i} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-100 ease-linear"
                style={{ width: i < curStatus ? '100%' : i === curStatus ? `${progress}%` : '0%' }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-0 left-0 right-0 mt-8 p-4 z-10 flex items-center gap-3">
          <img src={statusAvatar || assets.profile_img} alt={statusUser} className="w-10 h-10 rounded-full border border-white/50 object-cover" />
          <div className="flex-1">
            <p className="font-semibold text-white drop-shadow-md text-sm">{statusUser}</p>
            <p className="text-white/80 drop-shadow-md text-xs">{formatRelativeTime(status.createdAt)}</p>
          </div>
          <button className="text-white p-2 hover:bg-white/20 rounded-full transition-colors" onClick={onClose}>✕</button>
        </div>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center relative bg-black">
          {status.type === 'image' && (
            <img src={status.mediaUrl} alt="status" className="w-full h-full object-contain" />
          )}
          {status.type === 'video' && (
            <video
              src={status.mediaUrl}
              autoPlay
              muted
              className="w-full h-full object-contain"
              onEnded={goNext}
            />
          )}
          {status.type === 'text' && (
            <div
              className="w-full h-full flex items-center justify-center p-8"
              style={{ background: textBgGradients[status.textBg ?? 0] }}
            >
              <p className="text-white text-3xl font-medium text-center break-words leading-tight">{status.text}</p>
            </div>
          )}

          {/* Tap Zones */}
          <div className="absolute top-20 bottom-20 left-0 w-1/3 z-20 cursor-pointer" onClick={goPrev} />
          <div className="absolute top-20 bottom-20 right-0 w-2/3 z-20 cursor-pointer" onClick={goNext} />
        </div>

        {/* Footer */}
        {isOwn && (
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent flex justify-center items-center pointer-events-none">
            <span className="text-white font-medium drop-shadow-md">👁 {viewerCount} view{viewerCount !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
    </div>
  );
};

const formatRelativeTime = (ts) => {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return 'Yesterday';
};

export default StatusTab;
