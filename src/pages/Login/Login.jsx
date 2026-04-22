import React, {useState} from 'react'
import assets from '../../assets/assets'
import {signup, login} from '../../config/firebase'

const Login = () => {
  const [currState, setCurrState] = useState("Sign up");
  const [userName,setUserName] = useState("");
  const[email,setEmail]=useState("");
  const[password,setPassword]= useState ("");

  const onSubmitHandler = (event) => {
    event.preventDefault();
    if(currState === "Sign up"){
      signup(userName,email,password);
    }
    else{
       login(email,password);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 relative overflow-hidden">
      {/* Animated background orbs - using Tailwind for absolute positioning & gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/30 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/30 rounded-full blur-[120px] animate-pulse" style={{animationDelay: '2s'}}></div>
      <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] bg-blue-600/20 rounded-full blur-[100px] animate-pulse" style={{animationDelay: '4s'}}></div>

      {/* Main Card */}
      <div className="relative z-10 w-[90%] max-w-5xl flex flex-col md:flex-row bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Left branding panel */}
        <div className="hidden md:flex flex-1 flex-col justify-between p-12 bg-indigo-900/40 relative overflow-hidden">
          <div className="relative z-10">
            <img src={assets.logo_big} alt="Logo" className="w-32 mb-8 drop-shadow-md" />
            <p className="text-3xl font-bold text-white mb-8 leading-tight">Connect.<br/>Chat.<br/>Collaborate.</p>
            <div className="space-y-4">
              <div className="flex items-center text-indigo-100 text-lg"><span className="mr-3 text-2xl">💬</span> Real-time messaging</div>
              <div className="flex items-center text-indigo-100 text-lg"><span className="mr-3 text-2xl">👥</span> Group rooms</div>
              <div className="flex items-center text-indigo-100 text-lg"><span className="mr-3 text-2xl">🔒</span> Secure & private</div>
            </div>
          </div>
          {/* Decorative glow inside panel */}
          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-indigo-500/40 rounded-full blur-3xl"></div>
        </div>

        {/* Right form panel */}
        <div className="flex-1 p-8 md:p-12 flex flex-col justify-center">
          <div className="mb-8 text-center md:text-left">
            <h2 className="text-3xl font-bold text-white mb-2">{currState === "Sign up" ? "Create Account" : "Welcome Back"}</h2>
            <p className="text-slate-400">{currState === "Sign up" ? "Join the conversation today" : "Sign in to continue"}</p>
          </div>

          <form onSubmit={onSubmitHandler} className="space-y-5">
            {currState === "Sign up" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300 ml-1">Username</label>
                <input 
                  onChange={(e) => setUserName(e.target.value)} 
                  value={userName} 
                  type="text" 
                  placeholder="Choose a username" 
                  required 
                  className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300 ml-1">Email</label>
              <input 
                onChange={(e) => setEmail(e.target.value)} 
                value={email} 
                type="email" 
                placeholder="Enter your email" 
                required 
                className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300 ml-1">Password</label>
              <input 
                onChange={(e) => setPassword(e.target.value)} 
                value={password} 
                type="password" 
                placeholder="Enter your password" 
                required 
                className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>

            <button type="submit" className="w-full py-3 mt-4 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all active:scale-[0.98]">
              <span>{currState === "Sign up" ? "Create Account" : "Sign In"}</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>

            <div className="flex items-start gap-2 mt-4">
              <input type="checkbox" id="terms" className="mt-1 w-4 h-4 rounded bg-black/20 border-white/10 text-indigo-500 focus:ring-indigo-500" />
              <label htmlFor="terms" className="text-sm text-slate-400">I agree to the Terms of Service & Privacy Policy</label>
            </div>
          </form>

          <div className="relative my-8 flex items-center">
            <div className="flex-grow border-t border-white/10"></div>
            <span className="flex-shrink-0 mx-4 text-slate-500 text-sm">or</span>
            <div className="flex-grow border-t border-white/10"></div>
          </div>

          <div className="text-center text-slate-400 text-sm">
            {currState === "Sign up" 
              ? <p>Already have an account? <span onClick={() => setCurrState("Login")} className="text-indigo-400 font-medium cursor-pointer hover:text-indigo-300 transition-colors">Sign In</span></p> 
              : <p>Don't have an account? <span onClick={() => setCurrState("Sign up")} className="text-indigo-400 font-medium cursor-pointer hover:text-indigo-300 transition-colors">Create One</span></p>
            }
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
