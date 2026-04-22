import React from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import UserPanel from '../../components/UserPanel/UserPanel';
import ChatWindow from '../../components/ChatWindow/ChatWindow';

const Chat = () => {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-0 md:p-4">
      <div className="w-full max-w-[1400px] h-screen md:h-[90vh] bg-slate-800/50 backdrop-blur-xl md:border border-slate-700/50 md:rounded-2xl shadow-2xl flex flex-col md:flex-row overflow-hidden">
        <Sidebar />
        <ChatWindow />
        <UserPanel />
      </div>
    </div>
  )
}

export default Chat;
