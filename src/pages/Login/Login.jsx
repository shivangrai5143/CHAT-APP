import React, {useState} from 'react'
import "./Login.css"
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
    <div className='login'>
      {/* Animated background orbs */}
      <div className="login-bg-orb orb-1"></div>
      <div className="login-bg-orb orb-2"></div>
      <div className="login-bg-orb orb-3"></div>

      <div className="login-card">
        {/* Left branding panel */}
        <div className="login-brand">
          <div className="brand-content">
            <img src={assets.logo_big} alt="" className='brand-logo' />
            <p className="brand-tagline">Connect. Chat. Collaborate.</p>
            <div className="brand-features">
              <div className="brand-feature"><span>💬</span> Real-time messaging</div>
              <div className="brand-feature"><span>👥</span> Group rooms</div>
              <div className="brand-feature"><span>🔒</span> Secure & private</div>
            </div>
          </div>
          <div className="brand-glow"></div>
        </div>

        {/* Right form panel */}
        <div className="login-form-panel">
          <div className="form-header">
            <h2>{currState === "Sign up" ? "Create Account" : "Welcome Back"}</h2>
            <p>{currState === "Sign up" ? "Join the conversation today" : "Sign in to continue"}</p>
          </div>

          <form onSubmit={onSubmitHandler} className="login-form">
            {currState === "Sign up" && (
              <div className="input-group">
                <label>Username</label>
                <input 
                  onChange={(e) => setUserName(e.target.value)} 
                  value={userName} 
                  type="text" 
                  placeholder='Choose a username' 
                  required 
                />
              </div>
            )}
            <div className="input-group">
              <label>Email</label>
              <input 
                onChange={(e) => setEmail(e.target.value)} 
                value={email} 
                type="email" 
                placeholder='Enter your email' 
                required 
              />
            </div>
            <div className="input-group">
              <label>Password</label>
              <input 
                onChange={(e) => setPassword(e.target.value)} 
                value={password} 
                type="password" 
                placeholder='Enter your password' 
                required 
              />
            </div>

            <button type="submit" className="login-btn">
              <span>{currState === "Sign up" ? "Create Account" : "Sign In"}</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>

            <div className="login-term">
              <input type="checkbox" id="terms" />
              <label htmlFor="terms">I agree to the Terms of Service & Privacy Policy</label>
            </div>
          </form>

          <div className="login-divider">
            <span>or</span>
          </div>

          <div className="login-switch">
            {currState === "Sign up" 
              ? <p>Already have an account? <span onClick={() => setCurrState("Login")}>Sign In</span></p> 
              : <p>Don't have an account? <span onClick={() => setCurrState("Sign up")}>Create One</span></p>
            }
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
