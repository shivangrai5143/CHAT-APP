import React, { useEffect } from 'react'
import { Route, Routes , useNavigate } from 'react-router-dom'
import Login from './pages/login/login'
import Chat from './pages/Chat/Chat'
import ProfileUpdate from './pages/ProfileUpdate/ProfileUpdate'
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { onAuthStateChanged , getAuth } from 'firebase/auth' 

const App = () => {

  const navigate = useNavigate(); 

  useEffect(() => {
    onAuthStateChanged(getAuth(), async (user)=>{
      if(user){
         navigate("/chat")
      }
      else{
        navigate("/")
      }
    }) 
  }, []);

  return (
    <>
    <ToastContainer/>
      <Routes>
        <Route path="/" element={<Login/>} />
        <Route path="/chat" element={<Chat/>} />
        <Route path="/profile" element={<ProfileUpdate/>} />
      </Routes>
    </>
  )
}

export default App
